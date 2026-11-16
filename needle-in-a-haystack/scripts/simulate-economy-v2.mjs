// Offline deterministic model. Does not boot the game, build Vite, or touch saves.
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
async function load(path) {
  const source = stripTypeScriptTypes(await readFile(new URL(`../src/${path}.ts`, import.meta.url), 'utf8'), { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { config: base, upgrades, upgradePrice } = await load('config/balance');
const { economyV2: proposal, economyV2Revised: revised } = await load('config/balance.v2');
let v2 = proposal;
const { toolSpecs, toolUpgradePrice, toolUpgradeLimits, pigBalance, pigUpgrades, pigUpgradePrice } = await load('config/progression');
const { strawRarity, rarityBalance } = await load('config/rarity');
const { saleEvent } = await load('config/presentation');
const math = await load('systems/economyMath');
const rng = seed => () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
const toolNames = ['hands', 'rake', 'pitchfork', 'widefork', 'vacuum'];
const profiles = [
  { name: 'fast', gap: .08, sale: .4, shop: 4, route: 1.05, pigTravel: 1.5 },
  { name: 'baseline', gap: .22, sale: 1, shop: 8, route: 1.15, pigTravel: 3 },
  { name: 'deliberate', gap: .55, sale: 2, shop: 14, route: 1.3, pigTravel: 5 },
];
const plan = (name, actions) => ({ name, actions: actions.trim().split(/\s+/) });
// Explicit, reproducible strategies, not a claim of optimal human behaviour.
const strategies = [
  plan('tool-rush', 'b1 t1 b2 t2 b3 m1 t3 b4 c1 t4 b5 c2 m2 v4 v4 b6 c3'),
  plan('early-sale', 'b1 t1 s1 s2 b2 t2 s3 b3 m1 s4 t3 b4 s5 c1 t4 b5 c2'),
  plan('backpack', 'b1 t1 b2 b3 t2 b4 m1 b5 b6 t3 b7 b8 c1 m2 t4 c2'),
  plan('wide-focused', 'b1 t1 b2 t2 b3 m1 t3 v3 x3 b4 v3 x3 c1 v3 b5 x3 v3 c2 v3'),
  plan('pig-assisted', 'b1 t1 p b2 t2 p b3 m1 q p t3 b4 q r c1 t4 b5 q'),
  plan('no-pigs', 'b1 t1 b2 m1 t2 c1 b3 s1 t3 b4 c2 v3 s2 m2 t4 b5 v4'),
  plan('no-vacuum', 'b1 t1 b2 t2 b3 s1 m1 t3 v3 b4 x3 c1 s2 v3 b5 x3 c2 v3'),
  plan('rake-invest-stress', 'b1 t1 v1 b2 c1 v1 m1 v1 b3 c2 v1 s1 c3 v1 b4 c4 s2 m2 c5 b5 c6 s3 c7'),
  plan('fork-invest-stress', 'b1 t1 b2 c1 t2 v2 b3 v2 c2 v2 s1 b4 c3 v2 m1 v2 c4 s2 b5 c5 c6 s3 c7'),
];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function simulate(candidate, strategy, human, seed) {
  const random = rng(seed), ids = Array.from({ length: base.totalHay }, (_, i) => i);
  for (let i = ids.length - 1; i; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  let cursor = 0, inventory = 0, coins = 0, spent = 0, normal = 0, rare = 0, eventRevenue = 0, remainder = 0, eventRemainder = 0;
  let time = 0, menu = 0, trips = 0, pigHay = 0, bites = 0, actions = 0, blocked = null;
  let tool = 0, portion = 0, pigSpeed = 0, index = 0, deliveries = 0, tutorial = false;
  let eventStart = Infinity, eventEnd = Infinity, eventSeconds = 0, eventHay = 0;
  const levels = { b: 0, m: 0, c: 0, s: 0 }, volumes = [0,0,0,0], specials = [0,0,0,0], pigs = [], purchases = [], milestones = {};
  const categories = { collect: 0, walk: 0, sell: 0 };
  let position = { ...base.playerSpawn };
  const remaining = () => base.totalHay - cursor;
  const saleRate = () => math.saleHundredthsAt(levels.s);
  const speed = () => math.movementAt(base.movementSpeed, upgrades.movement.step, levels.m);
  const capacity = () => math.capacityAt(base.capacity, upgrades.capacity.step, levels.b);
  const reach = () => { const spec = tool ? (candidate ? v2.tools[tool - 1] : toolSpecs[tool - 1]) : {}; return (spec.rangeBase ?? 0) + (tool ? specials[tool - 1] : 0) * (spec.rangeStep ?? 0); };
  const gain = (amount, pig = false) => {
    let count = 0;
    const multiplier = !pig && tool === 1 ? 1 + specials[0] * (candidate ? v2.tools[0].rareStep : toolSpecs[0].rareStep) : 1;
    while (count < amount && cursor < ids.length) {
      const rarity = strawRarity(ids[cursor++]);
      const bonus = Math.ceil(rarity.bonus * multiplier); coins += bonus; rare += bonus; count++;
    }
    if (pig) { const payout = math.payoutAt(count * saleRate(), remainder); remainder = payout.remainder; normal += payout.earned; coins += payout.earned; pigHay += count; trackPayback(count, 1); }
    else inventory += count;
    return count;
  };
  function trackPayback(amount, multiplier) {
    for (const purchase of purchases) if (purchase.item.startsWith('s')) {
      purchase.realizedHundredths = (purchase.realizedHundredths ?? 0) + amount * 25 * multiplier;
      if (purchase.paybackAt === undefined && purchase.realizedHundredths >= purchase.price * 100) purchase.paybackAt = time;
    }
  }
  const advance = (seconds, category) => {
    if (category === 'menu') { menu += seconds; return; }
    categories[category] += seconds;
    const end = time + seconds;
    while (time < end - 1e-9) {
      let next = Math.min(end, eventStart, eventEnd, ...pigs.map(pig => pig.next));
      if (eventEnd < Infinity) eventSeconds += next - time;
      time = next;
      if (time >= eventEnd) { eventEnd = Infinity; eventStart = time + saleEvent.minWait + random() * (saleEvent.maxWait - saleEvent.minWait); }
      if (time >= eventStart) { eventStart = Infinity; eventEnd = time + saleEvent.duration; }
      for (let i = 0; i < pigs.length; i++) if (time >= pigs[i].next) {
        if (remaining()) { gain(pigBalance.portions[i] + portion, true); bites++; }
        pigs[i].next = time + Math.max(pigBalance.intervals[i] * pigUpgrades.intervalMultiplier ** pigSpeed, 3 + human.pigTravel);
      }
    }
  };
  const walk = target => { advance(dist(position, target) * human.route / speed(), 'walk'); position = { ...target }; };
  const sites = () => {
    const dx = base.cart.x - base.hay.x, dz = base.cart.z - base.hay.z, length = Math.hypot(dx, dz);
    const hayRange = base.hay.radius + base.playerRadius + base.interactionGap + base.interactionTolerance + reach();
    const cartRange = base.cart.radius + base.playerRadius + base.interactionGap + base.interactionTolerance;
    return { hay: { x: base.hay.x + dx / length * hayRange, z: base.hay.z + dz / length * hayRange }, cart: { x: base.cart.x - dx / length * cartRange, z: base.cart.z - dz / length * cartRange } };
  };
  const field = { b: 'capacity', m: 'movement', c: 'collection', s: 'sale' };
  function offer(token) {
    const kind = token[0], number = Number(token.slice(1));
    if (field[kind]) {
      const level = levels[kind], cap = candidate ? v2.player[field[kind]].length : upgrades[field[kind]].maxLevel;
      if (level >= number || level >= cap) return { skip: true };
      return { kind, price: candidate ? v2.player[field[kind]][level] : upgradePrice(field[kind], level), physical: kind === 'b', level: level + 1 };
    }
    if (kind === 't') {
      if (tool >= number) return { skip: true };
      return { kind, price: candidate ? v2.tools[tool].price : upgradePrice('tools', tool), physical: true, level: tool + 1 };
    }
    if (kind === 'p') {
      if (pigs.length >= 3) return { skip: true };
      return { kind, price: (candidate ? v2.pigs.prices : pigBalance.prices)[pigs.length], physical: true, level: pigs.length + 1 };
    }
    if (kind === 'q' || kind === 'r') {
      if (!pigs.length) return { skip: true };
      const type = kind === 'q' ? 'portion' : 'speed', level = kind === 'q' ? portion : pigSpeed;
      const cap = candidate ? v2.pigs[type].length : pigUpgrades.maxLevel;
      if (level >= cap) return { skip: true };
      return { kind, price: candidate ? v2.pigs[type][level] : pigUpgradePrice(type, level), level: level + 1 };
    }
    const type = kind === 'v' ? 'volume' : 'special', array = type === 'volume' ? volumes : specials, level = array[number - 1];
    const cap = candidate ? v2.tools[number - 1][type].length : toolUpgradeLimits[type];
    if (number > tool || level >= cap) return { skip: true };
    return { kind, item: number, level: level + 1, price: candidate ? v2.tools[number - 1][type][level] : toolUpgradePrice(number, type, level) };
  }
  while (remaining() || inventory) {
    if (remaining()) {
      walk(sites().hay);
      while (remaining() && inventory < capacity()) {
        const amount = math.amountAt(upgrades.tools.amounts[tool], tool ? toolSpecs[tool - 1].volumeStep : 0, tool ? volumes[tool - 1] : 0);
        const duration = math.durationAt(base.collectionSeconds, upgrades.collection.multiplier, levels.c, tool ? toolSpecs[tool - 1].duration : 1, tool === 3 ? specials[2] : 0, candidate ? v2.tools[2].timeMultiplier : toolSpecs[2].specialDuration);
        advance(Math.ceil(duration * 60) / 60 + (tool === 4 ? 1 / 60 : human.gap), 'collect');
        if (gain(Math.min(amount, capacity() - inventory))) actions++;
        if (!tutorial && purchases.length && deliveries) { tutorial = true; eventStart = time + saleEvent.minWait + random() * (saleEvent.maxWait - saleEvent.minWait); }
      }
    }
    if (inventory) {
      walk(sites().cart); advance(human.sale, 'sell');
      const amount = inventory, payout = math.payoutAt(amount * saleRate(), remainder); remainder = payout.remainder;
      normal += payout.earned; coins += payout.earned;
      if (eventEnd < Infinity) { const extra = math.payoutAt(amount * saleRate(), eventRemainder); eventRemainder = extra.remainder; coins += extra.earned; eventRevenue += extra.earned; eventHay += amount; }
      trackPayback(amount, eventEnd < Infinity ? 2 : 1);
      inventory = 0; trips++; deliveries++;
    }
    if (!remaining()) break;
    let bought = 0;
    while (index < strategy.actions.length && bought < 4) {
      const token = strategy.actions[index], item = offer(token);
      if (item.skip) { index++; continue; }
      if (coins < item.price) { blocked = `${token}: ${item.price}`; break; }
      if (item.physical) {
        // Approach the appropriate display from current position; straight-line distance
        // receives an explicit detour factor, not a claim of real pathfinding.
        const { barnItems } = progression;
        const target = item.kind === 'b' ? barnItems.backpack : item.kind === 'p' ? barnItems.pig : Object.values(barnItems).find(entry => entry.tool === tool + 1);
        const distance = dist(position, target), ratio = Math.max(0, distance - 1.8) / distance;
        walk({ x: position.x + (target.x - position.x) * ratio, z: position.z + (target.z - position.z) * ratio });
      }
      advance(human.shop, 'menu');
      if (!remaining()) break;
      coins -= item.price; spent += item.price;
      if (field[item.kind]) levels[item.kind]++;
      if (item.kind === 't') { tool++; milestones[toolNames[tool]] = time; }
      if (item.kind === 'v') volumes[item.item - 1]++;
      if (item.kind === 'x') specials[item.item - 1]++;
      if (item.kind === 'q') portion++;
      if (item.kind === 'r') pigSpeed++;
      if (item.kind === 'p') pigs.push({ next: time + 3 + dist({ x: 8, z: -5 }, sites().hay) / pigBalance.speed });
      purchases.push({ item: token, level: item.level, at: time, hay: remaining(), price: item.price, spent, budget: coins,
        paybackHay: item.kind === 's' ? item.price / .25 : null });
      blocked = null; index++; bought++;
    }
    if (actions > 100000) throw new Error('Model step bound exceeded');
  }
  walk(base.needle); // final manual needle pickup, no prestige/reset assumption.
  return { candidate, strategy: strategy.name, profile: human.name, seed, active: time, elapsed: time + menu, categories, menu, normal, rare, eventRevenue, earned: normal + rare + eventRevenue, spent, coins, trips, actions, pigHay, bites, eventSeconds, eventHay, milestones, purchases, blocked, lastTool: toolNames[tool], unbought: strategy.actions.slice(index) };
}
const progression = await load('config/progression');
const runs = [];
if (process.argv.includes('--search')) {
  const results = [];
  for (const fork of [1800, 2600, 3400]) for (const wide of [6500, 9000, 12000]) for (const vacuum of [16000, 24000]) for (const factor of [1.5, 2.5]) {
    v2 = { ...proposal, tools: proposal.tools.map((tool, i) => ({ ...tool, price: [60, fork, wide, vacuum][i], volume: tool.volume.map(p=>Math.ceil(p*factor)), special: tool.special.map(p=>Math.ceil(p*factor)) })) };
    const rows = strategies.slice(0, 7).map(strategy => simulate(true, strategy, profiles[1], 17));
    const times = rows.map(row=>row.active/60), average = times.reduce((a,b)=>a+b)/times.length;
    const penalty = times.reduce((sum,t)=>sum + Math.max(0,45-t)**2 + Math.max(0,t-60)**2,0);
    results.push({fork,wide,vacuum,factor,average,min:Math.min(...times),max:Math.max(...times),penalty,times});
  }
  results.sort((a,b)=>a.penalty-b.penalty);
  console.log(JSON.stringify(results.slice(0,8),null,2));
  process.exit(0);
}
for (const variant of ['current', 'v2-proposal', 'v2-revised']) {
  v2 = variant === 'v2-revised' ? revised : proposal;
  for (const profile of profiles) for (const strategy of strategies) for (const seed of [17, 53, 101]) runs.push({ ...simulate(variant !== 'current', strategy, profile, seed), variant });
}
const average = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const f = (n, digits = 1) => n.toFixed(digits);
const lines = ['# Расчётный эксперимент экономики v2', '',
  '**Статус: SIMULATED, не MEASURED. Кандидат не активирован.** Production-цены, ключи сохранений и пользовательские данные не менялись.', '',
  'Запуск: `node scripts/simulate-economy-v2.mjs` из приложения (Node 22.13+). Нет браузера, Vite-сборки или игровых тестов. Три фиксированных seed, семь основных и две дополнительные стресс-стратегии, три сценария человеческого темпа, current / исходный v2 / переработанный v2: 243 детерминированных прогона. Телеметрия подготовлена отдельно, но фактические данные ещё не собраны.', '',
  '## Переработанный кандидат для цели 45–60 минут', '',
  'По ответу владельца цель сохранена, старые уровни/эффекты должны оставаться, AI свинок не меняется, игровые проверки отложены. Подбор сравнил 36 ценовых комбинаций на baseline/seed 17; выбранный вариант затем пересчитан на остальных seed и темпах. Это не независимый плейтест и не доказательство оптимальности: модель и стратегии ограничены.', '',
  '**Важный контрпример:** специализация на граблях/вилах даёт около 36–39 минут в базовом сценарии, хотя семь основных маршрутов попали примерно в 45–54. Подгонка только семи маршрутов не доказывает цель. Более дорогие новые инструменты могут проигрывать прокачанному старому по оставшемуся времени/цене; это требует плейтеста и дальнейшего сравнения, а не искусственной задержки команд.', '',
  `Инструменты: ${revised.tools.map(tool=>tool.price).join(' / ')}. Ветки объёма/особенности стоят ×2,5 от исходного предложения v2, без изменения скорости действий/порций. Ранние рюкзак/персонаж/продажа/свинки сохраняют предложенные таблицы. Пылесос не обязателен; максимум всех покупок не требуется. Цены production не переключены.`, '',
  '| Ветка персонажа | Цены отдельных уровней | Предел |', '|---|---|---:|',
  ...Object.entries(revised.player).map(([key,prices])=>`| ${key} | ${prices.join(' / ')} | ${prices.length} |`), '',
  '| Инструмент | Покупка | Объём: цены уровней | Особенность: цены уровней |', '|---|---:|---|---|',
  ...revised.tools.map((tool,i)=>`| ${toolNames[i+1]} | ${tool.price} | ${tool.volume.join(' / ')} | ${tool.special.join(' / ')} |`), '',
  `Свинки: ${revised.pigs.prices.join(' / ')}; общая порция: ${revised.pigs.portion.join(' / ')}; скорость еды (не финализирована): ${revised.pigs.speed.join(' / ')}. Эффекты и caps исходного v2 остаются, включая +15% редкости граблей и +0,25 м вил.`, '',
  '## Что взято из кода, а что предполагается', '',
  '- **Из исходников:** геометрия карты/радиусы/скорость, 20 000 единиц, времена и объёмы инструментов, цены и caps, стабильные ID-редкости и округление бонуса, сотые монет, ×2 только для игрока. Чистые формулы economyMath.ts общие с действующим EconomySystem.ts; модель не загружает рендерер.',
  '- **ASSUMED:** ручной интервал после завершения порции; 60 FPS; прямые расстояния с коэффициентом обхода, а не реальные маршруты/коллизии/склон стога; задержка сдачи, меню, дополнительный подход свинок. Эти значения не замерены на устройстве.',
  '- Шанс редкости не заменён ожидаемой средней наградой: используются те же 20 000 ID в детерминированной перестановке. Реальное пространственное распределение/выбор доступных стеблей не воспроизведены. Грабли усиливают только стебли, собранные ими, свинки — нет.',
  '- Свинки съедают тот же ограниченный запас; их выручка входит в общий доход, не считается новой прибылью. Цикл укуса ограничен max(cooldown, 3 секунды прогулки + предполагаемый подход). Это приближение AI, не его исполнение.',
  '- Меню останавливает событие и свинок; время меню отдельно добавлено к elapsed. Обучение примерно считается законченным после первой покупки и следующего сбора после сдачи. ×2 использует фиксированные seed, реальные 180–300/45 секунд.',
  '- Автоматических повторов у ручных инструментов в игре нет: модель лишь планирует следующие успешные команды с указанной паузой. У пылесоса удержание; добавлена кадровая задержка. Полный инвентарь и дефицит оставшегося сена учитываются.', '',
  '| Сценарий | Пауза ручного нажатия, с | Сдача, с | Меню на покупку, с | Коэффициент пути | Подход свинки после прогулки, с |',
  '|---|---:|---:|---:|---:|---:|', ...profiles.map(p => `| ${p.name} | ${p.gap} | ${p.sale} | ${p.shop} | ${p.route} | ${p.pigTravel} |`), '',
  '## Сравнение стратегий', '',
  'Значения — средние трёх seed, диапазон времени отдельно. Активное время включает сбор, ходьбу и сдачу; elapsed также включает остановленные меню. Стратегии — явные списки приоритетов, не доказательство оптимальности; если желаемая покупка не по карману, модель копит на неё.', '',
  '| Баланс | Темп | Стратегия | Активно, мин (min–max) | С меню, мин | Сено/мин | Заработано / потрачено | Поездок | Съедено свинками | Последний инструмент |',
  '|---|---|---|---:|---:|---:|---:|---:|---:|---|'];
for (const variant of ['current', 'v2-proposal', 'v2-revised']) for (const profile of profiles) for (const strategy of strategies) {
  const rows = runs.filter(r => r.variant === variant && r.profile === profile.name && r.strategy === strategy.name);
  lines.push(`| ${variant} | ${profile.name} | ${strategy.name} | ${f(average(rows,'active')/60)} (${f(Math.min(...rows.map(r=>r.active))/60)}–${f(Math.max(...rows.map(r=>r.active))/60)}) | ${f(average(rows,'elapsed')/60)} | ${f(base.totalHay/(average(rows,'active')/60))} | ${f(average(rows,'earned'),0)} / ${f(average(rows,'spent'),0)} | ${f(average(rows,'trips'),0)} | ${f(average(rows,'pigHay'),0)} | ${rows[0].lastTool} |`);
}
lines.push('', '## Покупки переработанного v2: baseline, seed 17', '', 'Полный заданный маршрут покупок и оставшийся ресурс. Код s — улучшение цены. Маржинальная выручка продажи отслеживается по фактическим будущим ресурсам модели, включая свинок и ×2 только для сдачи игроком. Это модельная стоимость в сотых, не отдельное начисление: округление ledger может сдвинуть результат меньше чем на монету. Стоимость альтернативных покупок дополнительно отражена отдельными стратегиями.', '');
for (const row of runs.filter(r => r.variant === 'v2-revised' && r.profile === 'baseline' && r.seed === 17)) {
  lines.push(`### ${row.strategy}`, '', '| Покупка | Уровень | Активная минута | Сена осталось | Цена | Всего расходов | Монет осталось | Окупить продажу, стеблей |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const p of row.purchases) lines.push(`| ${p.item} | ${p.level} | ${f(p.at/60,2)} | ${p.hay} | ${p.price} | ${p.spent} | ${p.budget} | ${p.paybackHay ?? '—'} |`);
  lines.push('', '| Ветка продажи | Модельная добавочная выручка до конца | Минута возврата цены |', '|---|---:|---:|');
  for (const p of row.purchases.filter(p=>p.item.startsWith('s'))) lines.push(`| ${p.item} | ${f((p.realizedHundredths ?? 0)/100,2)} | ${p.paybackAt === undefined ? 'Не окупилась' : f(p.paybackAt/60,2)} |`);
  lines.push('', `Состав времени, мин: сбор ${f(row.categories.collect/60)}, ходьба ${f(row.categories.walk/60)}, сдача ${f(row.categories.sell/60)}, меню ${f(row.menu/60)}. Доход: база ${row.normal}, редкости ${row.rare}, событие ${row.eventRevenue}; свинки ${row.pigHay} сена / ${row.bites} укусов. Остались в плане: ${row.unbought.join(', ') || 'нет'}.`, '');
}
const counts = { common:0, uncommon:0, rare:0, legendary:0 }; let exact = 0;
for (let id=0; id<base.totalHay; id++) { const r=strawRarity(id); counts[r.id]++; exact+=r.bonus; }
lines.push('## Проверка предложения и ограничения', '',
  `- Теоретическое ожидание базовой награды редкости: ${base.totalHay * rarityBalance.special.reduce((sum,r)=>sum+r.chance*r.bonus,0)} монет; фактические базовые бонусы всех фиксированных ID в коде: ${exact}. Распределение ID: ${JSON.stringify(counts)}. Полная базовая выручка без улучшений/событий: ${base.totalHay + exact}, а не гарантированные 24 280.`,
  `- Четыре ветки персонажа стоят суммарно 21 170. Инструменты исходного v2 стоят вместе 5 620; revision 2 — ${revised.tools.reduce((sum,tool)=>sum+tool.price,0)}. Максимум всего не требуется и не обещается в одном стоге. Пылесос рассматривается как необязательный.`,
  '- Скорость еды свинок может быть полностью замаскирована прогулкой/подходом во всех трёх сценариях: нельзя продавать эту ветку как финально сбалансированную без реального замера или согласованного изменения AI (Q-002).',
  '- Поздние sale-уровни имеют убывающую ценность: сверять оставшееся сено с 1 200 / 2 000 / 3 000 / 4 400 / 6 400 стеблями простой окупаемости; остаток и альтернативные покупки важнее общего coins/min.',
  '- Изменение рюкзака не увеличивает цену сена, а экономит маршруты; дальность вил/пылесоса уменьшает моделируемый путь только по явно указанной геометрической модели. Реальные препятствия/пикинг требуют измерения.',
  '- Старые сохранения выше caps v2 не моделировались и не менялись. Нужна политика Q-001; престиж не реализуется. Телеметрия/плейтесты ещё не собраны (Q-004).',
  '- Цель 45–60 минут остаётся гипотезой. Нельзя искусственно заставлять игрока ждать ради попадания в число; сначала сравнить таблицу и замерить реальные решения/поездки.', '',
  'Коды покупок: b — рюкзак, m — ходьба, c — сбор, s — продажа, t — инструмент (1–4), v — объём инструмента, x — особенность инструмента, p — следующая свинка, q — общая порция свинок, r — скорость еды. Число у b/m/c/s/t — целевой уровень, у v/x — номер инструмента; повтор v/x покупает следующий уровень.', '');
await writeFile(new URL('../../ECONOMY_SIMULATION_V2.md', import.meta.url), lines.join('\n'), 'utf8');
await writeFile(new URL('../../ECONOMY_SIMULATION_V2.json', import.meta.url), JSON.stringify({ profiles, strategies, runs: runs.map(row => ({ ...row, purchases: row.profile === 'baseline' && row.seed === 17 ? row.purchases : undefined })) }), 'utf8');
console.log(JSON.stringify(runs.filter(r=>r.variant==='v2-revised' && r.profile==='baseline' && r.seed===17).map(r=>({strategy:r.strategy,minutes:+f(r.active/60),earned:r.earned,spent:r.spent,pigHay:r.pigHay})),null,2));

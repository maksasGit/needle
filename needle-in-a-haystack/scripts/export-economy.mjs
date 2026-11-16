// Documentation exporter, not a game build or validation run.
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function config(name) {
  const source = await readFile(new URL(`../src/config/${name}.ts`, import.meta.url), 'utf8');
  const outputText = stripTypeScriptTypes(source, { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { config: base, upgrades, upgradePrice } = await config('balance');
const { toolSpecs, toolUpgradeLimits, toolUpgradePrice, pigBalance, pigUpgrades, pigUpgradePrice } = await config('progression');
const { rarityBalance } = await config('rarity');
const { chestBalance } = await config('chests');
const { metaPrices } = await config('meta');
const names = ['Руки', 'Грабли', 'Вилы', 'Широкие вилы', 'Пылесос'];
const money = n => n.toLocaleString('ru-RU').replaceAll('\u00a0', ' ');
const decimal = (n, digits = 2) => n.toFixed(digits).replace('.', ',');
const lines = [];
const add = (...text) => lines.push(...text);
const table = (headers, rows) => {
  add(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) add(`| ${row.join(' | ')} |`);
  add('');
};
add('# Предметы, цены и улучшения', '',
  'Актуальные покупки из конфигурации игры. Таблицы вычислены функциями `upgradePrice`, `toolUpgradePrice`, `pigUpgradePrice`, включая округление; это экспорт документации, не проверка игры.', '',
  'Источник: `needle-in-a-haystack/src/config/balance.ts`, `progression.ts`, `rarity.ts`; эффекты соответствуют `EconomySystem.ts`. Обновить после изменения баланса: `node scripts/export-economy.mjs` из каталога приложения. Игровой код и цены этот скрипт не меняет.', '',
  'Везде указана цена **одной покупки перехода с предыдущего уровня на указанный**, не общая стоимость с нуля. В таблицах веток отдельно приведена накопленная сумма. Сами инструменты/рюкзак/свинки покупаются у амбара; персонаж, ветки купленных инструментов и свинки улучшаются в книге. Старые покупки учитываются сохранением по прежним ценам, без возврата разницы.', '',
  '## Все покупаемые предметы', '');
table(['Предмет', 'Цена, монеты', 'Базовая порция', 'Время без прокачки персонажа', 'Условие'], [
  [names[0], 'Бесплатно', '1', `${decimal(base.collectionSeconds, 3)} с`, 'Доступны сразу'],
  ...toolSpecs.map((spec, i) => [names[i + 1], money(upgradePrice('tools', i)), `${upgrades.tools.amounts[i + 1]}`, `${decimal(base.collectionSeconds * spec.duration, 4)} с`, i ? `После покупки «${names[i]}»` : 'Первый инструмент']),
  ['Рюкзак', 'Есть с начала', `${base.capacity} мест`, '—', 'Улучшения ниже'],
  ...pigBalance.prices.map((price, i) => [`Свинка №${i + 1}`, money(price), `${pigBalance.portions[i]} за укус`, `${decimal(pigBalance.intervals[i], 1)} с между укусами + ходьба`, i ? `После свинки №${i}` : 'Первая свинка']),
]);
add('Руки и все обычные инструменты: одно нажатие — одна порция, без очереди. **Пылесос: удержание**, новая порция после завершения предыдущей; отпускание останавливает сбор. Реальный объём всегда ограничен свободным рюкзаком и остатком сена. При покупке инструмента руки скрываются; прежние инструменты доступны для экипировки.', '',
  '## Рюкзак — каждый уровень', '', `Старт: ${base.capacity}. Каждый уровень +${upgrades.capacity.step}; уровней ${upgrades.capacity.maxLevel}.`, '');
let total = 0;
table(['Уровень после покупки', 'Цена', 'Всего потрачено на ветку', 'Вместимость'], Array.from({ length: upgrades.capacity.maxLevel }, (_, i) => {
  const price = upgradePrice('capacity', i); total += price;
  return [i + 1, money(price), money(total), base.capacity + (i + 1) * upgrades.capacity.step];
}));
add('## Персонаж — скорость передвижения', '', 'Улучшение добавляет 25% базовой скорости (не умножает уже улучшенную скорость).', '');
total = 0;
table(['Уровень', 'Цена', 'Всего', 'Скорость, м/с'], Array.from({ length: upgrades.movement.maxLevel }, (_, i) => {
  const price = upgradePrice('movement', i); total += price;
  return [i + 1, money(price), money(total), decimal(base.movementSpeed * (1 + (i + 1) * upgrades.movement.step))];
}));
add('## Персонаж — скорость сбора', '', 'Каждый уровень умножает время на 0,9. Таблица показывает время руками; инструмент применяет собственный множитель отдельно.', '');
total = 0;
table(['Уровень', 'Цена', 'Всего', 'Время руками, с'], Array.from({ length: upgrades.collection.maxLevel }, (_, i) => {
  const price = upgradePrice('collection', i); total += price;
  return [i + 1, money(price), money(total), decimal(base.collectionSeconds * upgrades.collection.multiplier ** (i + 1), 4)];
}));
add('## Персонаж — цена продажи', '', 'База: 1 монета за соломинку. Каждый уровень добавляет **25% базовой цены**. Остаток сотых переносится между выплатами, деньги не теряются из-за округления маленьких порций. Цена действует на игрока и базовую оплату съеденного свинками; редкая находка — отдельная награда.', '');
total = 0;
table(['Уровень', 'Цена улучшения', 'Всего', 'Цена соломинки / множитель базы'], Array.from({ length: upgrades.sale.maxLevel }, (_, i) => {
  const price = upgradePrice('sale', i); total += price;
  return [i + 1, money(price), money(total), `×${decimal(1 + (i + 1) * upgrades.sale.step)}`];
}));
add('## Каждый инструмент — две независимые ветки', '',
  'Объём и особенность покупаются раздельно для каждого инструмента; перенос уровней между инструментами отсутствует. Вместимость не растёт от прокачки объёма инструмента.', '');
const specials = [
  level => `+${Math.round(level * toolSpecs[0].rareStep * 100)}% к бонусу редкости (×${decimal(1 + level * toolSpecs[0].rareStep)})`,
  level => `+${decimal(toolSpecs[1].rangeBase + level * toolSpecs[1].rangeStep)} м к дальности сбора`,
  level => `время замаха ×${decimal(toolSpecs[2].specialDuration ** level, 4)} (−${decimal((1 - toolSpecs[2].specialDuration ** level) * 100, 2)}%)`,
  level => `+${decimal(toolSpecs[3].rangeBase + level * toolSpecs[3].rangeStep)} м к дальности сбора`,
];
for (let tool = 1; tool <= toolSpecs.length; tool++) {
  const spec = toolSpecs[tool - 1];
  add(`### ${names[tool]}`, '',
    `Покупка предмета: ${money(upgradePrice('tools', tool - 1))}. Начальная порция ${upgrades.tools.amounts[tool]}, объём +${spec.volumeStep} за уровень. Множитель времени инструмента ×${decimal(spec.duration)}. Особенность: ${specials[tool - 1](0)} до улучшения.`, '');
  let volumeTotal = 0, specialTotal = 0;
  table(['Уровень', 'Объём: цена', 'Объём: всего', 'Порция', 'Особенность: цена', 'Особенность: всего', 'Эффект особенности'], Array.from({ length: Math.max(...Object.values(toolUpgradeLimits)) }, (_, i) => {
    const level = i + 1, volumePrice = toolUpgradePrice(tool, 'volume', i);
    volumeTotal += volumePrice;
    if (level > toolUpgradeLimits.special) return [level, money(volumePrice), money(volumeTotal), upgrades.tools.amounts[tool] + level * spec.volumeStep, '—', '—', `Максимум на уровне ${toolUpgradeLimits.special}`];
    const specialPrice = toolUpgradePrice(tool, 'special', i); specialTotal += specialPrice;
    return [level, money(volumePrice), money(volumeTotal), upgrades.tools.amounts[tool] + level * spec.volumeStep, money(specialPrice), money(specialTotal), specials[tool - 1](level)];
  }));
}
add('Формула времени порции: `0,45 × 0,9^уровень_сбора × множитель_инструмента`; только для широких вил дополнительно `×0,9^уровень_особенности`. Грабли усиливают только награды редкостей, вилы/пылесос — дополнительную дальность, а не движение игрока. Базовый радиус взаимодействия с кучей добавляется отдельно.', '',
  '## Свинки — покупки, эффекты и общие бафы', '',
  `Можно купить максимум ${pigBalance.prices.length}, последовательно. Скорость ходьбы каждой ${decimal(pigBalance.speed, 1)} м/с, отдельной прокачки ходьбы свинок нет. Они подходят к сену, съедают порцию и сразу дают монеты по текущей цене продажи. Съеденное не занимает рюкзак и не попадает в телегу. Редкая соломинка даёт базовый бонус; баф граблей не применяется к свинкам.`, '',
  'Две ветки **общие для всех свинок**, включая будущие покупки; уровни не надо покупать три раза. Укус возможен после подхода, поэтому фактический темп ниже теоретического, указанного интервалом. **Ограничение текущего AI:** после укуса свинка гуляет минимум около 3 секунд до выбора новой цели кормления, затем идёт к ней; прокачка скорости еды сокращает cooldown, но не эту прогулку/поиск. Поэтому высокий уровень скорости не гарантирует пропорциональный рост добычи. В меню/фоне свинки не работают.', '',
  '### Порция: каждый уровень +1 соломинка каждой свинке', '');
total = 0;
table(['Уровень', 'Цена', 'Всего', 'Свинка №1', 'Свинка №2', 'Свинка №3'], Array.from({ length: pigUpgrades.maxLevel }, (_, i) => {
  const level = i + 1, price = pigUpgradePrice('portion', i); total += price;
  return [level, money(price), money(total), ...pigBalance.portions.map(n => n + level * pigUpgrades.portionStep)];
}));
add('### Скорость еды: интервал ×0,9 за уровень', '', 'Время ниже — минимальный промежуток укусов, не гарантированная частота добычи с учётом прогулок.', '');
total = 0;
table(['Уровень', 'Цена', 'Всего', 'Свинка №1, с', 'Свинка №2, с', 'Свинка №3, с'], Array.from({ length: pigUpgrades.maxLevel }, (_, i) => {
  const level = i + 1, price = pigUpgradePrice('speed', i); total += price;
  return [level, money(price), money(total), ...pigBalance.intervals.map(n => decimal(n * pigUpgrades.intervalMultiplier ** level, 4))];
}));
add('## Находки и бонусы — не покупки', '');
table(['Находка', 'Доля по конфигурации', 'Бонус за сбор'], [
  ['Обычная соломинка', '96,2%', 'Нет отдельного бонуса, только продажа'],
  ...[...rarityBalance.special].reverse().map(tier => [({ uncommon: 'Необычная', rare: 'Редкая', legendary: 'Легендарная' })[tier.id], `${decimal(tier.chance * 100, 1)}%`, `+${tier.bonus} монет`]),
  ['Иголка', 'Одна, после полного разбора', 'Победа, не продаётся и не покупается'],
]);
add('Редкости определяются стабильными ID: проценты — параметры распределения, не обещание точного количества в каждом заходе. Бонус граблей округляется вверх для каждой фактически собранной особой соломинки.', '',
  '**Событие ×2:** бесплатно, после обучения; случайное ожидание 3–5 минут активной игры, 45 секунд бонуса. Удваивает только сдачу сена игроком, не доход свинок и не бонусы редкости. Состояние и дробный бонус сохраняются, в меню/фоне время остановлено. Постоянные бафы колодца перечислены ниже.', '',
  'Телега, амбар, декор, руки и иголка не имеют отдельных платных веток улучшений. Платных косметических предметов и покупаемых событий нет. На поздних уровнях таблицы содержат очень высокие цены: это действующая формула, не утверждение о достижимости всех максимумов за один стог. В этой задаче баланс не менялся.', '');
add('## Случайные сундуки (TEAM-02)', '',
  `Один сундук через ${chestBalance.minWait / 60}–${chestBalance.maxWait / 60} минут активной игры после начала/сбора/исчезновения предыдущего. Живёт ${chestBalance.lifetime} секунд. Меню и фон останавливают время; reload сохраняет остаток.`, '',
  `Награда по разобранному сену: до 25% — ${chestBalance.rewards[0]}, 25–50% — ${chestBalance.rewards[1]}, 50–75% — ${chestBalance.rewards[2]}, от 75% — ${chestBalance.rewards[3]} монет. Фиксируется при появлении, выдаётся один раз, ×2 продажи не применяется. Пропуск без штрафа.`, '',
  'Сундуки — дополнительный доход, не покупаемый баф. Существующая симуляция v2 их пока не учитывает; её результаты предшествуют этой механике. Эксперимент v2 не активирован.', '');
add('## Колодец — постоянные покупки за алмазы', '',
  '20 алмазов на новый стог, по +1. Покупки однократные, действуют со следующего захода; алмазы и покупки сохраняются после New Game.', '');
table(['Покупка','Алмазы','Эффект'], [
  ['Быстрые ноги',metaPrices.legs,'Начальная скорость ×1,5'],
  ['Удачный фермер',metaPrices.luck,'Один сундук раз в 90–150 секунд, жизнь 30 секунд'],
  ['Золотое сено',metaPrices.gold,'×2 за продажу на 90 секунд'],
  ['Друзья',metaPrices.friends,'Одна стартовая свинка из предела три'],
  ...metaPrices.tool.map((price,i)=>[['Фермер-любитель','Опытный фермер','Фермер-профессионал','Легенда фермеров'][i],price,`Стартовый инструмент: ${names[i+1]}`]),
]);
add('', 'Инструменты покупаются последовательно; применяется самый высокий. Стартовые предметы не списывают монеты. Свинки оставляют алмазы для игрока. Старые результаты сохранены, новые помечаются стартовыми бафами. Существующая симуляция v2 не учитывает колодец; эксперимент v2 остаётся неактивным.', '');
await writeFile(new URL('../../ECONOMY_CATALOG.md', import.meta.url), lines.join('\n'), 'utf8');
console.log('Updated ECONOMY_CATALOG.md from current price functions.');

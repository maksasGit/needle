export type Language = 'ru' | 'en';
const ru = {
  common: 'Обычная', uncommon: 'Необычная', rare: 'Редкая', legendary: 'Легендарная',
  aimRare: '{rarity} соломинка · +{n} монет',
  rareFound: '+{amount} сена · {rarity}: +{n} монет',
  tagline: 'МАЛЕНЬКАЯ ФЕРМА · БОЛЬШИЕ ПОИСКИ', subtitle: 'Иголка в стоге сена', stage: 'Найди иголку!',
  action: 'Действие · E', coins: 'МОНЕТЫ', inventory: 'В РУКАХ', remaining: 'В СТОГЕ', tool: 'ИНСТРУМЕНТ',
  shop: 'Магазин', help: 'Как играть', settings: 'Настройки', close: 'На ферму', newGame: 'Новая игра',
  confirmReset: 'Начать заново? Текущий прогресс будет удалён.', yes: 'Начать заново', cancel: 'Отмена',
  helpTitle: 'Найди иголку в стоге',
  help1: 'Подойди к стогу и нажми на соломинку или кнопку действия, чтобы собрать одну порцию. Повторяй нажатия — удерживать кнопку не нужно. Соломинка с мятным контуром под прицелом будет собрана первой.',
  help2: 'В руках сначала помещается 5 соломинок. Нажми на телегу, чтобы продать всё. Монеты начисляются сразу, сено аккуратно укладывается в телегу.',
  help3: 'На компьютере ходи клавишами WASD или стрелками, перетаскивай мышью для обзора. На телефоне отклоняй джойстик слева для ходьбы и веди вторым пальцем по сцене для обзора. Нажатия не перемещают персонажа. Ходьба отменяет незавершённый сбор.',
  help4: 'Покупай улучшения. Разбери стог и подбери открывшуюся иголку! Прогресс сохраняется автоматически. В меню и при смене вкладки игра приостанавливается.',
  shopTitle: 'Улучшения фермы', shopHint: 'Каждый тык запускает один сбор. Инструменты увеличивают порцию.',
  capacity: 'Вместимость', movement: 'Скорость ходьбы', collection: 'Скорость сбора', tools: 'Инструмент',
  tool0: 'Руки', tool1: 'Грабли', tool2: 'Вилы', tool3: 'Широкие вилы',
  unit: 'ед.', seconds: 'с', speedUnit: 'м/с', perTap: 'ед./тык', money: 'монет', buy: 'Купить', max: 'Максимальный уровень', missing: 'не хватает {n}',
  ready: 'Подойди к стогу · собери сено и найди иголку', arrived: 'На месте · куда дальше?',
  noPath: 'Сюда не пройти · выбери другую точку', goingHay: 'Иду к стогу · соберу одну порцию', goingCart: 'Иду к телеге · продам всё из рук', going: 'Иду к выбранной точке…',
  full: 'Руки полны · нажми на телегу', closer: 'Подойди ближе к объекту', collecting: 'Собираю одну порцию…',
  sold: '+{n} монет · всё сено продано', empty: 'В руках пусто · нажми на стог', collected: '+{n} сена · нажми на стог ещё раз', collectedFull: '+{n} сена · руки полны, нажми на телегу',
  discovered: 'Стог разобран! Найди блестящую иголку на земле и подбери её', bought: 'Улучшение куплено · {effect}',
  wonTitle: 'Иголка найдена!', wonBody: 'Ты разобрал весь стог и нашёл иголку. Отличная работа!', wonStatus: 'Победа! Игольку нашёл именно ты.',
  reduced: 'Уменьшить анимации', language: 'Язык / Language', saveUnavailable: 'Сохранение недоступно · прогресс останется только в этой вкладке',
  saveInvalid: 'Сохранение повреждено или несовместимо. Начата новая игра.', contextLost: 'Графика временно недоступна. Восстанавливаю…',
  error: 'Не удалось продолжить игру. Попробуй восстановить игру.', retry: 'Восстановить игру', webgl: 'Не удалось запустить WebGL. Проверь аппаратное ускорение браузера.',
  forward: 'Вперёд', back: 'Назад', left: 'Влево', right: 'Вправо', world: 'Ферма: стог, телега и спрятанная иголка',
  saveNotice: 'Автосохранение включено', needle: 'Подобрать иголку',
  aimHay: 'Собрать соломинку', aimCart: 'Продать всё сено',
  jump: 'Прыжок · Пробел. На стог можно забраться',
  joystick: 'Джойстик движения: отклоняй для ходьбы, отпусти для остановки',
} as const;
type Key = keyof typeof ru;
const en: Record<Key, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary',
  aimRare: '{rarity} straw · +{n} coins',
  rareFound: '+{amount} hay · {rarity}: +{n} coins',
  tagline: 'SMALL FARM · BIG SEARCH', subtitle: 'Find the needle in the haystack', stage: 'Find the needle!',
  action: 'Interact · E', coins: 'COINS', inventory: 'CARRYING', remaining: 'HAY LEFT', tool: 'TOOL',
  shop: 'Shop', help: 'How to play', settings: 'Settings', close: 'Back to farm', newGame: 'New game', confirmReset: 'Start over? Your current progress will be deleted.', yes: 'Start over', cancel: 'Cancel',
  helpTitle: 'Find the needle in the haystack',
  help1: 'Walk up to the pile and tap a straw or Interact to collect one portion. Tap again for each action; holding does not collect. The mint-outlined straw under the crosshair is collected first.',
  help2: 'You can initially carry 5 straws. Tap the cart to sell everything. Coins arrive immediately while hay is stacked neatly in the cart.',
  help3: 'Desktop: walk with WASD or arrow keys, and drag the mouse to look. Mobile: use the left joystick to walk and drag the scene with a second finger to look. Taps never move the player. Walking cancels unfinished collection. Jump with Space or the arrow button; you can climb onto the hay.',
  help4: 'Buy upgrades, clear the pile, then pick up the revealed needle! Progress saves automatically. Menus and background tabs pause the game.',
  shopTitle: 'Farm upgrades', shopHint: 'One tap starts one collection. Better tools collect more per action.',
  capacity: 'Carry capacity', movement: 'Walking speed', collection: 'Collection speed', tools: 'Tool',
  tool0: 'Hands', tool1: 'Rake', tool2: 'Pitchfork', tool3: 'Wide pitchfork', unit: 'units', seconds: 's', speedUnit: 'm/s', perTap: 'units/tap', money: 'coins', buy: 'Buy', max: 'Maximum level', missing: 'need {n} more',
  ready: 'Walk up to the hay · collect straws and find the needle', arrived: 'Arrived · where next?', noPath: 'Cannot reach that spot · choose another',
  goingHay: 'Walking to hay · will collect one portion', goingCart: 'Walking to cart · will sell everything', going: 'Walking to destination…',
  full: 'Hands full · tap the cart', closer: 'Move closer to interact', collecting: 'Collecting one portion…', sold: '+{n} coins · all hay sold', empty: 'Nothing to sell · tap the hay',
  collected: '+{n} hay · tap the pile again', collectedFull: '+{n} hay · hands full, tap the cart', discovered: 'Pile cleared! Find the shining needle on the ground and pick it up', bought: 'Upgrade purchased · {effect}',
  wonTitle: 'You found the needle!', wonBody: 'You cleared the entire haystack and found the needle. Well done!', wonStatus: 'Victory! The needle is yours.',
  reduced: 'Reduce animations', language: 'Language / Язык', saveUnavailable: 'Saving unavailable · progress lasts only in this tab', saveInvalid: 'Save is damaged or incompatible. A new game was started.',
  contextLost: 'Graphics temporarily unavailable. Restoring…', error: 'The game could not continue. Try recovering the game.', retry: 'Recover game', webgl: 'Could not start WebGL. Check browser hardware acceleration.',
  forward: 'Forward', back: 'Back', left: 'Left', right: 'Right', world: 'Farm: haystack, cart and a hidden needle', saveNotice: 'Autosave enabled', needle: 'Pick up needle',
  aimHay: 'Collect straw', aimCart: 'Sell all hay',
  jump: 'Jump · Space. You can climb onto the hay',
  joystick: 'Movement joystick: drag to walk, release to stop',
};
let language: Language = 'ru';
export function setLanguage(value: Language) { language = value; document.documentElement.lang = value; }
export function getLanguage() { return language; }
export function t(key: Key, vars: Record<string, string | number> = {}): string {
  let value: string = (language === 'en' ? en : ru)[key];
  for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}
export function toolName(level: number) { return t((`tool${level}`) as 'tool0'); }

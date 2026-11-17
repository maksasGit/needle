import { validateMeta, validMemory } from './MetaProgress';
import type { MetaProfile, GemState } from './MetaProgress';
import type { MetaBuffs } from '../config/meta';
import { validateRun } from './RunRecords';
import type { RunState } from './RunRecords';
import { config, upgrades, upgradePrice, previousUpgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import type { Language } from '../ui/i18n';
import { maxDiscoveryBonus, rarityVersion } from '../config/rarity';
import { pigBalance, preDiscountPigPrices, pigUpgrades, pigUpgradePrice, toolUpgradeLimits, toolUpgradePrice } from '../config/progression';
import { upgrades as oldUpgrades, upgradePrice as oldUpgradePrice } from '../config/legacyBalance';
import { pigBalance as oldPigs, toolUpgradePrice as oldToolPrice, toolUpgradeLimits as oldToolLimits } from '../config/legacyProgression';
import { previousToolUpgradePrice, previousPigUpgradePrice, previousPigPrices } from '../config/progression';
import type { SaleEventState } from './SaleEvent';
import { saleEvent } from '../config/presentation';
import { validateChestLedger } from './ChestEvent';
import type { ChestState } from './ChestEvent';
export const SAVE_KEY = 'needle.save.v1';
export type LegacyProgress = { levels: Record<UpgradeId, number>; toolVolumes: number[]; toolSpecials: number[]; pigCount: number };
export type PriceBaseline = LegacyProgress & { pigPortionLevel: number; pigSpeedLevel: number };
export type SaveData = {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; hay: string; inventory: number; coins: number; levels: Record<UpgradeId, number>;
  position: [number, number]; yaw: number; pitch: number; won: boolean;
  hayContactScale?: number;
  totalHay?: number;
  hayProfile?: number;
  discoveryCoins?: number;
  rarityVersion?: number;
  saleRevenue?: number;
  activeTool?: number;
  toolVolumes?: number[];
  toolSpecials?: number[];
  pigCount?: number;
  pigPriceBaseline?: number;
  startProgress?: PriceBaseline;
  pigEaten?: number;
  pigPortionLevel?: number;
  pigSpeedLevel?: number;
  saleRemainder?: number;
  legacyProgress?: LegacyProgress;
  priceBaseline?: PriceBaseline;
  layoutVersion?: number;
  eventRevenue?: number;
  eventRemainder?: number;
  saleEvent?: SaleEventState;
  meta?: MetaProfile;
  buffs?: MetaBuffs;
  gems?: GemState;
  run?: RunState;
  chestRevenue?: number;
  chestClaims?: number[];
  chestState?: ChestState;
};
export type Settings = { language: Language; reducedMotion: boolean; musicEnabled: boolean; musicVolume: number; effectsEnabled: boolean; effectsVolume: number; economyTelemetry?: boolean };
const MAX_BYTES = 500 * 1024;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function decodeHay(value: string): Int16Array {
  if (value.length > 4 * Math.ceil(config.totalHay * 16 / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid hay encoding');
  const binary = atob(value);
  if (binary.length % 16 !== 0 || binary.length > config.totalHay * 16) throw new Error('Invalid hay length');
  const result = new Int16Array(binary.length / 2);
  const seen = new Set<number>();
  for (let offset = 0; offset < binary.length; offset += 2) {
    const raw = binary.charCodeAt(offset) | binary.charCodeAt(offset + 1) << 8;
    result[offset / 2] = raw > 32767 ? raw - 65536 : raw;
  }
  for (let i = 0; i < result.length; i += 8) {
    if (!integer(result[i], 0, config.totalHay - 1) || seen.has(result[i]) || !integer(result[i + 1], 0, 2000)) throw new Error('Invalid straw identity');
    seen.add(result[i]);
    const horizontalLimit = Math.max(1600, Math.ceil((config.hayVisual.radius + config.hayVisual.horizontalJitter) * 1000));
    if (Math.abs(result[i + 2]) > horizontalLimit || result[i + 3] < 0 || result[i + 3] > 5000 || Math.abs(result[i + 4]) > horizontalLimit) throw new Error('Invalid straw position');
    for (let j = 5; j < 8; j++) if (Math.abs(result[i + j]) > 3142) throw new Error('Invalid straw rotation');
  }
  return result;
}
export function validateSave(value: unknown): SaveData {
  if (!value || typeof value !== 'object') throw new Error('Invalid save');
  const source = value as SaveData;
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(source.version) || typeof source.hay !== 'string' || !source.levels) throw new Error('Unsupported save');
  const s: SaveData = { ...source, levels: { ...source.levels, sale: source.levels.sale ?? 0 } };
  if (s.layoutVersion !== undefined && !integer(s.layoutVersion, 0, config.layoutVersion)) throw new Error('Invalid map layout');
  if (s.rarityVersion !== undefined && s.rarityVersion !== rarityVersion) throw new Error('Unsupported rarity version');
  if (s.hayProfile !== undefined && !integer(s.hayProfile, 0, config.hayVisual.profileVersion)) throw new Error('Invalid hay profile');
  if (s.hayContactScale !== undefined && (!Number.isFinite(s.hayContactScale) || s.hayContactScale < 0.25 || s.hayContactScale > 1)) throw new Error('Invalid hay contact scale');
  for (const id of Object.keys(upgrades) as UpgradeId[]) if (!integer(s.levels[id], 0, upgrades[id].maxLevel)) throw new Error('Invalid level');
  const total = s.totalHay ?? 10000;
  if (!integer(total, 1, config.totalHay)) throw new Error('Invalid hay total');
  const hay = decodeHay(s.hay);
  for (let i = 0; i < hay.length; i += 8) if (hay[i] >= total) throw new Error('Straw outside saved hay total');
  const remaining = hay.length / 8;
  if (source.version < 6 && (s.chestState !== undefined || s.chestRevenue !== undefined || s.chestClaims !== undefined)) throw new Error('Unexpected legacy chest data');
  s.chestRevenue ??= 0; s.chestClaims ??= [0, 0, 0, 0];
  validateChestLedger(s.chestState, s.chestClaims, s.chestRevenue, remaining, total);
  if(source.version<8 && (s.meta!==undefined||s.buffs!==undefined||s.gems!==undefined))throw new Error('Unexpected legacy meta');
  if(source.version>=8 && (!s.meta||!s.buffs||!s.gems))throw new Error('Missing meta state');
  validateMeta(s.meta,s.buffs,s.gems);
  const capacity = config.capacity + s.levels.capacity * upgrades.capacity.step;
  const discoveryCoins = s.discoveryCoins ?? 0;
  if (!integer(discoveryCoins, 0, (total - remaining) * maxDiscoveryBonus * 2)) throw new Error('Invalid discovery ledger');
  if (!integer(s.inventory, 0, capacity) || remaining + s.inventory > total) throw new Error('Invalid economy');
  const consumed = total - remaining - s.inventory;
  s.saleRevenue ??= consumed * config.salePrice;
  if(source.version<9 && s.pigPriceBaseline!==undefined)throw new Error('Unexpected pig price baseline');
  s.pigPriceBaseline=source.version<9?(s.pigCount??0):(s.pigPriceBaseline??0);
  if(!integer(s.pigPriceBaseline,0,s.pigCount??0))throw new Error('Invalid pig price baseline');
  s.pigCount ??= 0; s.pigEaten ??= 0; s.activeTool ??= s.levels.tools;
  s.eventRevenue ??= 0; s.eventRemainder ??= 0;
  if (!integer(s.eventRevenue, 0, Number.MAX_SAFE_INTEGER) || !integer(s.eventRemainder, 0, 99) || (source.version < 5 && (s.eventRevenue || s.eventRemainder || s.saleEvent !== undefined))) throw new Error('Invalid event ledger');
  if (s.saleEvent !== undefined) {
    const event = s.saleEvent;
    if (!event || !Number.isFinite(event.wait) || !Number.isFinite(event.remaining) || event.wait < 0 || event.wait > saleEvent.maxWait || event.remaining < 0 || event.remaining > saleEvent.duration * (s.buffs?.gold ? 2 : 1) || (event.remaining > 0 && event.wait !== 0)) throw new Error('Invalid sale event');
  }
  s.pigPortionLevel ??= 0; s.pigSpeedLevel ??= 0; s.saleRemainder ??= 0;
  if (!integer(s.pigPortionLevel, 0, pigUpgrades.maxLevel) || !integer(s.pigSpeedLevel, 0, pigUpgrades.maxLevel) || (!s.pigCount && (s.pigPortionLevel || s.pigSpeedLevel)) || !integer(s.saleRemainder, 0, source.version < 4 ? 9 : 99)) throw new Error('Invalid helper upgrades');
  if (!integer(s.coins, 0, s.saleRevenue + discoveryCoins + s.eventRevenue + s.chestRevenue) || !integer(s.pigCount, 0, pigBalance.prices.length) || !integer(s.pigEaten, 0, consumed) || (!s.pigCount && s.pigEaten)) throw new Error('Invalid helper economy');
  if (!integer(s.activeTool, 0, s.levels.tools)) throw new Error('Invalid active tool');
  const validateToolLevels = (levels: number[] | undefined, max: number) => {
    const result = levels ?? [0, 0, 0, 0];
    if (!Array.isArray(result) || result.length !== 4 || result.some((level, i) => !integer(level, 0, max) || (i >= s.levels.tools && level !== 0))) throw new Error('Invalid tool upgrades');
    return [...result];
  };
  s.toolVolumes = validateToolLevels(s.toolVolumes, toolUpgradeLimits.volume);
  s.toolSpecials = validateToolLevels(s.toolSpecials, toolUpgradeLimits.special);
  if (source.version < 3) {
    if (s.pigPortionLevel || s.pigSpeedLevel || s.saleRemainder) throw new Error('Invalid legacy upgrades');
    s.legacyProgress = { levels: { ...s.levels }, toolVolumes: [...s.toolVolumes], toolSpecials: [...s.toolSpecials], pigCount: s.pigCount };
  }
  const legacy = s.legacyProgress;
  if (legacy) {
    if (!legacy.levels || !integer(legacy.pigCount, 0, s.pigCount)) throw new Error('Invalid legacy progress');
    for (const id of Object.keys(upgrades) as UpgradeId[]) if (!integer(legacy.levels[id], 0, Math.min(s.levels[id], oldUpgrades[id].maxLevel))) throw new Error('Invalid legacy level');
    for (const [levels, current, max] of [[legacy.toolVolumes, s.toolVolumes, oldToolLimits.volume], [legacy.toolSpecials, s.toolSpecials, oldToolLimits.special]] as const) {
      if (!Array.isArray(levels) || levels.length !== 4 || levels.some((level, i) => !integer(level, 0, Math.min(current[i], max)) || (i >= legacy.levels.tools && level !== 0))) throw new Error('Invalid legacy tool upgrades');
    }
  }
  if (source.version < 4) {
    s.priceBaseline = { levels: { ...s.levels }, toolVolumes: [...s.toolVolumes], toolSpecials: [...s.toolSpecials], pigCount: s.pigCount, pigPortionLevel: s.pigPortionLevel, pigSpeedLevel: s.pigSpeedLevel };
    s.saleRemainder *= 10;
  }
  const baseline = s.priceBaseline;
  if (baseline) {
    if (!baseline.levels || !integer(baseline.pigCount, legacy?.pigCount ?? 0, s.pigCount) || !integer(baseline.pigPortionLevel, 0, s.pigPortionLevel) || !integer(baseline.pigSpeedLevel, 0, s.pigSpeedLevel) || (!baseline.pigCount && (baseline.pigPortionLevel || baseline.pigSpeedLevel))) throw new Error('Invalid price baseline');
    for (const id of Object.keys(upgrades) as UpgradeId[]) if (!integer(baseline.levels[id], legacy?.levels[id] ?? 0, s.levels[id])) throw new Error('Invalid baseline level');
    for (const kind of ['toolVolumes', 'toolSpecials'] as const) {
      if (!Array.isArray(baseline[kind]) || baseline[kind].length !== 4 || baseline[kind].some((level, i) => !integer(level, legacy?.[kind][i] ?? 0, s[kind]![i]) || (i >= baseline.levels.tools && level !== 0))) throw new Error('Invalid baseline tools');
    }
  }
  if (legacy && !baseline) throw new Error('Missing price baseline');
  const maxRevenue = Math.max(Math.floor(consumed * (100 + s.levels.sale * 25) / 100), consumed * (legacy ? 1 + legacy.levels.sale : 1));
  if (!integer(s.saleRevenue, consumed, maxRevenue)) throw new Error('Invalid sales ledger');
  if (s.eventRevenue > maxRevenue) throw new Error('Invalid event revenue');
  const cost = (progress: LegacyProgress, old: boolean, previous = false) => {
    let spent = 0;
    for (const id of Object.keys(upgrades) as UpgradeId[]) for (let level = 0; level < progress.levels[id]; level++) spent += (old ? oldUpgradePrice : previous ? previousUpgradePrice : upgradePrice)(id, level);
    for (let tool = 1; tool <= 4; tool++) {
      for (let level = 0; level < progress.toolVolumes[tool - 1]; level++) spent += (old ? oldToolPrice : previous ? previousToolUpgradePrice : toolUpgradePrice)(tool, 'volume', level);
      for (let level = 0; level < progress.toolSpecials[tool - 1]; level++) spent += (old ? oldToolPrice : previous ? previousToolUpgradePrice : toolUpgradePrice)(tool, 'special', level);
    }
    for (let pig = 0; pig < progress.pigCount; pig++) spent += (old ? oldPigs.prices : previous ? previousPigPrices : (pig < s.pigPriceBaseline! ? preDiscountPigPrices : pigBalance.prices))[pig];
    return spent;
  };
  let spent = cost({ levels: s.levels, toolVolumes: s.toolVolumes, toolSpecials: s.toolSpecials, pigCount: s.pigCount }, false);
  if (baseline) spent += cost(baseline, false, true) - cost(baseline, false);
  if (legacy) spent += cost(legacy, true) - cost(legacy, false, true);
  for (let level = 0; level < s.pigPortionLevel; level++) spent += (level < (baseline?.pigPortionLevel ?? 0) ? previousPigUpgradePrice : pigUpgradePrice)('portion', level);
  for (let level = 0; level < s.pigSpeedLevel; level++) spent += (level < (baseline?.pigSpeedLevel ?? 0) ? previousPigUpgradePrice : pigUpgradePrice)('speed', level);
  const startTool=s.buffs?.tool??0, startPig=s.buffs?.friends?1:0;
  if(s.buffs?.memory && !s.startProgress)throw new Error('Missing memory starting progress');
  if(startTool>s.levels.tools||startPig>s.pigCount)throw new Error('Missing starting items');
  if(s.startProgress!==undefined){
    const start=s.startProgress;
    if(!s.buffs?.memory||!validMemory(start)||Object.keys(upgrades).some(k=>start.levels[k as UpgradeId]>s.levels[k as UpgradeId])||start.pigCount>s.pigCount||start.pigPortionLevel>s.pigPortionLevel||start.pigSpeedLevel>s.pigSpeedLevel||start.toolVolumes.some((n,i)=>n>s.toolVolumes![i])||start.toolSpecials.some((n,i)=>n>s.toolSpecials![i]))throw new Error('Invalid free starting progress');
    spent-=cost(start,false);
    for(let level=0;level<start.pigPortionLevel;level++)spent-=pigUpgradePrice('portion',level);
    for(let level=0;level<start.pigSpeedLevel;level++)spent-=pigUpgradePrice('speed',level);
  }else{
  for(let level=0;level<startTool;level++)spent-=upgradePrice('tools',level);
  for(let pig=0;pig<startPig;pig++)spent-=(pig<s.pigPriceBaseline?preDiscountPigPrices:pigBalance.prices)[pig];
  }
  if(source.version<9&&(s.startProgress!==undefined||s.buffs?.memory||s.meta?.bought.memory))throw new Error('Unexpected legacy memory');
  const income = s.saleRevenue + discoveryCoins + s.eventRevenue + s.chestRevenue;
  if (!Number.isSafeInteger(income) || !Number.isSafeInteger(s.coins + spent) || s.coins + spent !== income) throw new Error('Unbalanced economy');
  if (!Array.isArray(s.position) || s.position.length !== 2 || s.position.some(v => !Number.isFinite(v) || Math.abs(v) > config.worldHalfSize)) throw new Error('Invalid position');
  if (!Number.isFinite(s.yaw) || !Number.isFinite(s.pitch) || Math.abs(s.pitch) > 1.25 || typeof s.won !== 'boolean' || (s.won && remaining > 0)) throw new Error('Invalid camera/progress');
  if (source.version < 7 && s.run !== undefined) throw new Error('Unexpected legacy run');
  validateRun(s.run, s.won);
  if(s.buffs && ['legs','luck','gold','friends','memory','tool'].some(k=>(s.run?.buffs?.[k as keyof MetaBuffs]??(k==='tool'?0:false))!==(s.buffs![k as keyof MetaBuffs]??(k==='tool'?0:false))))throw new Error('Run buffs mismatch');
  return s;
}
export class SaveSystem {
  available = true;
  invalid = false;
  read(): SaveData | undefined {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      try {
        if (raw.length > MAX_BYTES) throw new Error('Save too large');
        return validateSave(JSON.parse(raw));
      } catch { this.invalid = true; return; }
    } catch { this.available = false; return; }
  }
  write(save: SaveData) {
    try {
      const raw = JSON.stringify(save);
      if (raw.length > MAX_BYTES) throw new Error('Save too large');
      localStorage.setItem(SAVE_KEY, raw); return true;
    } catch { this.available = false; return false; }
  }
  readSettings(): Settings {
    try {
      const s = JSON.parse(localStorage.getItem('needle.settings.v1') || 'null');
      return { language: s?.language === 'en' ? 'en' : 'ru', reducedMotion: typeof s?.reducedMotion === 'boolean' ? s.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches,
        musicEnabled: typeof s?.musicEnabled === 'boolean' ? s.musicEnabled : true,
        musicVolume: typeof s?.musicVolume === 'number' && Number.isFinite(s.musicVolume) ? Math.max(0, Math.min(1, s.musicVolume)) : .25,
        effectsEnabled: typeof s?.effectsEnabled === 'boolean' ? s.effectsEnabled : true,
        economyTelemetry: s?.economyTelemetry === true,
        effectsVolume: typeof s?.effectsVolume === 'number' && Number.isFinite(s.effectsVolume) ? Math.max(0, Math.min(1, s.effectsVolume)) : .6 };
    } catch { return { language: 'ru', reducedMotion: false, musicEnabled: true, musicVolume: .25, effectsEnabled: true, effectsVolume: .6 }; }
  }
  writeSettings(s: Settings) { try { localStorage.setItem('needle.settings.v1', JSON.stringify(s)); } catch { this.available = false; } }
}

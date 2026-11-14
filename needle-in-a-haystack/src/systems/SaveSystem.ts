import { config, upgrades, upgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import type { Language } from '../ui/i18n';
import { maxDiscoveryBonus, rarityVersion } from '../config/rarity';
import { pigBalance, toolUpgradeLimits, toolUpgradePrice } from '../config/progression';
export const SAVE_KEY = 'needle.save.v1';
export type SaveData = {
  version: 1 | 2; hay: string; inventory: number; coins: number; levels: Record<UpgradeId, number>;
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
  pigEaten?: number;
};
export type Settings = { language: Language; reducedMotion: boolean; musicEnabled: boolean; musicVolume: number };
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
  if ((source.version !== 1 && source.version !== 2) || typeof source.hay !== 'string' || !source.levels) throw new Error('Unsupported save');
  const s: SaveData = { ...source, levels: { ...source.levels, sale: source.levels.sale ?? 0 } };
  if (s.rarityVersion !== undefined && s.rarityVersion !== rarityVersion) throw new Error('Unsupported rarity version');
  if (s.hayProfile !== undefined && !integer(s.hayProfile, 0, config.hayVisual.profileVersion)) throw new Error('Invalid hay profile');
  if (s.hayContactScale !== undefined && (!Number.isFinite(s.hayContactScale) || s.hayContactScale < 0.25 || s.hayContactScale > 1)) throw new Error('Invalid hay contact scale');
  for (const id of Object.keys(upgrades) as UpgradeId[]) if (!integer(s.levels[id], 0, upgrades[id].maxLevel)) throw new Error('Invalid level');
  const total = s.totalHay ?? 10000;
  if (!integer(total, 1, config.totalHay)) throw new Error('Invalid hay total');
  const hay = decodeHay(s.hay);
  for (let i = 0; i < hay.length; i += 8) if (hay[i] >= total) throw new Error('Straw outside saved hay total');
  const remaining = hay.length / 8;
  const capacity = config.capacity + s.levels.capacity * upgrades.capacity.step;
  const discoveryCoins = s.discoveryCoins ?? 0;
  if (!integer(discoveryCoins, 0, (total - remaining) * maxDiscoveryBonus * 2)) throw new Error('Invalid discovery ledger');
  if (!integer(s.inventory, 0, capacity) || remaining + s.inventory > total) throw new Error('Invalid economy');
  const consumed = total - remaining - s.inventory;
  s.saleRevenue ??= consumed * config.salePrice;
  s.pigCount ??= 0; s.pigEaten ??= 0; s.activeTool ??= s.levels.tools;
  if (!integer(s.saleRevenue, consumed * config.salePrice, consumed * (config.salePrice + s.levels.sale * upgrades.sale.step))) throw new Error('Invalid sales ledger');
  if (!integer(s.coins, 0, s.saleRevenue + discoveryCoins) || !integer(s.pigCount, 0, pigBalance.prices.length) || !integer(s.pigEaten, 0, consumed) || (!s.pigCount && s.pigEaten)) throw new Error('Invalid helper economy');
  if (!integer(s.activeTool, 0, s.levels.tools)) throw new Error('Invalid active tool');
  const validateToolLevels = (levels: number[] | undefined, max: number) => {
    const result = levels ?? [0, 0, 0, 0];
    if (!Array.isArray(result) || result.length !== 4 || result.some((level, i) => !integer(level, 0, max) || (i >= s.levels.tools && level !== 0))) throw new Error('Invalid tool upgrades');
    return [...result];
  };
  s.toolVolumes = validateToolLevels(s.toolVolumes, toolUpgradeLimits.volume);
  s.toolSpecials = validateToolLevels(s.toolSpecials, toolUpgradeLimits.special);
  let spent = 0;
  for (const id of Object.keys(upgrades) as UpgradeId[]) for (let level = 0; level < s.levels[id]; level++) spent += upgradePrice(id, level);
  for (let tool = 1; tool <= 4; tool++) {
    for (let level = 0; level < s.toolVolumes[tool - 1]; level++) spent += toolUpgradePrice(tool, 'volume', level);
    for (let level = 0; level < s.toolSpecials[tool - 1]; level++) spent += toolUpgradePrice(tool, 'special', level);
  }
  for (let pig = 0; pig < s.pigCount; pig++) spent += pigBalance.prices[pig];
  if (s.coins + spent !== s.saleRevenue + discoveryCoins) throw new Error('Unbalanced economy');
  if (!Array.isArray(s.position) || s.position.length !== 2 || s.position.some(v => !Number.isFinite(v) || Math.abs(v) > config.worldHalfSize)) throw new Error('Invalid position');
  if (!Number.isFinite(s.yaw) || !Number.isFinite(s.pitch) || Math.abs(s.pitch) > 1.25 || typeof s.won !== 'boolean' || (s.won && remaining > 0)) throw new Error('Invalid camera/progress');
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
        musicVolume: typeof s?.musicVolume === 'number' && Number.isFinite(s.musicVolume) ? Math.max(0, Math.min(1, s.musicVolume)) : .25 };
    } catch { return { language: 'ru', reducedMotion: false, musicEnabled: true, musicVolume: .25 }; }
  }
  writeSettings(s: Settings) { try { localStorage.setItem('needle.settings.v1', JSON.stringify(s)); } catch { this.available = false; } }
}

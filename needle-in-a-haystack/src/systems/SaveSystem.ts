import { config, upgrades, upgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import type { Language } from '../ui/i18n';
export const SAVE_KEY = 'needle.save.v1';
export type SaveData = {
  version: 1; hay: string; inventory: number; coins: number; levels: Record<UpgradeId, number>;
  position: [number, number]; yaw: number; pitch: number; won: boolean;
  hayContactScale?: number;
  totalHay?: number;
};
export type Settings = { language: Language; reducedMotion: boolean };
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
    if (Math.abs(result[i + 2]) > 1600 || result[i + 3] < 0 || result[i + 3] > 5000 || Math.abs(result[i + 4]) > 1600) throw new Error('Invalid straw position');
    for (let j = 5; j < 8; j++) if (Math.abs(result[i + j]) > 3142) throw new Error('Invalid straw rotation');
  }
  return result;
}
export function validateSave(value: unknown): SaveData {
  if (!value || typeof value !== 'object') throw new Error('Invalid save');
  const s = value as SaveData;
  if (s.version !== 1 || typeof s.hay !== 'string' || !s.levels) throw new Error('Unsupported save');
  if (s.hayContactScale !== undefined && (!Number.isFinite(s.hayContactScale) || s.hayContactScale < 0.25 || s.hayContactScale > 1)) throw new Error('Invalid hay contact scale');
  for (const id of Object.keys(upgrades) as UpgradeId[]) if (!integer(s.levels[id], 0, upgrades[id].maxLevel)) throw new Error('Invalid level');
  const total = s.totalHay ?? 10000;
  if (!integer(total, 1, config.totalHay)) throw new Error('Invalid hay total');
  const hay = decodeHay(s.hay);
  for (let i = 0; i < hay.length; i += 8) if (hay[i] >= total) throw new Error('Straw outside saved hay total');
  const remaining = hay.length / 8;
  const capacity = config.capacity + s.levels.capacity * upgrades.capacity.step;
  if (!integer(s.inventory, 0, capacity) || !integer(s.coins, 0, total * config.salePrice) || remaining + s.inventory > total) throw new Error('Invalid economy');
  let spent = 0;
  for (const id of Object.keys(upgrades) as UpgradeId[]) for (let level = 0; level < s.levels[id]; level++) spent += upgradePrice(id, level);
  if (s.coins + spent !== (total - remaining - s.inventory) * config.salePrice) throw new Error('Unbalanced economy');
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
      return { language: s?.language === 'en' ? 'en' : 'ru', reducedMotion: typeof s?.reducedMotion === 'boolean' ? s.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches };
    } catch { return { language: 'ru', reducedMotion: false }; }
  }
  writeSettings(s: Settings) { try { localStorage.setItem('needle.settings.v1', JSON.stringify(s)); } catch { this.available = false; } }
}

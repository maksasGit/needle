import type { MetaBuffs } from '../config/meta';
import { validBuffs } from './MetaProgress';
import { recordsConfig } from '../config/records';

export type RunState = { id: string; activeMs: number; eligible: boolean; playtestId?:string; playtestSegment?:number; finished: boolean; buffs?: MetaBuffs; rules: string };
type PersonalRecord = { id: string; activeMs: number; buffs?: MetaBuffs; rules: string };
const KEY = 'needle.records.v1';
let memory: PersonalRecord[] = [];
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
const validTime = (ms: unknown): ms is number => typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 && ms <= Number.MAX_SAFE_INTEGER;
export function validateRun(value: unknown, won: boolean): asserts value is RunState | undefined {
  if (value === undefined) return;
  const run = value as RunState;
  if (!run || typeof run !== 'object' || !validId(run.id) || !validTime(run.activeMs) || typeof run.eligible !== 'boolean' || run.finished !== won || run.rules !== recordsConfig.rules || (run.buffs!==undefined&&!validBuffs(run.buffs))) throw new Error('Invalid run timer');
  if(run.playtestId!==undefined&&(!validId(run.playtestId)||!Number.isSafeInteger(run.playtestSegment)||(run.playtestSegment??0)<1))throw new Error('Invalid playtest link');
}
/** Active wall time, independent of capped physics delta. Settle at every lifecycle boundary. */
export class RunClock {
  readonly state: RunState;
  private previous = performance.now();
  private running = false;
  constructor(saved?: RunState, eligible = true) {
    this.state = saved ? { ...saved } : { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, activeMs: 0, eligible, finished: false, rules: recordsConfig.rules };
  }
  settle() { const now = performance.now(); if (this.running && !this.state.finished) this.state.activeMs += Math.max(0, now - this.previous); this.previous = now; }
  setRunning(running: boolean) { this.settle(); this.running = running && !this.state.finished; }
  finish() { this.settle(); this.state.finished = true; this.running = false; }
  snapshot() { this.settle(); return { ...this.state }; }
}
export class RunRecords {
  available = true;
  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && raw.length <= 8192) {
        const data: unknown = JSON.parse(raw);
        if (Array.isArray(data) && data.length <= recordsConfig.limit && data.every(r => r && validId(r.id) && validTime(r.activeMs) && r.activeMs > 0 && (r.rules === recordsConfig.rules) && (r.buffs===undefined||validBuffs(r.buffs))) && new Set(data.map(r => r.id)).size === data.length) memory = data;
      }
    } catch { this.available = false; }
  }
  list() { return memory.filter(r => (r.rules === recordsConfig.rules) && (r.buffs===undefined||validBuffs(r.buffs))).sort((a,b) => a.activeMs - b.activeMs || a.id.localeCompare(b.id)).slice(0, recordsConfig.limit).map(r => ({ ...r })); }
  record(run: RunState) {
    if (!run.eligible || !run.finished || run.activeMs <= 0 || run.rules !== recordsConfig.rules) return;
    const result = { id: run.id, activeMs: Math.round(run.activeMs), buffs:run.buffs?{...run.buffs}:undefined, rules: run.rules };
    memory = [...this.list().filter(r => r.id !== run.id), result].sort((a,b) => a.activeMs - b.activeMs || a.id.localeCompare(b.id)).slice(0, recordsConfig.limit);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); this.available = true;return true; } catch { this.available = false;return false; }
  }
}
export function recordTime(ms: number) {
  const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`;
}

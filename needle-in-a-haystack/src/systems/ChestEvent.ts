import { chestBalance, chestStage } from '../config/chests';

export type ActiveChest = { id: number; position: number; stage: number; remaining: number };
export type ChestState = { wait: number; sequence: number; randomState: number; active?: ActiveChest };

/** At most one chest. All time is active game time; snapshots include RNG and lifetime. */
export class ChestEvent {
  private state: ChestState;
  constructor(saved?: ChestState, private waitMultiplier = 1) {
    if (saved) this.state = { ...saved, active: saved.active ? { ...saved.active } : undefined };
    else { this.state = { wait: 0, sequence: 0, randomState: Math.floor(Math.random() * 4294967296) }; this.state.wait = this.nextWait(); }
  }
  private random() { this.state.randomState = (Math.imul(this.state.randomState, 1664525) + 1013904223) >>> 0; return this.state.randomState / 4294967296; }
  private nextWait() { return (chestBalance.minWait + this.random() * (chestBalance.maxWait - chestBalance.minWait)) * this.waitMultiplier; }
  get active(): Readonly<ActiveChest> | undefined { return this.state.active; }
  update(dt: number, remaining: number, total: number, canSpawn: (index: number) => boolean): 'spawn' | 'expire' | undefined {
    if (this.state.active) {
      this.state.active.remaining = Math.max(0, this.state.active.remaining - dt);
      if (!this.state.active.remaining) { this.state.active = undefined; this.state.wait = this.nextWait(); return 'expire'; }
    } else {
      this.state.wait = Math.max(0, this.state.wait - dt);
      if (!this.state.wait) {
        const positions = chestBalance.positions.map((_, index) => index).filter(canSpawn);
        if (!positions.length) { this.state.wait = chestBalance.retrySeconds; return; }
        this.state.active = { id: ++this.state.sequence, position: positions[Math.floor(this.random() * positions.length)], stage: chestStage(remaining, total), remaining: chestBalance.lifetime };
        return 'spawn';
      }
    }
  }
  claim(id: number, award: (stage: number) => number) {
    const active = this.state.active;
    if (!active || active.id !== id || active.remaining <= 0) return 0;
    const amount = award(active.stage);
    if (amount <= 0) return 0;
    this.state.active = undefined; this.state.wait = this.nextWait();
    return amount;
  }
  snapshot(): ChestState { return { ...this.state, active: this.state.active ? { ...this.state.active } : undefined }; }
}

/** Independent of visuals and saves; used by the save validator. */
export function validateChestLedger(state: ChestState | undefined, claims: number[], revenue: number, remaining: number, total: number) {
  const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!Array.isArray(claims) || claims.length !== chestBalance.rewards.length || claims.some(n => !integer(n)) || !integer(revenue)) throw new Error('Invalid chest ledger');
  const count = claims.reduce((sum, n) => sum + n, 0);
  const expected = claims.reduce((sum, n, i) => sum + n * chestBalance.rewards[i], 0);
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(expected) || expected !== revenue) throw new Error('Invalid chest revenue');
  if (claims.some((n, stage) => n > 0 && stage > chestStage(remaining, total))) throw new Error('Invalid chest reward stage');
  if (state === undefined) { if (count) throw new Error('Missing chest state'); return; }
  if (!state || typeof state !== 'object') throw new Error('Invalid chest state');
  if (!Number.isFinite(state.wait) || state.wait < 0 || state.wait > chestBalance.maxWait || !integer(state.sequence) || !integer(state.randomState) || state.randomState > 4294967295 || count > state.sequence) throw new Error('Invalid chest state');
  const active = state.active;
  if (active !== undefined) {
    if (!active || typeof active !== 'object') throw new Error('Invalid active chest');
    if (!integer(active.id) || !active.id || active.id !== state.sequence || count >= state.sequence || !integer(active.position) || active.position >= chestBalance.positions.length || !integer(active.stage) || active.stage >= chestBalance.rewards.length || active.stage > chestStage(remaining, total) || !Number.isFinite(active.remaining) || active.remaining <= 0 || active.remaining > chestBalance.lifetime || state.wait !== 0) throw new Error('Invalid active chest');
  }
}

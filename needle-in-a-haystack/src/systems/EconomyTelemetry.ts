import { economyVersion } from '../config/balance';
/** Local, explicitly enabled measurements. No identifiers or network transport. */
const KEY = 'needle.economy-playtest.v1';
type Purchase = { item: string; activeSeconds: number; remaining: number; price: number; saleLevel: number };
export class EconomyTelemetry {
  private enabled = false;
  private age = 0;
  private paused?: { kind: 'menu' | 'background'; start: number };
  private data;
  constructor(remaining: number, enabled = false, resumed = false) { this.data = this.fresh(remaining); this.data.completeCycle &&= !resumed; this.enabled = enabled; }
  private fresh(remaining: number) {
    return { version: 1, economy: economyVersion, startHay: remaining, remaining, completeCycle: remaining === 20000,
      activeSeconds: 0, gameSeconds: 0, collectingSeconds: 0, walkingSeconds: 0, idleSeconds: 0, menuSeconds: 0, backgroundSeconds: 0,
      distance: 0, tripDistance: 0, tripSeconds: 0, trips: 0, soldHay: 0, saleCoins: 0, rareCoins: 0, eventCoins: 0,
      pigBites: 0, pigHay: 0, pigCoins: 0, pigWanderSeconds: 0, pigApproachSeconds: 0, pigWaitingSeconds: 0, eventSeconds: 0, eventSoldHay: 0, chests: 0, chestCoins: 0,
      tools: Array.from({ length: 5 }, () => ({ seconds: 0, collected: 0, actions: 0 })),
      purchases: [] as Purchase[], loads: [] as { hay: number; seconds: number; distance: number }[], completed: false };
  }
  setEnabled(value: boolean, remaining: number) {
    if (this.enabled && !value) { this.resume(); this.save(); }
    if (!this.enabled && value) { this.data = this.fresh(remaining); this.data.completeCycle = false; }
    this.enabled = value;
  }
  pause(kind: 'menu' | 'background') {
    if (!this.enabled || this.paused?.kind === kind) return;
    this.resume(); this.paused = { kind, start: performance.now() }; this.save();
  }
  resume() {
    if (this.paused && this.enabled) this.data[this.paused.kind === 'menu' ? 'menuSeconds' : 'backgroundSeconds'] += Math.max(0, performance.now() - this.paused.start) / 1000;
    this.paused = undefined;
  }
  tick(dt: number, distance: number, collecting: boolean, tool: number, remaining: number, event: boolean, gameDt = dt) {
    if (!this.enabled || this.paused) return;
    this.data.activeSeconds += dt; this.data.gameSeconds += gameDt; this.data.tripSeconds += dt; this.data.distance += distance; this.data.tripDistance += distance; this.data.remaining = remaining;
    this.data.tools[tool].seconds += dt;
    if (distance > .0001) this.data.walkingSeconds += dt;
    if (collecting) this.data.collectingSeconds += dt;
    if (!collecting && distance <= .0001) this.data.idleSeconds += dt;
    if (event) this.data.eventSeconds += dt;
    this.age += dt; if (this.age >= 5) { this.age = 0; this.save(); }
  }
  collect(tool: number, amount: number, rareCoins: number) {
    if (!this.enabled) return;
    this.data.tools[tool].collected += amount; if (amount) this.data.tools[tool].actions++; this.data.rareCoins += rareCoins;
  }
  sale(amount: number, coins: number, eventCoins: number) {
    if (!this.enabled || !amount) return;
    this.data.trips++; this.data.soldHay += amount; this.data.saleCoins += coins - eventCoins; this.data.eventCoins += eventCoins;
    if (eventCoins) this.data.eventSoldHay += amount;
    if (this.data.loads.length < 200) this.data.loads.push({ hay: amount, seconds: this.data.tripSeconds, distance: this.data.tripDistance });
    this.data.tripSeconds = this.data.tripDistance = 0; this.save();
  }
  pig(hay: number, coins: number, rareCoins: number) {
    if (!this.enabled || !hay) return;
    this.data.remaining = Math.max(0, this.data.remaining - hay);
    this.data.pigBites++; this.data.pigHay += hay; this.data.pigCoins += coins; this.data.rareCoins += rareCoins;
  }
  pigActivity(mode: 'wander' | 'approach' | 'waiting', dt: number) {
    if (!this.enabled) return;
    this.data[mode === 'wander' ? 'pigWanderSeconds' : mode === 'approach' ? 'pigApproachSeconds' : 'pigWaitingSeconds'] += dt;
  }
  chest(coins: number) { if (this.enabled && coins > 0) { this.data.chests++; this.data.chestCoins += coins; this.save(); } }
  purchase(item: string, price: number, remaining: number, saleLevel: number) {
    if (!this.enabled) return;
    if (this.data.purchases.length < 200) this.data.purchases.push({ item, price, remaining, saleLevel, activeSeconds: this.data.activeSeconds });
    this.save();
  }
  finish() { if (this.enabled) { this.data.completed = true; this.save(); } }
  save() { if (this.enabled) try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* Telemetry cannot break gameplay. */ } }
  reset(remaining: number) { this.data = this.fresh(remaining); this.data.completeCycle = false; try { localStorage.removeItem(KEY); } catch { /* Optional storage. */ } }
  download() {
    if (!this.enabled) return;
    const snapshot = { ...this.data };
    if (this.paused) snapshot[this.paused.kind === 'menu' ? 'menuSeconds' : 'backgroundSeconds'] += Math.max(0, performance.now() - this.paused.start) / 1000;
    const json = JSON.stringify(snapshot, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'needle-economy-playtest.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return json;
  }
  dispose() { this.resume(); this.save(); }
}

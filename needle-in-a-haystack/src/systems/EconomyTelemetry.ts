import { PlaytestTelemetry } from './PlaytestTelemetry';
import { economyVersion, config } from '../config/balance';
/** Local, explicitly enabled measurements. No player/device identifiers or network upload. Optional random run/report IDs link user-exported segments. */
const KEY = 'needle.economy-playtest.v1';
type Purchase = { details?:Record<string,unknown>; item: string; activeSeconds: number; remaining: number; price: number; saleLevel: number };
export class EconomyTelemetry {
  private enabled = false;
  private age = 0;
  private paused?: { kind: 'menu' | 'background'; start: number };
  private data;
  private general:PlaytestTelemetry;
  constructor(remaining: number, enabled = false, resumed = false, context?:()=>Record<string,unknown>) { this.general=new PlaytestTelemetry(context);this.data = this.fresh(remaining); this.data.completeCycle &&= !resumed; this.enabled = enabled;if(enabled)this.general.start(); }
  private fresh(remaining: number) {
    return { version: 3, build:'2026-11-17-refinements-r1',reportId:globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2), economy: economyVersion, startHay: remaining, remaining, completeCycle: remaining === 20000,
      activeSeconds: 0, gameSeconds: 0, collectingSeconds: 0, walkingSeconds: 0, idleSeconds: 0, menuSeconds: 0, backgroundSeconds: 0,
      distance: 0, tripDistance: 0, tripSeconds: 0, trips: 0, soldHay: 0, saleCoins: 0, rareCoins: 0, eventCoins: 0,
      pigBites: 0, pigHay: 0, pigCoins: 0, pigWanderSeconds: 0, pigApproachSeconds: 0, pigWaitingSeconds: 0, eventSeconds: 0, eventSoldHay: 0, chests: 0, chestCoins: 0,
      tools: Array.from({ length: 5 }, () => ({ seconds: 0, collected: 0, actions: 0 })),
      firstActions:{} as Record<string,number>, purchases: [] as Purchase[], loads: [] as { hay: number; seconds: number; distance: number }[], completed: false };
  }
  setEnabled(value: boolean, remaining: number) {
    if (this.enabled && !value) { this.resume(); this.save(); }
    if (!this.enabled && value) { this.data = this.fresh(remaining); this.data.completeCycle = false;this.general.reset(); }
    this.enabled = value;
    if(value)this.general.start();else this.general.stop();
  }
  pause(kind: 'menu' | 'background') {
    if (!this.enabled || this.paused?.kind === kind) return;
    this.general.event(`pause:${kind}`);
    this.resume(); this.paused = { kind, start: performance.now() }; this.save();
  }
  resume() {
    if (this.paused && this.enabled) this.data[this.paused.kind === 'menu' ? 'menuSeconds' : 'backgroundSeconds'] += Math.max(0, performance.now() - this.paused.start) / 1000;
    this.paused = undefined;
  }
  tick(dt: number, distance: number, collecting: boolean, tool: number, remaining: number, event: boolean, gameDt = dt, full = false, eventDt = dt) {
    if (!this.enabled || this.paused) return;
    if(full){this.general.event('inventoryFullSeconds',dt);this.general.full(dt,distance>.0001);}
    this.general.progress(remaining,config.totalHay,this.data.activeSeconds);
    if(!remaining)this.general.final('hayClearedSegmentSeconds',this.data.activeSeconds);
    this.data.activeSeconds += dt; this.data.gameSeconds += gameDt; this.data.tripSeconds += dt; this.data.distance += distance; this.data.tripDistance += distance; this.data.remaining = remaining;
    this.data.tools[tool].seconds += dt;
    if (distance > .0001) this.data.walkingSeconds += dt;
    if (collecting) this.data.collectingSeconds += dt;
    if (!collecting && distance <= .0001) this.data.idleSeconds += dt;
    if (event) this.data.eventSeconds += eventDt;
    this.age += dt; if (this.age >= 5) { this.age = 0; this.save(); }
  }
  collect(tool: number, amount: number, rareCoins: number) {
    if (!this.enabled) return;
    if(amount&&this.data.firstActions.collect===undefined)this.data.firstActions.collect=this.data.activeSeconds;
    if(amount)this.general.tool(tool,'completed');
    this.data.tools[tool].collected += amount; if (amount) this.data.tools[tool].actions++; this.data.rareCoins += rareCoins;
  }
  sale(amount: number, coins: number, eventCoins: number) {
    if (!this.enabled || !amount) return;
    if(this.data.firstActions.sale===undefined)this.data.firstActions.sale=this.data.activeSeconds;
    this.data.trips++; this.data.soldHay += amount; this.data.saleCoins += coins - eventCoins; this.data.eventCoins += eventCoins;
    if (eventCoins) this.data.eventSoldHay += amount;
    if (this.data.loads.length < 200) this.data.loads.push({ hay: amount, seconds: this.data.tripSeconds, distance: this.data.tripDistance });
    this.data.tripSeconds = this.data.tripDistance = 0; this.save();
  }
  pig(hay: number, coins: number, rareCoins: number,index=0,portion=0,speed=0) {
    if (!this.enabled || !hay) return;
    this.data.remaining = Math.max(0, this.data.remaining - hay);
    this.general.pig('bite',0,index,portion,speed,hay,coins,rareCoins);
    this.data.pigBites++; this.data.pigHay += hay; this.data.pigCoins += coins; this.data.rareCoins += rareCoins;
  }
  pigActivity(mode: 'wander' | 'approach' | 'waiting', dt: number,index=0,portion=0,speed=0) {
    if (!this.enabled) return;
    this.general.pig(mode,dt,index,portion,speed);
    this.data[mode === 'wander' ? 'pigWanderSeconds' : mode === 'approach' ? 'pigApproachSeconds' : 'pigWaitingSeconds'] += dt;
  }
  chest(coins: number) { if (this.enabled && coins > 0) { this.data.chests++; this.data.chestCoins += coins; this.save(); } }
  purchase(item: string, price: number, remaining: number, saleLevel: number,details?:Record<string,unknown>) {
    if (!this.enabled) return;
    if(this.data.firstActions.purchase===undefined)this.data.firstActions.purchase=this.data.activeSeconds;
    if (this.data.purchases.length < 200) this.data.purchases.push({ item, price, remaining, saleLevel, details, activeSeconds: this.data.activeSeconds });
    this.save();
  }
  viewport(width:number,height:number){if(this.enabled)this.general.viewport(width,height);}
  get isEnabled(){return this.enabled;}
  tool(tool:number,outcome:'started'|'cancelled'|'busy'|'fullAttempts',source?:string){if(this.enabled){this.general.tool(tool,outcome,source);if(outcome==='fullAttempts')this.general.fullAttempt();}}
  chestVisible(id:number|undefined,visible:boolean){if(this.enabled)this.general.chestVisible(id,visible);}
  final(kind:string,value:unknown){if(this.enabled)this.general.final(kind,value);}
  saved(bytes:number,snapshotMs:number,serializationMs:number,storageMs:number,totalMs:number,success:boolean){if(this.enabled)this.general.saved(bytes,snapshotMs,serializationMs,storageMs,totalMs,success);}
  webgl(kind:'lost'|'restored'){if(this.enabled)this.general.webgl(kind);}
  event(key:string,amount=1){if(this.enabled)this.general.event(key,amount);}
  denial(text:string){if(this.enabled)this.general.denial(text);}
  frame(ms:number){if(this.enabled)this.general.frame(ms);}
  cpu(total:number,picking:number,render:number){if(this.enabled)this.general.cpu(total,picking,render);}
  render(calls:number,triangles:number,geometries:number,textures:number){if(this.enabled)this.general.render(calls,triangles,geometries,textures);}
  finish() { if (this.enabled) { this.data.completed = true; this.save(); } }
  save() { if (this.enabled) try { localStorage.setItem(KEY, JSON.stringify({...this.data,playtest:this.general.snapshot()})); } catch { this.general.event('telemetryStorageFailure'); /* Telemetry cannot break gameplay. */ } }
  reset(remaining: number) { this.data = this.fresh(remaining); this.data.completeCycle = false;this.general.reset();if(this.paused)this.paused.start=performance.now(); try { localStorage.removeItem(KEY); } catch { /* Optional storage. */ } }
  download() {
    if (!this.enabled) return;
    const snapshot = { ...this.data, playtest:this.general.snapshot() };
    if (this.paused) snapshot[this.paused.kind === 'menu' ? 'menuSeconds' : 'backgroundSeconds'] += Math.max(0, performance.now() - this.paused.start) / 1000;
    const json = JSON.stringify(snapshot, null, 2);
    try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'needle-playtest.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { this.general.event('downloadUnavailable'); }
    return json;
  }
  dispose() { this.resume(); this.save();this.general.stop(); }
}

import { emptyBuffs, metaPrices } from '../config/meta';
import type { MetaBuffs, MetaId } from '../config/meta';
export type MetaProfile = { earned: number; bought: MetaBuffs };
export type GemState = { claimed: number; drops: (null | [number,number,number])[] };
export const freshGems = (): GemState => ({claimed:0,drops:Array.from({length:20},()=>null)});
export function validBuffs(b: MetaBuffs) { return b && typeof b === 'object' && ['legs','luck','gold','friends'].every(k=>typeof b[k as keyof MetaBuffs]==='boolean') && Number.isInteger(b.tool) && b.tool>=0 && b.tool<=4; }
export function metaSpent(b: MetaBuffs) { return (b.legs?metaPrices.legs:0)+(b.luck?metaPrices.luck:0)+(b.gold?metaPrices.gold:0)+(b.friends?metaPrices.friends:0)+metaPrices.tool.slice(0,b.tool).reduce((sum,n)=>sum+n,0); }
export function validateMeta(profile: MetaProfile | undefined, buffs: MetaBuffs | undefined, gems: GemState | undefined) {
  if (profile !== undefined && (!profile || !validBuffs(profile.bought) || !Number.isSafeInteger(profile.earned) || profile.earned<metaSpent(profile.bought))) throw new Error('Invalid meta profile');
  if (buffs !== undefined && (!validBuffs(buffs) || !profile || buffs.tool>profile.bought.tool || ['legs','luck','gold','friends'].some(k=>buffs[k as keyof MetaBuffs] && !profile.bought[k as keyof MetaBuffs]))) throw new Error('Invalid run buffs');
  if (gems !== undefined && (!gems || !Number.isInteger(gems.claimed) || gems.claimed<0 || gems.claimed>=2**20 || !Array.isArray(gems.drops) || gems.drops.length!==20 || gems.drops.some(p=>p!==null && (!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n))||Math.abs(p[0])>13||Math.abs(p[2])>13||p[1]<0||p[1]>5)))) throw new Error('Invalid diamond state');
}
export class MetaProgress {
  readonly profile: MetaProfile;
  constructor(saved?: MetaProfile) { this.profile = saved ? {earned:saved.earned,bought:{...saved.bought}} : {earned:0,bought:emptyBuffs()}; }
  get diamonds() { return this.profile.earned-metaSpent(this.profile.bought); }
  price(id: MetaId): number | null { return id==='tool' ? metaPrices.tool[this.profile.bought.tool] ?? null : this.profile.bought[id] ? null : metaPrices[id]; }
  buy(id: MetaId) { const price=this.price(id); if(price===null||price>this.diamonds)return false; if(id==='tool')this.profile.bought.tool++; else this.profile.bought[id]=true; return true; }
  award() { if (!Number.isSafeInteger(this.profile.earned+1))return false; this.profile.earned++; return true; }
  snapshot(): MetaProfile { return {earned:this.profile.earned,bought:{...this.profile.bought}}; }
}

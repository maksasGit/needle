import { upgrades } from '../config/balance';
import { toolUpgradeLimits, pigUpgrades } from '../config/progression';
import type { PriceBaseline } from './SaveSystem';
export type MemoryProgress = PriceBaseline;
export function validMemory(p:MemoryProgress) {
  return p && typeof p==='object' && p.levels && Object.keys(upgrades).every(k=>{const key=k as keyof typeof upgrades;return Number.isInteger(p.levels[key])&&p.levels[key]>=0&&p.levels[key]<=upgrades[key].maxLevel;}) && ['toolVolumes','toolSpecials'].every(k=>{const levels=p[k as 'toolVolumes'];const max=k==='toolVolumes'?toolUpgradeLimits.volume:toolUpgradeLimits.special;return Array.isArray(levels)&&levels.length===4&&levels.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=max&&(i<p.levels.tools||n===0));}) && Number.isInteger(p.pigCount)&&p.pigCount>=0&&p.pigCount<=3 && [p.pigPortionLevel,p.pigSpeedLevel].every(n=>Number.isInteger(n)&&n>=0&&n<=pigUpgrades.maxLevel) && (!!p.pigCount||!(p.pigPortionLevel||p.pigSpeedLevel));
}
export function copyMemory(p:MemoryProgress):MemoryProgress{return {...p,levels:{...p.levels},toolVolumes:[...p.toolVolumes],toolSpecials:[...p.toolSpecials]};}
import { emptyBuffs, metaPrices } from '../config/meta';
import type { MetaBuffs, MetaId } from '../config/meta';
export type MetaProfile = { earned: number; bought: MetaBuffs; memoryProgress?:MemoryProgress };
export type GemState = { claimed: number; drops: (null | [number,number,number])[] };
export const freshGems = (): GemState => ({claimed:0,drops:Array.from({length:20},()=>null)});
export function validBuffs(b: MetaBuffs) { return b && typeof b === 'object' && ['legs','luck','gold','friends'].every(k=>typeof b[k as keyof MetaBuffs]==='boolean') && (b.memory===undefined||typeof b.memory==='boolean') && Number.isInteger(b.tool) && b.tool>=0 && b.tool<=4; }
export function metaSpent(b: MetaBuffs) { return (b.legs?metaPrices.legs:0)+(b.luck?metaPrices.luck:0)+(b.gold?metaPrices.gold:0)+(b.friends?metaPrices.friends:0)+(b.memory?metaPrices.memory:0)+metaPrices.tool.slice(0,b.tool).reduce((sum,n)=>sum+n,0); }
export function validateMeta(profile: MetaProfile | undefined, buffs: MetaBuffs | undefined, gems: GemState | undefined) {
  if (profile !== undefined && (!profile || !validBuffs(profile.bought) || !Number.isSafeInteger(profile.earned) || profile.earned<metaSpent(profile.bought))) throw new Error('Invalid meta profile');
  if(profile?.memoryProgress!==undefined && (!profile.bought.memory||!validMemory(profile.memoryProgress)))throw new Error('Invalid memory progress');
  if (buffs !== undefined && (!validBuffs(buffs) || !profile || buffs.tool>profile.bought.tool || ['legs','luck','gold','friends','memory'].some(k=>buffs[k as keyof MetaBuffs] && !profile.bought[k as keyof MetaBuffs]))) throw new Error('Invalid run buffs');
  if (gems !== undefined && (!gems || !Number.isInteger(gems.claimed) || gems.claimed<0 || gems.claimed>=2**20 || !Array.isArray(gems.drops) || gems.drops.length!==20 || gems.drops.some(p=>p!==null && (!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n))||Math.abs(p[0])>13||Math.abs(p[2])>13||p[1]<0||p[1]>5)))) throw new Error('Invalid diamond state');
}
export class MetaProgress {
  readonly profile: MetaProfile;
  constructor(saved?: MetaProfile) { this.profile = saved ? {earned:saved.earned,bought:{...emptyBuffs(),...saved.bought},memoryProgress:saved.memoryProgress?copyMemory(saved.memoryProgress):undefined} : {earned:0,bought:emptyBuffs()}; }
  get diamonds() { return this.profile.earned-metaSpent(this.profile.bought); }
  price(id: MetaId): number | null { return id==='tool' ? metaPrices.tool[this.profile.bought.tool] ?? null : this.profile.bought[id] ? null : metaPrices[id]; }
  buy(id: MetaId) { const price=this.price(id); if(price===null||price>this.diamonds)return false; if(id==='tool')this.profile.bought.tool++; else this.profile.bought[id]=true; return true; }
  award() { if (!Number.isSafeInteger(this.profile.earned+1))return false; this.profile.earned++; return true; }
  snapshot(): MetaProfile { return {earned:this.profile.earned,bought:{...this.profile.bought},memoryProgress:this.profile.memoryProgress?copyMemory(this.profile.memoryProgress):undefined}; }
}

import assert from 'node:assert/strict';
import { build } from 'vite';
import { Vector3 } from 'three';
import { writeFile, mkdir } from 'node:fs/promises';

async function load(entry) {
  const result=await build({configFile:false,logLevel:'silent',build:{ssr:entry,write:false,minify:false}});
  const source=result.output[0].code.replace(/from ["']three["']/g,`from ${JSON.stringify(import.meta.resolve('three'))}`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {Haystack,quantizedAngle}=await load('src/world/Haystack.ts');
const {SaleEvent}=await load('src/systems/SaleEvent.ts');
const {ChestEvent}=await load('src/systems/ChestEvent.ts');
const {PigHerd}=await load('src/world/PigHerd.ts');
const {ToolAssets}=await load('src/world/ToolAssets.ts');
const {disposeTree}=await load('src/core/dispose.ts');
const oldAngle=v=>Math.max(-3141,Math.min(3141,Math.round(Math.atan2(Math.sin(v),Math.cos(v))*1000)));
for(let i=-20000;i<=20000;i++) assert.equal(quantizedAngle(i*.0017),oldAngle(i*.0017));
function legacySnapshot(hay){
  const data=new Int16Array(hay.count*8);
  hay.pieces.forEach((p,i)=>data.set([p.id,p.column,Math.round(p.target.x*1000),Math.round(p.target.y*1000),Math.round(p.target.z*1000),oldAngle(p.rotation.x),oldAngle(p.rotation.y),oldAngle(p.rotation.z)],i*8));
  const bytes=new Uint8Array(data.buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
}
const hay=new Haystack();
assert.ok(hay.snapshot()===legacySnapshot(hay),'initial/current snapshot must preserve legacy bytes');
const benchmark=fn=>{const times=[];for(let i=0;i<8;i++){const start=performance.now();fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return (times[3]+times[4])/2;};
const legacyMedianMs=benchmark(()=>legacySnapshot(hay));
const freshMedianMs=benchmark(()=>{hay.snapshotCache=undefined;hay.snapshot();});
const cachedMedianMs=benchmark(()=>hay.snapshot());
const before=hay.snapshot();hay.remove(17,new Vector3(-5,.5,-5),new Vector3(-5,1,0));
const after=hay.snapshot();assert.ok(before!==after,'removal changes packed state');assert.ok(after===legacySnapshot(hay),'removal snapshot must preserve legacy bytes');hay.update(.05);assert.ok(hay.snapshot()===legacySnapshot(hay),'initial/current snapshot must preserve legacy bytes');
const restored=new Haystack();restored.restore(after);assert.ok(restored.snapshot()===after,'restore must round-trip bytes');assert.equal(restored.count,19983);
assert.equal(hay.mesh.castShadow,false);assert.equal(hay.mesh.receiveShadow,false);assert.equal(hay.shadowProxy.castShadow,true);
const sale=new SaleEvent({wait:0,remaining:90},2);
for(let i=0;i<449;i++)sale.update(.2,true);assert.ok(sale.active);sale.update(.21,true);assert.equal(sale.active,false);
const chest=new ChestEvent({wait:0,sequence:1,randomState:123,active:{id:1,position:0,stage:0,remaining:30}});
for(let i=0;i<149;i++)chest.update(.2,20000,20000,()=>true);assert.ok(chest.active);chest.update(.21,20000,20000,()=>true);assert.equal(chest.active,undefined);
function pigRun(multiplier){const assets=new ToolAssets(),herd=new PigHerd(assets);let bites=0;for(let i=0;i<12000;i++)herd.update(.05,1,()=>0,()=>new Vector3(0,0,0),()=>bites++,multiplier);disposeTree(herd.group);assets.dispose?.();return bites;}
const baseBites=pigRun(1),speed3Bites=pigRun(.9**3);assert.ok(speed3Bites>baseBites,`${speed3Bites} must exceed ${baseBites}`);
const empty=new Haystack();empty.restore('');assert.equal(empty.snapshot(),'');assert.equal(empty.shadowProxy.visible,false);disposeTree(empty.group);
disposeTree(hay.group);disposeTree(restored.group);
const report={scope:'Node component checks and synthetic flat-ground pig scenario; not browser/device FPS or economy simulation',checks:['legacy-byte-equivalent saves','cache invalidation and restore','ground shadow proxy','real-time sale/chest deadlines','pig speed shortens return cadence'],snapshot:{legacyMedianMs,freshMedianMs,cachedMedianMs},pigs:{scenarioSeconds:600,baseBites,speed3Bites}};
await mkdir('verification',{recursive:true});await writeFile('verification/refinements-components.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

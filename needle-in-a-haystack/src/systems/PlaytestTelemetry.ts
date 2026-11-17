import { TechnicalTelemetry } from './TechnicalTelemetry';
const frameBounds=[16.7,25,33.4,50,100,250];
/** Bounded, local-only playtest aggregates. No raw input, URLs, error messages or player/device identifiers. */
export class PlaytestTelemetry {
  private controller?:AbortController;
  private technical=new TechnicalTelemetry();
  private stage=0;
  private chestSeenId?:number;
  private pigCache:Array<{key:string;row:ReturnType<PlaytestTelemetry['pigRow']>}|undefined>=[];
  private pigRow(){return {index:0,portionLevel:0,speedLevel:0,wanderSeconds:0,approachSeconds:0,waitingSeconds:0,bites:0,hay:0,coins:0,rareCoins:0};}
  private stageRow(){return {frames:0,totalMs:0,maxMs:0,over33ms:0,histogram:[0,0,0,0,0,0,0],cpuSamples:0,cpuTotalMs:0,scenePickingMs:0,renderCpuMs:0,maxCalls:0,maxTriangles:0,maxHeapBytes:null as number|null};}
  private data=this.fresh();
  private fresh(){return {
    contextStart:{} as Record<string,unknown>, contextLatest:{} as Record<string,unknown>,
    environment:{viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,touchPoints:Math.min(5,navigator.maxTouchPoints),browser:/Edg\//.test(navigator.userAgent)?'Edge':/Firefox\//.test(navigator.userAgent)?'Firefox':/Chrome\//.test(navigator.userAgent)?'Chromium':/Safari\//.test(navigator.userAgent)?'Safari':'Other'},
    viewports:[] as {width:number;height:number;pixelRatio:number}[],
    counters:{} as Record<string,number>, denials:{} as Record<string,number>,
    frames:{count:0,totalMs:0,maxMs:0,over33ms:0,over50ms:0,over100ms:0,histogram:[0,0,0,0,0,0,0],bucketUpperMs:[16.7,25,33.4,50,100,250,null] as (number|null)[]},
    resources:{maxDrawCalls:0,maxTriangles:0,maxGeometries:0,maxTextures:0,peakJsHeapBytes:null as number|null},
    stages:Array.from({length:11},()=>this.stageRow()),
    collection:Array.from({length:5},()=>({started:0,completed:0,cancelled:0,busy:0,fullAttempts:0,sources:{} as Record<string,number>})),
    fullInventory:{movingSeconds:0,stationarySeconds:0,attempts:0},
    pigs:{} as Record<string,ReturnType<PlaytestTelemetry['pigRow']>>,
    chest:{activeAtStart:false,firstVisible:0,visibilityMeaning:'Timer projected inside viewport; no occlusion test'},
    finalStates:{} as Record<string,unknown>,
    milestones:[] as {remaining:number;activeSeconds:number}[], droppedCounters:0, errors:{javascript:0,asset:0,unhandledRejection:0},
  };}
  constructor(private context:()=>Record<string,unknown> = ()=>({})){}
  reset(){const active=!!this.controller;this.technical.stop();this.technical=new TechnicalTelemetry();if(active)this.technical.start();this.data=this.fresh();this.stage=0;this.chestSeenId=undefined;this.pigCache=[];this.capture(true);}
  start(){if(this.controller)return;this.technical.start();this.capture(true);this.controller=new AbortController();const signal=this.controller.signal;
    window.addEventListener('error',e=>{if(e instanceof ErrorEvent)this.data.errors.javascript++;else this.data.errors.asset++;},{capture:true,signal});
    window.addEventListener('unhandledrejection',()=>this.data.errors.unhandledRejection++,{signal});
  }
  stop(){this.technical.stop();this.controller?.abort();this.controller=undefined;}
  private capture(initial=false){try{const value=this.context();if(initial&&!Object.keys(this.data.contextStart).length)this.data.contextStart=value;this.data.contextLatest=value;if(initial){this.data.chest.activeAtStart=value.chestActive===true;const total=(value.balance as {totalHay?:number}|undefined)?.totalHay;if(typeof value.remaining==='number'&&total)this.stage=Math.max(0,Math.min(10,Math.floor((1-value.remaining/total)*10)));}}catch{this.event('contextReadFailed');}}
  event(key:string,amount=1){const counters=this.data.counters;if(counters[key]===undefined&&Object.keys(counters).length>=64){this.data.droppedCounters++;return;}counters[key]=(counters[key]??0)+amount;}
  denial(text:string){const key=text.replace(/\d+(?:[.,]\d+)?/g,'#').slice(0,96),map=this.data.denials;if(map[key]===undefined&&Object.keys(map).length>=24){this.event('otherDenials');return;}map[key]=(map[key]??0)+1;}
  frame(ms:number){if(!Number.isFinite(ms)||ms<0)return;const f=this.data.frames;f.count++;f.totalMs+=ms;f.maxMs=Math.max(f.maxMs,ms);if(ms>33.4)f.over33ms++;if(ms>50)f.over50ms++;if(ms>100)f.over100ms++;const bounds=frameBounds;let bucket=0;while(bucket<bounds.length&&ms>bounds[bucket])bucket++;f.histogram[bucket]++;const row=this.data.stages[this.stage];row.frames++;row.histogram[bucket]++;row.totalMs+=ms;row.maxMs=Math.max(row.maxMs,ms);if(ms>33.4)row.over33ms++;}
  render(calls:number,triangles:number,geometries:number,textures:number){const r=this.data.resources;r.maxDrawCalls=Math.max(r.maxDrawCalls,calls);r.maxTriangles=Math.max(r.maxTriangles,triangles);r.maxGeometries=Math.max(r.maxGeometries,geometries);r.maxTextures=Math.max(r.maxTextures,textures);const memory=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory;if(memory&&Number.isFinite(memory.usedJSHeapSize))r.peakJsHeapBytes=Math.max(r.peakJsHeapBytes??0,memory.usedJSHeapSize);const stage=this.data.stages[this.stage];stage.maxCalls=Math.max(stage.maxCalls,calls);stage.maxTriangles=Math.max(stage.maxTriangles,triangles);if(memory&&Number.isFinite(memory.usedJSHeapSize))stage.maxHeapBytes=Math.max(stage.maxHeapBytes??0,memory.usedJSHeapSize); }
  cpu(total:number,picking:number,render:number){const s=this.data.stages[this.stage];s.cpuSamples++;s.cpuTotalMs+=total;s.scenePickingMs+=picking;s.renderCpuMs+=render;}
  progress(remaining:number,total:number,seconds:number){if(total<=0)return;const stage=Math.max(0,Math.min(10,Math.floor((1-remaining/total)*10)));this.stage=stage;if(this.data.milestones.length<11&&(!this.data.milestones.length||stage>Math.floor((1-this.data.milestones.at(-1)!.remaining/total)*10)))this.data.milestones.push({remaining,activeSeconds:seconds});}
  viewport(width:number,height:number){if(this.data.viewports.length<8&&!this.data.viewports.some(v=>v.width===width&&v.height===height))this.data.viewports.push({width,height,pixelRatio:devicePixelRatio});}
  tool(tool:number,outcome:'started'|'completed'|'cancelled'|'busy'|'fullAttempts',source?:string){const row=this.data.collection[tool];if(!row)return;row[outcome]++;if(source){const key=['pointer','keyboard','action','hold-start','hold-repeat'].includes(source)?source:'other';row.sources[key]=(row.sources[key]??0)+1;}}
  full(seconds:number,moving:boolean){this.data.fullInventory[moving?'movingSeconds':'stationarySeconds']+=seconds;}
  fullAttempt(){this.data.fullInventory.attempts++;}
  pig(mode:'wander'|'approach'|'waiting'|'bite',dt:number,index:number,portion:number,speed:number,hay=0,coins=0,rareCoins=0){
    let cached=this.pigCache[index];
    if(!cached||cached.row.portionLevel!==portion||cached.row.speedLevel!==speed){const key=`${index}:${portion}:${speed}`;let row=this.data.pigs[key];if(!row){if(Object.keys(this.data.pigs).length>=64){this.event('pigGroupsDropped');return;}row={...this.pigRow(),index,portionLevel:portion,speedLevel:speed};this.data.pigs[key]=row;}cached={key,row};this.pigCache[index]=cached;}
    if(mode==='bite'){cached.row.bites++;cached.row.hay+=hay;cached.row.coins+=coins;cached.row.rareCoins+=rareCoins;}else cached.row[mode==='wander'?'wanderSeconds':mode==='approach'?'approachSeconds':'waitingSeconds']+=dt;
  }
  chestVisible(id:number|undefined,visible:boolean){if(id!==undefined&&visible&&this.chestSeenId!==id){this.chestSeenId=id;this.data.chest.firstVisible++;}}
  final(kind:string,value:unknown){if((this.data.finalStates[kind]===undefined||kind==='endReason')&&Object.keys(this.data.finalStates).length<12)this.data.finalStates[kind]=value;}
  saved(bytes:number,snapshotMs:number,serializationMs:number,storageMs:number,totalMs:number,success:boolean){this.technical.save(bytes,snapshotMs,serializationMs,storageMs,totalMs,success);}
  webgl(kind:'lost'|'restored'){this.technical.context(kind);}
  snapshot(){this.capture();const f=this.data.frames;const percentile=(p:number,hist=f.histogram,samples=f.count)=>{if(!samples)return null;let count=0;for(let i=0;i<hist.length;i++){count+=hist[i];if(count>=samples*p)return f.bucketUpperMs[i];}return null;};return {...this.data,stageSummaries:this.data.stages.map((s,index)=>({index,averageFrameMs:s.frames?s.totalMs/s.frames:null,approxFps:s.totalMs?s.frames*1000/s.totalMs:null,p95BucketUpperMs:percentile(.95,s.histogram,s.frames),averageCpuMs:s.cpuSamples?s.cpuTotalMs/s.cpuSamples:null})),technical:this.technical.snapshot(this.data.resources.peakJsHeapBytes,f.count,f.over33ms,this.data.contextLatest,typeof this.data.finalStates.firstSuccessfulCollectionNavigationMs==='number'?this.data.finalStates.firstSuccessfulCollectionNavigationMs:null),frameSummary:{p50BucketUpperMs:percentile(.5),p95BucketUpperMs:percentile(.95),p99BucketUpperMs:percentile(.99),percentileNote:'Histogram upper bounds, not exact percentiles; null means no samples or above 250ms',averageMs:f.count?f.totalMs/f.count:null,approxFps:f.totalMs?f.count*1000/f.totalMs:null},sampling:'Renderer/JS heap sampled every 60 rendered frames; maxima are sampled, not guaranteed peaks. Milestones and stage indices use total stack hay as baseline.',scope:'Current opt-in session segment; linkable segments, do not sum overlapping run clock intervals; frame times exclude menus/background; heap is optional JS-only, not GPU/total memory'};}
}

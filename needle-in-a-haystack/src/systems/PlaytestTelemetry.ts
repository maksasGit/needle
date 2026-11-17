const frameBounds=[16.7,25,33.4,50,100,250];
/** Bounded, local-only playtest aggregates. No raw input, URLs, error messages or identifiers. */
export class PlaytestTelemetry {
  private controller?:AbortController;
  private data=this.fresh();
  private fresh(){return {
    contextStart:{} as Record<string,unknown>, contextLatest:{} as Record<string,unknown>,
    environment:{viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,touchPoints:Math.min(5,navigator.maxTouchPoints),browser:/Edg\//.test(navigator.userAgent)?'Edge':/Firefox\//.test(navigator.userAgent)?'Firefox':/Chrome\//.test(navigator.userAgent)?'Chromium':/Safari\//.test(navigator.userAgent)?'Safari':'Other'},
    counters:{} as Record<string,number>, denials:{} as Record<string,number>,
    frames:{count:0,totalMs:0,maxMs:0,over33ms:0,over50ms:0,over100ms:0,histogram:[0,0,0,0,0,0,0],bucketUpperMs:[16.7,25,33.4,50,100,250,null] as (number|null)[]},
    resources:{maxDrawCalls:0,maxTriangles:0,maxGeometries:0,maxTextures:0,peakJsHeapBytes:null as number|null},
    milestones:[] as {remaining:number;activeSeconds:number}[], droppedCounters:0, errors:{javascript:0,asset:0,unhandledRejection:0},
  };}
  constructor(private context:()=>Record<string,unknown> = ()=>({})){}
  reset(){this.data=this.fresh();this.capture(true);}
  start(){if(this.controller)return;this.capture(true);this.controller=new AbortController();const signal=this.controller.signal;
    window.addEventListener('error',e=>{if(e instanceof ErrorEvent)this.data.errors.javascript++;else this.data.errors.asset++;},{capture:true,signal});
    window.addEventListener('unhandledrejection',()=>this.data.errors.unhandledRejection++,{signal});
  }
  stop(){this.controller?.abort();this.controller=undefined;}
  private capture(initial=false){try{const value=this.context();if(initial&&!Object.keys(this.data.contextStart).length)this.data.contextStart=value;this.data.contextLatest=value;}catch{this.event('contextReadFailed');}}
  event(key:string,amount=1){const counters=this.data.counters;if(counters[key]===undefined&&Object.keys(counters).length>=64){this.data.droppedCounters++;return;}counters[key]=(counters[key]??0)+amount;}
  denial(text:string){const key=text.replace(/\d+(?:[.,]\d+)?/g,'#').slice(0,96),map=this.data.denials;if(map[key]===undefined&&Object.keys(map).length>=24){this.event('otherDenials');return;}map[key]=(map[key]??0)+1;}
  frame(ms:number){if(!Number.isFinite(ms)||ms<0)return;const f=this.data.frames;f.count++;f.totalMs+=ms;f.maxMs=Math.max(f.maxMs,ms);if(ms>33.4)f.over33ms++;if(ms>50)f.over50ms++;if(ms>100)f.over100ms++;const bounds=frameBounds;let bucket=0;while(bucket<bounds.length&&ms>bounds[bucket])bucket++;f.histogram[bucket]++;}
  render(calls:number,triangles:number,geometries:number,textures:number){const r=this.data.resources;r.maxDrawCalls=Math.max(r.maxDrawCalls,calls);r.maxTriangles=Math.max(r.maxTriangles,triangles);r.maxGeometries=Math.max(r.maxGeometries,geometries);r.maxTextures=Math.max(r.maxTextures,textures);const memory=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory;if(memory&&Number.isFinite(memory.usedJSHeapSize))r.peakJsHeapBytes=Math.max(r.peakJsHeapBytes??0,memory.usedJSHeapSize);}
  progress(remaining:number,total:number,seconds:number){if(total<=0)return;const stage=Math.floor((1-remaining/total)*10);if(this.data.milestones.length<11&&(!this.data.milestones.length||stage>Math.floor((1-this.data.milestones.at(-1)!.remaining/total)*10)))this.data.milestones.push({remaining,activeSeconds:seconds});}
  snapshot(){this.capture();const f=this.data.frames;return {...this.data,frameSummary:{averageMs:f.count?f.totalMs/f.count:null,approxFps:f.totalMs?f.count*1000/f.totalMs:null},sampling:'Renderer/JS heap sampled every 60 rendered frames; maxima are sampled, not guaranteed peaks. Milestones use segment startHay as baseline.',scope:'Current opt-in session segment; no reload stitching; frame times exclude menus/background; heap is optional JS-only, not GPU/total memory'};}
}

type BuildInventory={fileCount:number;totalBytes:number;largestFileBytes:number;source:string};
let inventory:Promise<BuildInventory|null>|undefined;
const MiB=1024*1024;
/** Internal targets; observations are not release certification or a whole-device memory measurement. */
export class TechnicalTelemetry {
  private observer?:PerformanceObserver;
  private token=0;
  private build:BuildInventory|null=null;
  private buildStatus='not-requested';
  private longTasks={supported:false,count:0,totalMs:0,maxMs:0};
  private saves={count:0,failures:0,peakUtf8Bytes:0,snapshotTotalMs:0,serializationTotalMs:0,storageTotalMs:0,totalMs:0,maxTotalMs:0};
  private lostAt?:number;
  private recovery={losses:0,restores:0,totalMs:0,maxMs:0};
  start(){const token=++this.token;
    if(import.meta.env.PROD){this.buildStatus='loading';inventory??=fetch(`${import.meta.env.BASE_URL}technical-build.json`).then(r=>r.ok?r.json():null).then((v:BuildInventory|null)=>v&&[v.fileCount,v.totalBytes,v.largestFileBytes].every(n=>Number.isSafeInteger(n)&&n>=0)?v:null).catch(()=>null);void inventory.then(v=>{if(token===this.token){this.build=v;this.buildStatus=v?'available':'unavailable';}});}else this.buildStatus='dev-build-unmeasured';
    try{if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){this.longTasks.supported=true;this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){this.longTasks.count++;this.longTasks.totalMs+=e.duration;this.longTasks.maxMs=Math.max(this.longTasks.maxMs,e.duration);}});this.observer.observe({entryTypes:['longtask']});}}catch{/* Optional API. */}
  }
  stop(){this.token++;this.observer?.disconnect();this.observer=undefined;}
  save(bytes:number,snapshotMs:number,serializationMs:number,storageMs:number,totalMs:number,success:boolean){const s=this.saves;s.count++;if(!success)s.failures++;s.peakUtf8Bytes=Math.max(s.peakUtf8Bytes,bytes);s.snapshotTotalMs+=snapshotMs;s.serializationTotalMs+=serializationMs;s.storageTotalMs+=storageMs;s.totalMs+=totalMs;s.maxTotalMs=Math.max(s.maxTotalMs,totalMs);}
  context(kind:'lost'|'restored'){if(kind==='lost'){this.recovery.losses++;this.lostAt=performance.now();}else{this.recovery.restores++;if(this.lostAt!==undefined){const ms=performance.now()-this.lostAt;this.recovery.totalMs+=ms;this.recovery.maxMs=Math.max(this.recovery.maxMs,ms);this.lostAt=undefined;}}}
  snapshot(heap:number|null,frames:number,slowFrames:number,context:Record<string,unknown>,firstActionMs:number|null=null){
    const resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const network={observedEntries:resources.length,transferBytes:0,encodedBodyBytes:0,decodedBodyBytes:0,zeroTransferEntries:0,largestEncodedBytes:0,scope:'Resource Timing buffer only; cache/restrictions/buffer loss possible; excludes document navigation'};
    for(const entry of resources){network.transferBytes+=entry.transferSize;network.encodedBodyBytes+=entry.encodedBodySize;network.decodedBodyBytes+=entry.decodedBodySize;if(!entry.transferSize)network.zeroTransferEntries++;network.largestEncodedBytes=Math.max(network.largestEncodedBytes,entry.encodedBodySize);}
    let gameSaveBytes:number|null=0,telemetryCacheBytes:number|null=null;
    try{for(const key of ['needle.save.v1','needle.settings.v1','needle.records.v1','needle.tutorial.v1'])gameSaveBytes+=new Blob([localStorage.getItem(key)??'']).size;telemetryCacheBytes=new Blob([localStorage.getItem('needle.economy-playtest.v1')??'']).size;}catch{gameSaveBytes=null;}
    const observed=(value:number|null,preferred:number,ceiling:number)=>({value,preferred,ceiling,status:value===null?'unknown':value>ceiling?'exceeds-ceiling':value>preferred?'above-preferred':'within-observed-range'});
    const startup=context.startup as {readyMs?:number;navigationFirstFrameMs?:number;initialTransferBytes?:number}|undefined;
    return {network,gameSaveBytes,telemetryCacheBytes,buildInventory:this.build,buildInventoryStatus:this.buildStatus,longTasks:{...this.longTasks,scope:'Opt-in window including menus; main-thread long tasks, not GPU time'},save:{...this.saves},contextRecovery:{...this.recovery},
      requirements:{initialDownload:{observedTransferBytes:startup?.initialTransferBytes??null,preferredBytes:15*MiB,ceilingBytes:30*MiB,status:'unknown',reason:'Resource Timing at first render excludes incomplete/restricted/cache entries; not a cold-cache download measurement'},
        totalBundle:observed(this.build?.totalBytes??null,250*MiB,250*MiB),largestFile:observed(this.build?.largestFileBytes??null,512*1024,30*MiB),fileCount:observed(this.build?.fileCount??null,8000,8000),
        jsHeap:observed(heap,512*MiB,512*MiB),saveUtf8Bytes:observed(this.saves.peakUtf8Bytes||null,500*1024,3*MiB),gameSaveTotal:observed(gameSaveBytes,500*1024,3*MiB),
        startup:{firstObservedCollectionNavigationMs:firstActionMs,gameConstructionToRenderMs:startup?.readyMs??null,navigationToRenderMs:startup?.navigationFirstFrameMs??null,targetInteractionMs:3000,fallbackTargetMs:5000,status:'unknown',reason:'First render is not first successful interaction; cache/network/device protocol unknown'},
        frameComfort:{samples:frames,over33ms:slowFrames,referenceFrameMs:16.7,status:frames<120?'insufficient-samples':slowFrames/frames>.05?'investigate':'within-observed-range',reason:'60 FPS comfort reference, not a formal project ceiling'},
        gpuMemory:{status:'unknown',reason:'Not available from renderer.info counters'},crashRate:{status:'unknown',reason:'One report cannot measure operational crash rate'},realMobile:{status:'unknown'},itchIoProduction:{status:'unknown'},restartLeakStability:{status:'unknown'},orientationUsability:{status:'unknown'}},
      caveats:'Bundle inventory is uncompressed production output. JS heap is sampled and browser-dependent, not process/GPU/total memory. No requirement is certified by a single report.'};
  }
}

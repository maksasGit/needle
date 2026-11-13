import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import assert from 'node:assert/strict';

// Audit only: test the existing production game without changing its design.
const root=path.resolve('dist'), output=path.resolve('verification/first-load');
await mkdir(output,{recursive:true});
const files=new Map();
async function cache(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) await cache(file);
    else {
      const data=await readFile(file);
      const type=({'.html':'text/html','.css':'text/css','.js':'text/javascript','.txt':'text/plain'})[path.extname(file)]||'application/octet-stream';
      files.set(path.relative(root,file).replaceAll('\\','/'),{data,gzip:gzipSync(data),type});
    }
  }
}
await cache(root);
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const relative=decodeURIComponent(url.pathname).replace(/^\/game\//,'');
  const file=files.get(relative);
  if(!file){res.statusCode=404;res.end('Not found');return;}
  res.setHeader('Content-Type',file.type);res.setHeader('Cache-Control','no-store');
  const gzip=(req.headers['accept-encoding']||'').includes('gzip');
  if(gzip)res.setHeader('Content-Encoding','gzip');
  const data=gzip?file.gzip:file.data;
  res.setHeader('Content-Length',data.length);res.end(data);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profiles=[
  {name:'local-cold',latency:0,download:-1,upload:-1,cpu:1},
  {name:'mobile-like-4g',latency:150,download:200000,upload:93750,cpu:4},
  {name:'slow-network',latency:400,download:50000,upload:50000,cpu:6},
];
const report={date:'2026-11-13',method:'Production build, gzip HTTP, installed headless Chrome; fresh context and disabled cache for every run. CPU slowdown is relative to this host, not a real mobile device.',measurementNotes:['Times start at navigation. Movement/collection include browser automation overhead; collection also includes walking and the gameplay action duration.','Three runs per profile are observations, not population statistics. Local gzip hosting is not the actual itch.io environment.','executedSuccessfully describes the audit execution, not compliance with the 3-second target.'],browser:'',profiles:[],errors:[]};
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});report.browser=browser.version();
  for(const profile of profiles) {
    const result={...profile,runs:[]};report.profiles.push(result);
    for(let run=0;run<3;run++) {
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
      const page=await context.newPage();const session=await context.newCDPSession(page);
      page.on('pageerror',error=>report.errors.push({profile:profile.name,run,error:error.message}));
      let closing = false;
      page.on('requestfailed',request=>{
        if (closing && request.failure()?.errorText === 'net::ERR_ABORTED') return;
        report.errors.push({profile:profile.name,run,error:request.failure(),url:request.url()});
      });
      await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
      await session.send('Network.setBypassServiceWorker',{bypass:true});
      await session.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.download,uploadThroughput:profile.upload});
      await session.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
      await page.addInitScript(()=>{
        window.startupLongTasks=[];
        new PerformanceObserver(list=>{for(const entry of list.getEntries())window.startupLongTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});
      });
      await page.goto(`${origin}/game/index.html?diagnostics`,{waitUntil:'commit',timeout:45000});
      await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0,null,{timeout:45000});
      const firstFrameMs=await page.evaluate(()=>performance.now());
      const initial=await page.evaluate(()=>({
        visibleText:document.body.innerText,
        initialDialogs:document.querySelectorAll('dialog[open]').length,
        resources:[performance.getEntriesByType('navigation')[0],...performance.getEntriesByType('resource')].map(e=>({name:e.name,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,transferSize:e.transferSize,responseEnd:e.responseEnd})),
      }));
      const rect=await page.locator('#joystick').boundingBox();
      assert.ok(rect && rect.width>=44);
      const point={x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1};
      const start=await page.evaluate(()=>window.needleDiagnostics().position);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,y:point.y-45}]});
      await page.waitForFunction(start=>{
        const p=window.needleDiagnostics().position;return Math.hypot(p[0]-start[0],p[1]-start[1])>0.03;
      },start,{timeout:15000});
      const firstMovementMs=await page.evaluate(()=>performance.now());
      await page.waitForFunction(()=>{const p=window.needleDiagnostics().position;return Math.hypot(p[0]+1.6,p[1]+0.8)<2.15;},null,{timeout:15000});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.locator('#interact').tap();
      await page.waitForFunction(()=>window.needleDiagnostics().inventory===1,null,{timeout:15000});
      const firstCollectionMs=await page.evaluate(()=>performance.now());
      const longTasks=await page.evaluate(()=>window.startupLongTasks);
      const sample={firstFrameMs,firstMovementMs,firstCollectionMs,
        under3Seconds:{frame:firstFrameMs<=3000,movement:firstMovementMs<=3000,collection:firstCollectionMs<=3000},
        initialEncodedBytes:initial.resources.reduce((sum,e)=>sum+e.encodedBodySize,0),
        initialDecodedBytes:initial.resources.reduce((sum,e)=>sum+e.decodedBodySize,0),
        initialTransferBytes:initial.resources.reduce((sum,e)=>sum+e.transferSize,0),
        longTaskCount:longTasks.length,longestTaskMs:Math.max(0,...longTasks.map(e=>e.duration)),
        resources:initial.resources,initialDialogs:initial.initialDialogs};
      result.runs.push(sample);
      if(run===0) {
        result.initialVisibleText=initial.visibleText;
        await page.screenshot({path:path.join(output,`${profile.name}-portrait.png`)});
        await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
        assert.equal(await page.locator('#inventory').textContent(),'1 / 5');
        await page.screenshot({path:path.join(output,`${profile.name}-landscape.png`)});
      }
      console.log(JSON.stringify({profile:profile.name,run:run+1,firstFrameMs:Math.round(firstFrameMs),firstMovementMs:Math.round(firstMovementMs),firstCollectionMs:Math.round(firstCollectionMs),encodedBytes:sample.initialEncodedBytes}));
      closing = true; await context.close();
    }
    const median=key=>result.runs.map(r=>r[key]).sort((a,b)=>a-b)[1];
    result.medians={firstFrameMs:median('firstFrameMs'),firstMovementMs:median('firstMovementMs'),firstCollectionMs:median('firstCollectionMs')};
    result.observedSub3Counts={frame:result.runs.filter(r=>r.under3Seconds.frame).length,movement:result.runs.filter(r=>r.under3Seconds.movement).length,collection:result.runs.filter(r=>r.under3Seconds.collection).length};
  }
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
  report.executedSuccessfully=true;
}catch(error){report.executedSuccessfully=false;report.failure=String(error.stack||error);process.exitCode=1;}
finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({executedSuccessfully:report.executedSuccessfully,failure:report.failure,medians:report.profiles.map(p=>({name:p.name,...p.medians}))}));
}

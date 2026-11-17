import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
async function load(entry){const result=await build({configFile:false,logLevel:'silent',build:{ssr:entry,write:false,minify:false}});const source=result.output[0].code.replace(/from ["']three["']/g,`from ${JSON.stringify(import.meta.resolve('three'))}`);return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);}
const {Haystack}=await load('src/world/Haystack.ts');const {validateSave}=await load('src/systems/SaveSystem.ts');
const fixture=validateSave({version:1,hay:new Haystack().snapshot(),totalHay:20000,hayProfile:1,layoutVersion:1,hayContactScale:.75,inventory:0,coins:0,levels:{capacity:0,movement:0,collection:0,tools:0,sale:0},position:[-5,-1.5],yaw:0,pitch:-.3,won:false});
Object.assign(fixture,{version:9,meta:{earned:0,bought:{legs:false,luck:false,gold:false,friends:false,memory:false,tool:0}},buffs:{legs:false,luck:false,gold:false,friends:false,memory:false,tool:0},gems:{claimed:0,drops:Array(20).fill(null)},pigPriceBaseline:0,saleEvent:{wait:0,remaining:40},chestState:{wait:0,sequence:1,randomState:123,active:{id:1,position:4,stage:0,remaining:30}}});validateSave(fixture);
const root=path.resolve('dist'),errors=[];
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(!name.startsWith('/game/')){res.writeHead(404);res.end();return;}const file=path.resolve(root,name.slice(6)||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.mp3':'audio/mpeg'})[path.extname(file)]??'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/game/?diagnostics`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const report={scope:'Production nested-URL Chrome/headless SwiftShader desktop and emulated touch; no screenshots; not real mobile or hardware GPU FPS',desktop:null,touch:null,errors};
try{
  for(const touch of [false,true]){
    const context=await browser.newContext(touch?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720}});
    await context.addInitScript(({fixture})=>{localStorage.setItem('needle.save.v1',JSON.stringify(fixture));localStorage.setItem('needle.settings.v1',JSON.stringify({language:'en',musicEnabled:false,effectsEnabled:false,economyTelemetry:true}));localStorage.setItem('needle.tutorial.v1','done');},{fixture});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(url);await page.bringToFront();await page.waitForFunction(()=>window.needleDiagnostics?.().samples>=1,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#collection-feedback')?.dataset.state==='ready'&&!document.querySelector('#collection-feedback').hidden,null,{timeout:3000});
    if(touch)await page.tap('#interact');else await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.querySelector('#collection-feedback')?.dataset.state==='busy',{timeout:3000});
    const before=await page.evaluate(()=>window.needleDiagnostics());
    if(!touch){await page.evaluate(()=>{const end=performance.now()+1200;while(performance.now()<end){/* Deliberate foreground stall verifies real timers. */}});}
    await page.waitForFunction(()=>window.needleDiagnostics().inventory===1,{timeout:3000});
    const after=await page.evaluate(()=>window.needleDiagnostics());
    if(!touch){assert.ok(before.saleEvent.remaining-after.saleEvent.remaining>=1.1);assert.ok(before.chest.active.remaining-after.chest.active.remaining>=1.1);}
    assert.ok(after.triangles<300000,`Expected lightweight shadow/render path, got ${after.triangles}`);
    let landscapeInventory=null;if(touch){await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.querySelector('#collection-feedback')?.dataset.state==='ready'&&!document.querySelector('#collection-feedback').hidden,null,{timeout:3000});await page.tap('#interact');await page.waitForFunction(()=>window.needleDiagnostics().inventory===2);landscapeInventory=await page.evaluate(()=>window.needleDiagnostics().inventory);}
    await page.click('#settings');const paused=await page.evaluate(()=>window.needleDiagnostics().saleEvent.remaining);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.needleDiagnostics().saleEvent.remaining),paused);
    const reportData=await page.evaluate(async()=>{const button=document.querySelector('#export-economy-metrics');button.click();await new Promise(r=>setTimeout(r,30));return JSON.parse(document.querySelector('#economy-metrics-text').value);});
    assert.equal(reportData.build,'2026-11-17-refinements-r1');
    assert.equal(reportData.playtest.technical.buildInventoryStatus,'available');assert.ok(reportData.playtest.technical.buildInventory.totalBytes>0);
    await page.click('#economy-metrics-dialog [data-close]');
    const cachedData=await page.evaluate(()=>{document.querySelector('#export-economy-metrics').click();return JSON.parse(document.querySelector('#economy-metrics-text').value);});
    const cachedCount=cachedData.playtest.technical.save.count-reportData.playtest.technical.save.count;
    const cachedPreparationAverageMs=cachedCount?(cachedData.playtest.technical.save.snapshotTotalMs-reportData.playtest.technical.save.snapshotTotalMs)/cachedCount:null;
    const summary={build:reportData.build,landscapeInventory,cachedPreparationAverageMs,triangles:after.triangles,calls:after.calls,inventory:after.inventory,realTimerDelta:before.saleEvent.remaining-after.saleEvent.remaining,productionInventory:reportData.playtest.technical.buildInventory,save:reportData.playtest.technical.save};
    report[touch?'touch':'desktop']=summary;await context.close();
  }
  assert.deepEqual(errors,[]);await writeFile('verification/refinements-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}

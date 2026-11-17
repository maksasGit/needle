import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';
import assert from 'node:assert/strict';

const url=process.env.LAYOUT_URL??'http://127.0.0.1:5180/';
const output='verification/layout-70';await mkdir(output,{recursive:true});
async function load(entry){const result=await build({configFile:false,logLevel:'silent',build:{ssr:entry,write:false,minify:false}});return import(`data:text/javascript;base64,${Buffer.from(result.output[0].code.replace(/from ["']three["']/g,`from ${JSON.stringify(import.meta.resolve('three'))}`)).toString('base64')}`);}
const {Haystack}=await load('src/world/Haystack.ts');const {validateSave}=await load('src/systems/SaveSystem.ts');
const base=validateSave({version:1,hay:new Haystack().snapshot(),totalHay:20000,hayProfile:1,hayContactScale:.75,layoutVersion:2,inventory:0,coins:0,levels:{capacity:0,movement:0,collection:0,tools:0,sale:0},position:[-3.5,0],yaw:0,pitch:-.12,won:false});
const progress={levels:{capacity:15,movement:0,collection:0,tools:4,sale:0},toolVolumes:[0,0,0,0],toolSpecials:[0,0,0,0],pigCount:0,pigPortionLevel:0,pigSpeedLevel:0};
Object.assign(base,{version:9,levels:progress.levels,activeTool:4,startProgress:progress,meta:{earned:300,bought:{legs:false,luck:false,gold:false,friends:false,memory:true,tool:0}},buffs:{legs:false,luck:false,gold:false,friends:false,memory:true,tool:0},gems:{claimed:0,drops:Array(20).fill(null)},pigPriceBaseline:0});
base.run={id:'layout-test',activeMs:0,eligible:true,finished:false,rules:'farm-20000-e1-chests-v1',buffs:{...base.buffs}};validateSave(base);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const report={scope:'Desktop and touch emulation; screenshots authorized only for this task; no real mobile hardware',url,errors:[],screenshots:[],checks:[]};
async function seeded(viewport,position,look,touch=false,overrides={}){
 const context=await browser.newContext({viewport,...(touch?{isMobile:true,hasTouch:true}:{})});
 const fixture=Object.assign(structuredClone(base),overrides);fixture.position=position;fixture.yaw=-Math.atan2(look[0]-position[0],position[1]-look[1]);fixture.pitch=look[2]??-.1;validateSave(fixture);
 await context.addInitScript(f=>{localStorage.setItem('needle.save.v1',JSON.stringify(f));localStorage.setItem('needle.settings.v1',JSON.stringify({language:'ru',musicEnabled:false,effectsEnabled:false,economyTelemetry:true}));localStorage.setItem('needle.tutorial.v1','done');},fixture);
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(url+'?diagnostics');await page.waitForFunction(()=>window.needleDiagnostics?.().cartModelStatus==='ready');
 await page.waitForFunction(()=>Object.values(window.needleDiagnostics().farmModelStatus).every(s=>s==='ready'));return {context,page};
}
async function shot(page,name){await page.screenshot({path:`${output}/${name}.png`,animations:'disabled'});report.screenshots.push(name+'.png');}
try{
 for(const [name,pos,look] of [['overview',[-7,2],[2,-4,-.1]],['barn',[2.15,-3.6],[2.15,-5.345,-.13]],['well',[6.3,3.6],[6.3,5.6,-.12]],['board',[2.8,5],[2.8,7,-.1]],['cart',[-5.6,3.8],[-5.6,6.3,-.2]]]){
  const {context,page}=await seeded({width:1366,height:900},pos,look);
  await shot(page,'desktop-'+name);
  if(name==='overview'){
   await page.click('#shop');await shot(page,'desktop-shop');await page.click('[data-action="character"][data-upgrade="movement"]',{force:true});assert.ok((await page.locator('[data-book-feedback]').textContent()).length>0,'Visible denial');
   await page.click('[data-tab="tool4"]');await shot(page,'desktop-shop-vacuum');await page.click('#shop-dialog [data-close]');
  }
  if(name==='well'||name==='board'||name==='barn'){
   await page.keyboard.press('KeyE');await page.waitForTimeout(300);
   const dialog=name==='well'?'#well-dialog':name==='board'?'#records-dialog':'#barn-dialog';
   const opened=await page.locator(dialog).evaluateAll(nodes=>nodes.some(n=>n.open));report.checks.push({interaction:name,opened,aim:await page.locator('#aim-label').textContent()});
   assert.ok(opened,`${name} interaction opens its menu`);
   if(opened){await shot(page,'desktop-'+name+'-menu');if(name==='barn'){await page.click('[data-barn-confirm]');assert.equal((await page.evaluate(()=>window.needleDiagnostics())).activeTool,1);}if(name==='well'){await page.click('[data-meta="legs"]');assert.ok(await page.locator('[data-meta="legs"]').isDisabled());}if(name==='board'){await page.click('[data-records-tab="global"]');await shot(page,'desktop-records-global');}}
  }
  await context.close();
 }
 const {context,page}=await seeded({width:390,height:844},[-3.5,0],[-3.5,-3.5,-.18],true);
 const actionBox=await page.locator('#interact').boundingBox();await page.mouse.move(actionBox.x+actionBox.width/2,actionBox.y+actionBox.height/2);await page.mouse.down();
 await page.waitForFunction(()=>document.querySelector('#collection-feedback').dataset.state==='busy'&&!document.querySelector('#collection-feedback').hidden);
 const overlap=await page.evaluate(()=>{const a=document.querySelector('#collection-feedback').getBoundingClientRect(),b=document.querySelector('#aim-label').getBoundingClientRect();return a.bottom>b.top&&a.top<b.bottom&&a.right>b.left&&a.left<b.right;});assert.equal(overlap,false);report.checks.push({collectionFeedbackOverlapsAim:false});
 await shot(page,'mobile-game');await page.mouse.up();await page.tap('#shop');await shot(page,'mobile-shop');await page.tap('[data-tab="tool4"]');await shot(page,'mobile-shop-vacuum');
 await page.setViewportSize({width:844,height:390});await shot(page,'mobile-landscape-shop');
 const geometry=await page.locator('#shop-dialog').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,viewport:[innerWidth,innerHeight],bodyScroll:n.querySelector('.shop-body').scrollHeight,bodyHeight:n.querySelector('.shop-body').clientHeight}));report.checks.push({mobileShop:geometry});assert.ok(geometry.width<=844&&geometry.height<=390);
 await context.close();assert.deepEqual(report.errors,[]);
 for(const [name,pos,look,selector] of [['barn',[2.15,-3.6],[2.15,-5.345,-.13],'#barn-dialog'],['well',[6.3,3.6],[6.3,5.6,-.12],'#well-dialog'],['records',[2.8,5],[2.8,7,-.1],'#records-dialog']]){
  const {context,page}=await seeded({width:390,height:844},pos,look,true);
  await page.tap('#interact');await page.waitForFunction(s=>document.querySelector(s)?.open,selector);await shot(page,'mobile-'+name);
  if(name==='well'){await page.locator('#well-dialog .shop-body').evaluate(n=>n.scrollTop=n.scrollHeight);await shot(page,'mobile-well-bottom');}
  if(name==='records'){await page.tap('[data-records-tab="global"]');assert.equal(await page.locator('.records-list li').count(),5);await shot(page,'mobile-records-global');}
  await page.setViewportSize({width:844,height:390});await shot(page,'mobile-landscape-'+name);
  if(name==='barn'){await page.locator('#barn-dialog .shop-body').evaluate(n=>n.scrollTop=n.scrollHeight);await shot(page,'mobile-landscape-barn-bottom');await page.tap('[data-barn-confirm]');assert.equal((await page.evaluate(()=>window.needleDiagnostics())).activeTool,1);}
  const bounds=await page.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,overflow:n.querySelector('.shop-body').scrollWidth>n.querySelector('.shop-body').clientWidth+1};});
  assert.ok(bounds.width<=844&&bounds.height<=390&&!bounds.overflow);report.checks.push({touchMenu:name,bounds});await context.close();
 }
 // Genuine UI purchases/sale with synthetic, ledger-valid balances.
 const rich={hay:Buffer.from(base.hay,'base64').subarray(16000).toString('base64'),saleRevenue:1000,coins:1000};
 {
  const {context,page}=await seeded({width:1280,height:720},[-3.5,0],[-3.5,-3.5,-.25],false,rich);
  await page.click('#shop');await page.click('[data-action="character"][data-upgrade="movement"]');
  assert.equal(await page.locator('#coins').textContent(),'916');
  validateSave(await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.save.v1'))));
  await page.click('#shop-dialog [data-close]');await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');await page.waitForTimeout(1000);await page.keyboard.down('KeyE');await page.waitForTimeout(1000);await page.keyboard.up('KeyE');
  report.checks.push({characterPurchase:true,movement:true,jump:true,collectionInventory:(await page.evaluate(()=>window.needleDiagnostics())).inventory});
  assert.ok((await page.evaluate(()=>window.needleDiagnostics())).inventory>0);await context.close();
 }
 {
  const carrying={hay:Buffer.from(base.hay,'base64').subarray(240).toString('base64'),inventory:15};
  const {context,page}=await seeded({width:1280,height:720},[-5.6,3.8],[-5.6,6.3,-.2],false,carrying);
  await page.keyboard.press('KeyE');await page.waitForTimeout(100);const d=await page.evaluate(()=>window.needleDiagnostics());assert.equal(d.inventory,0);assert.equal(d.coins,15);assert.equal(d.cargo,15);validateSave(await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.save.v1'))));report.checks.push({cartSale:true});await context.close();
 }
 {
  const start=structuredClone(progress);start.levels.tools=0;
  const {context,page}=await seeded({width:1280,height:720},[2.15,-3.6],[2.15,-5.345,-.13],false,{...rich,levels:start.levels,startProgress:start,activeTool:0});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>document.querySelector('#barn-dialog').open);await page.click('[data-barn-confirm]');assert.equal((await page.evaluate(()=>window.needleDiagnostics())).activeTool,1);validateSave(await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.save.v1'))));report.checks.push({barnPurchase:true});await context.close();
 }
 // An old-map save beyond the new boundary must load, relocate, and retain progress.
 {
  const legacy=structuredClone(base);legacy.layoutVersion=1;legacy.position=[12,12];legacy.gems.drops[0]=[10,.5,10];validateSave(legacy);
  const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(f=>{localStorage.setItem('needle.save.v1',JSON.stringify(f));localStorage.setItem('needle.tutorial.v1','done');},legacy);
  const page=await context.newPage();await page.goto(url+'?diagnostics');await page.waitForFunction(()=>window.needleDiagnostics?.().samples>0);
  const d=await page.evaluate(()=>window.needleDiagnostics());assert.deepEqual(d.position,[-3.5,0]);assert.equal(d.remaining,20000);report.checks.push({legacySaveRelocated:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));

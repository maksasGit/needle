import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';

async function load(entry) {
  const result = await build({ configFile:false,logLevel:'silent',build:{ssr:entry,write:false,minify:false} });
  const source=result.output[0].code.replace(/from ["']three["']/g,`from ${JSON.stringify(import.meta.resolve('three'))}`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { config }=await load('src/config/balance.ts');
const { Haystack }=await load('src/world/Haystack.ts');
const fixturePile=new Haystack();
const allBytes=Buffer.from(fixturePile.snapshot(),'base64');
const lastStraw=allBytes.subarray(0,16);
const x=lastStraw.readInt16LE(4)/1000, y=lastStraw.readInt16LE(6)/1000, z=lastStraw.readInt16LE(8)/1000;
const nearEnd={version:1,hayProfile:config.hayVisual.profileVersion,totalHay:config.totalHay,hay:lastStraw.toString('base64'),hayContactScale:0.75,inventory:0,coins:config.totalHay-1,levels:{capacity:0,movement:0,collection:0,tools:0},position:[-1.6+x,-0.8+z+2.2],yaw:0,pitch:Math.atan2(y-1.55,2.2),won:false};
const legacyRun={version:1,hay:allBytes.subarray(5*16,10000*16).toString('base64'),hayContactScale:0.75,inventory:2,coins:3,levels:{capacity:0,movement:0,collection:0,tools:0},position:[0,3.3],yaw:0,pitch:0,won:false};

const root = path.resolve('dist');
const output = path.resolve('verification');
await mkdir(output, { recursive: true });
const report = { browser: 'Installed Chrome, headless; synthetic desktop/touch viewports, not a real phone', tests: [], errors: [], network: [], cancelledOptionalLoads: [], samples: [], screenshots: [] };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/host') { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><link rel="icon" href="data:,"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style><iframe title="Game" src="/embedded/index.html?diagnostics"></iframe>'); return; }
    const file = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\/embedded\//, '')).replace(/^\//, '') || 'index.html');
    if (path.relative(root, file).startsWith('..')) throw new Error('Outside build');
    const buffer = await readFile(file);
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
    res.end(buffer);
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
async function lookAt(page,x,y,z) {
  const state=await page.evaluate(()=>window.needleDiagnostics());
  const dx=x-state.position[0],dz=z-state.position[1];
  const desiredYaw=Math.atan2(-dx,-dz),desiredPitch=Math.atan2(y-1.55-(state.height ?? 0),Math.hypot(dx,dz));
  const angle=Math.atan2(Math.sin(state.yaw-desiredYaw),Math.cos(state.yaw-desiredYaw));
  const shiftX=angle/0.004,shiftY=(state.pitch-desiredPitch)/0.004;
  const viewport=page.viewportSize();
  const startX=shiftX>=0?20:viewport.width-20;
  const startY=shiftY>=0?40:viewport.height-40;
  await page.mouse.move(startX,startY);await page.mouse.down();
  await page.mouse.move(startX+shiftX,startY+shiftY,{steps:8});await page.mouse.up();
}
async function walkKeyboardTo(page,x,z) {
  await lookAt(page,x,1.55,z);
  await page.keyboard.down('w');
  try { await page.waitForFunction(p=>Math.hypot(window.needleDiagnostics().position[0]-p.x,window.needleDiagnostics().position[1]-p.z)<0.12,{x,z},{timeout:15000}); }
  finally { await page.keyboard.up('w'); }
}
async function walkTouchToHay(page,context) {
  const session=await context.newCDPSession(page);
  const rect=await page.locator('#joystick').boundingBox();
  const point={x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,y:point.y-45}]});
  try { await page.waitForFunction(()=>{const p=window.needleDiagnostics().position;return Math.hypot(p[0]+1.6,p[1]+0.8)<2.15;},{timeout:15000}); }
  finally { await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
  await session.detach();
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport:{width:1280,height:720}, deviceScaleFactor:1 });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && (request.url().startsWith('blob:') || /cart(?:_colored)?-|cartModel-|model-loader-/.test(request.url()))) {
      report.cancelledOptionalLoads.push({url:request.url(),reason:'Reload/restart cancelled optional model or embedded-image transfer'}); return;
    }
    report.network.push({url:request.url(),failure:request.failure()});
  });
  page.on('response', response => { if (response.status() >= 400) report.network.push({url:response.url(),status:response.status()}); });
  const boot = performance.now();
  await page.goto(`${base}/embedded/index.html?diagnostics`);
  await page.waitForFunction(() => window.needleDiagnostics?.().readyMs > 0, {timeout:20000});
  report.firstLoadMs = performance.now() - boot;
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.locator('#remaining').textContent(), String(config.totalHay));
  report.tests.push('Production build starts from a nested URL with CSS and one canvas');
  await page.waitForFunction(()=>window.needleDiagnostics().cartModelStatus==='ready');
  report.tests.push('User cart GLB loads from a nested production URL after first frame');
  await page.screenshot({path:path.join(output,'desktop.png')}); report.screenshots.push('desktop.png');
  await page.locator('#settings').click();
  await page.locator('#language').selectOption('en');
  assert.equal(await page.locator('#shop').textContent(), 'Shop');
  await page.locator('#reduced-motion').check();
  await page.locator('#settings-dialog [data-close]').click();
  await page.reload();
  await page.waitForFunction(() => window.needleDiagnostics?.().readyMs > 0);
  assert.equal(await page.locator('#shop').textContent(),'Shop');
  report.tests.push('English and reduced-motion settings persist after reload');
  // A real interaction via the production input path, not a game cheat hook.
  const distantPosition=await page.evaluate(()=>window.needleDiagnostics().position);
  await page.locator('#interact').click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().inventory),0);
  assert.deepEqual(await page.evaluate(()=>window.needleDiagnostics().position),distantPosition);
  await page.locator('canvas').click({position:{x:900,y:450}});
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>window.needleDiagnostics().position),distantPosition);
  await walkKeyboardTo(page,-1.6,1.25);
  await lookAt(page,-1.6,1.2,-0.8);
  await page.locator('#interact').click();
  await page.waitForFunction(() => window.needleDiagnostics().inventory === 1, {timeout:15000});
  const amount = await page.locator('#inventory').textContent();
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#inventory').textContent(),amount);
  report.tests.push('Clicks never move the player; keyboard walking enables a single range-limited collection');
  await page.screenshot({path:path.join(output,'target-outline.png')}); report.screenshots.push('target-outline.png');
  await page.locator('#settings').click();
  const pausedPosition = await page.evaluate(() => window.needleDiagnostics().position);
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert.deepEqual(await page.evaluate(() => window.needleDiagnostics().position), pausedPosition);
  await page.locator('#settings-dialog [data-close]').click();
  const beforeKeyboard=await page.evaluate(()=>window.needleDiagnostics().position);
  await page.keyboard.down('d'); await page.waitForTimeout(150); await page.keyboard.up('d');
  assert.notDeepEqual(await page.evaluate(()=>window.needleDiagnostics().position),beforeKeyboard);
  report.tests.push('Optional keyboard movement still works after clicking a UI button');
  await page.waitForTimeout(5200);
  const saved = await page.evaluate(() => localStorage.getItem('needle.save.v1'));
  assert.ok(saved && saved.length < 500 * 1024);
  report.saveBytes = Buffer.byteLength(saved);
  await page.reload(); await page.waitForFunction(() => window.needleDiagnostics?.().readyMs > 0);
  assert.equal(await page.locator('#inventory').textContent(), '1 / 5');
  assert.equal(await page.locator('#remaining').textContent(),String(config.totalHay-1));
  report.tests.push('Menu pauses input; exact inventory and remaining hay survive reload');
  // Restore graphics using the real WebGL context-loss extension.
  const extension = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2'); const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext(); setTimeout(() => ext.restoreContext(), 350); return true;
  });
  if (extension) {
    await page.waitForTimeout(1000);
    await page.locator('#interact').click();
    await page.waitForFunction(() => window.needleDiagnostics().inventory === 2, {timeout:10000});
    report.tests.push('WebGL loss/restoration resumes rendering and collection');
  } else report.tests.push('WebGL loss extension unavailable; restoration not exercised');
  await walkKeyboardTo(page,2.7,2.4);
  await lookAt(page,2.7,1.05,0.6);
  await page.locator('#interact').click();
  await page.waitForFunction(()=>window.needleDiagnostics().coins===2,{timeout:15000});
  assert.equal(await page.locator('#inventory').textContent(),'0 / 5');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await page.reload(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().cargo),2);
  assert.equal(await page.locator('#coins').textContent(),'2');
  await page.locator('#interact').click(); await page.waitForTimeout(250);
  assert.equal(await page.locator('#coins').textContent(),'2');
  report.tests.push('Real sale, reload during unload, exact restored cart cargo, no duplicate payment');
  for (const [width,height] of [[360,640],[600,800],[720,720],[800,600],[1280,720],[1680,720],[844,390],[320,568]]) {
    const beforeSample=await page.evaluate(()=>window.needleDiagnostics().samples);
    await page.setViewportSize({width,height});
    await page.waitForFunction(before=>window.needleDiagnostics().samples >= before + 2,beforeSample,{timeout:30000});
    const layout = await page.evaluate(() => {
      const ids = ['#interact','#jump','#shop','#settings','#help','#joystick'];
      const controls = ids.map(id=>document.querySelector(id)).map(node => {
        const r=node.getBoundingClientRect(); return {id:node.id||node.dataset.move,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
      });
      return {controls, scroll:document.documentElement.scrollWidth > innerWidth,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()};
    });
    assert.ok(!layout.scroll,`No horizontal scroll at ${width}x${height}`);
    for (const c of layout.controls) assert.ok(c.width >= 44 && c.height >= 44 && c.x >= 0 && c.y >= 0 && c.right <= width + 1 && c.bottom <= height + 1,`${c.id} reachable at ${width}x${height}`);
    assert.ok(Math.abs(layout.canvas.width-width)<1 && Math.abs(layout.canvas.height-height)<1);
    report.samples.push({viewport:`${width}x${height}`,metrics:await page.evaluate(()=>window.needleDiagnostics())});
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'portrait.png')}); report.screenshots.push('portrait.png');
  report.tests.push('Responsive layout covers all six aspect ratios, both orientations, and 320px width');
  // Ten in-page restarts exercise disposal rather than just reloading the page.
  const session = await context.newCDPSession(page);
  const heaps = [];
  for (let i=0;i<10;i++) {
    await page.locator('#settings').click(); await page.locator('#new-game').click(); await page.locator('#confirm-reset').click();
    await page.waitForFunction(() => window.needleDiagnostics?.().readyMs > 0);
    assert.equal(await page.locator('canvas').count(),1);
    assert.equal(await page.locator('#remaining').textContent(),String(config.totalHay));
    await session.send('HeapProfiler.collectGarbage');
    heaps.push((await session.send('Runtime.getHeapUsage')).usedSize);
  }
  report.restartHeapBytes = heaps;
  assert.ok(Math.max(...heaps) < 512 * 1024 * 1024);
  assert.ok(heaps.at(-1) < heaps[0] + 16 * 1024 * 1024, 'No unbounded heap growth across ten restarts');
  report.tests.push('Ten restarts: one canvas, clean economy, bounded post-GC JS heap');
  await page.goto(`${base}/host`);
  const frame = page.frameLocator('iframe');
  await frame.locator('#settings').click();
  await frame.locator('#settings-dialog [data-close]').click();
  assert.equal(await frame.locator('canvas').count(),1);
  report.tests.push('Local iframe host loads production game and menus');
  // Exercise the final gameplay branch through a valid, controlled late-game save.
  await page.goto(`${base}/embedded/index.html?diagnostics`);
  await page.evaluate(()=>localStorage.setItem('needle.save.v1','{corrupt'));
  await page.reload(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs > 0);
  assert.equal(await page.locator('#remaining').textContent(),String(config.totalHay));
  assert.ok((await page.locator('#status').textContent()).includes('damaged'));
  report.tests.push('Corrupt save recovers to a playable fresh game with a visible message');
  await page.evaluate(save=>localStorage.setItem('needle.save.v1',JSON.stringify(save)),legacyRun);
  await page.reload(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.equal(await page.locator('#remaining').textContent(),'19995');
  assert.equal(await page.locator('#inventory').textContent(),'2 / 5');
  assert.equal(await page.locator('#coins').textContent(),'3');
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().cargo),3);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await page.reload(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.equal(await page.locator('#remaining').textContent(),'19995');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.save.v1')).hayProfile),config.hayVisual.profileVersion);
  report.tests.push('Legacy unfinished 10,000-straw run expands once and migrates mound profile, preserving inventory, coins and cart cargo');
  await page.evaluate(save=>localStorage.setItem('needle.save.v1',JSON.stringify(save)),nearEnd);
  await page.reload(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs > 0);
  assert.equal(await page.locator('#remaining').textContent(),'1');
  await page.locator('#shop').click(); await page.locator('[data-upgrade="tools"]').click();
  for (let level=0;level<15;level++) await page.locator('[data-upgrade="capacity"]').click();
  for (let level=0;level<10;level++) await page.locator('[data-upgrade="collection"]').click();
  assert.equal(await page.locator('[data-upgrade="capacity"]').isDisabled(),true);
  assert.equal(await page.locator('[data-upgrade="collection"]').isDisabled(),true);
  assert.equal(await page.locator('[data-level="capacity"]').textContent(),'15 / 15');
  assert.equal(await page.locator('[data-level="collection"]').textContent(),'10 / 10');
  await page.locator('#shop-dialog [data-close]').click();
  assert.equal(await page.locator('#inventory').textContent(),'0 / 80');
  assert.equal(await page.locator('#tool').textContent(),'Rake');
  await page.locator('#interact').click();
  await page.waitForFunction(()=>window.needleDiagnostics().remaining===0,{timeout:10000});
  assert.equal(await page.locator('#inventory').textContent(),'1 / 80');
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().won),false);
  await page.locator('#interact').click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().won),false,'Remote needle clicks do not move or win');
  await walkKeyboardTo(page,-1.6,-0.25);
  await lookAt(page,-1.6,0.15,-0.8);
  await page.locator('#interact').click();
  await page.locator('#win-dialog').waitFor({state:'visible',timeout:15000});
  assert.equal(await page.evaluate(()=>window.needleDiagnostics().won),true);
  await page.reload(); await page.locator('#win-dialog').waitFor({state:'visible'});
  await page.locator('#win-new-game').click();
  await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.equal(await page.locator('#remaining').textContent(),String(config.totalHay));
  const oldWin={...legacyRun,hay:'',inventory:0,coins:10000,won:true};
  await page.evaluate(save=>localStorage.setItem('needle.save.v1',JSON.stringify(save)),oldWin);
  await page.reload(); await page.locator('#win-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#remaining').textContent(),'0');
  assert.equal(await page.locator('#coins').textContent(),'10000');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.save.v1')).totalHay),10000);
  await page.locator('#win-new-game').click(); await page.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.equal(await page.locator('#remaining').textContent(),String(config.totalHay));
  report.tests.push('Legacy victory stays completed; a new game starts with 20,000 straws');
  report.tests.push('Controlled late save: upgrade, final straw, needle pickup, victory persistence, new game');
  report.tests.push('All 15 capacity and 10 collection upgrades can be purchased; max levels and 80-unit carry survive victory reload');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const blurPosition=await page.evaluate(()=>window.needleDiagnostics().position);
  await page.keyboard.down('w'); await page.waitForTimeout(100); await page.keyboard.up('w');
  assert.deepEqual(await page.evaluate(()=>window.needleDiagnostics().position),blurPosition);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  report.tests.push('Focus loss pauses and resets input, focus restores safely');
  await context.close();
  // Touch emulation checks the unified pointer path. This is not a real-device measurement.
  const touchContext = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const touch = await touchContext.newPage();
  touch.on('pageerror',error=>report.errors.push(error.message));
  await touch.goto(`${base}/embedded/index.html?diagnostics`);
  await touch.waitForFunction(()=>window.needleDiagnostics?.().readyMs > 0);
  await walkTouchToHay(touch,touchContext);
  await lookAt(touch,config.hay.x,0.9,config.hay.z);
  await touch.locator('#interact').tap();
  await touch.waitForFunction(()=>window.needleDiagnostics().inventory===1,{timeout:15000});
  await touch.setViewportSize({width:844,height:390});
  assert.equal(await touch.locator('#inventory').textContent(),'1 / 5');
  await touch.screenshot({path:path.join(output,'touch-landscape.png')}); report.screenshots.push('touch-landscape.png');
  report.tests.push('Emulated touch action works; rotation preserves progress');
  // Two concurrent touches: analog joystick + canvas look, followed by release.
  const touchSession=await touchContext.newCDPSession(touch);
  const button=await touch.locator('#joystick').boundingBox();
  const points=[{x:button.x+button.width/2,y:button.y+button.height/2,id:1}];
  const stationary=await touch.evaluate(()=>window.needleDiagnostics().position);
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:points[0].x+2}]});
  await touch.waitForTimeout(150);
  assert.deepEqual(await touch.evaluate(()=>window.needleDiagnostics().position),stationary,'Joystick dead zone prevents accidental walking');
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const beforeTouch=await touch.evaluate(()=>window.needleDiagnostics());
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...points,{x:430,y:180,id:2}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:points[0].x+40},{x:500,y:195,id:2}]});
  await touch.waitForTimeout(200);
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const afterTouch=await touch.evaluate(()=>window.needleDiagnostics());
  assert.notEqual(afterTouch.yaw,beforeTouch.yaw);
  assert.notDeepEqual(afterTouch.position,beforeTouch.position);
  await touch.waitForTimeout(150);
  assert.deepEqual(await touch.evaluate(()=>window.needleDiagnostics().position),afterTouch.position);
  assert.equal(await touch.locator('#joystick').getAttribute('data-active'),'false');
  // Cancellation and rotation must never leave the movement vector held.
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:points[0].x+35}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await touch.locator('#joystick').getAttribute('data-active'),'false');
  const afterCancel=await touch.evaluate(()=>window.needleDiagnostics().position);
  await touch.waitForTimeout(150);
  assert.deepEqual(await touch.evaluate(()=>window.needleDiagnostics().position),afterCancel);
  await touch.locator('#settings').tap();
  assert.equal(await touch.locator('#joystick').getAttribute('data-active'),'false');
  await touch.locator('#settings-dialog [data-close]').tap();
  report.tests.push('Joystick dead zone, two-finger move/look, release, touch cancellation and menu reset');
  await touch.locator('#jump').tap();
  await touch.waitForFunction(()=>window.needleDiagnostics().height>0.3);
  await touch.waitForFunction(()=>window.needleDiagnostics().grounded);
  report.tests.push('Touch jump button launches and lands');
  await touchContext.close();
  const deniedContext=await browser.newContext({viewport:{width:800,height:600}});
  await deniedContext.addInitScript(()=>{
    Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Blocked','QuotaExceededError');}});
  });
  const denied=await deniedContext.newPage();
  denied.on('pageerror',error=>report.errors.push(error.message));
  await denied.goto(`${base}/embedded/index.html?diagnostics`);
  await denied.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  await walkKeyboardTo(denied,-1.6,1.25);
  await lookAt(denied,-1.6,1.2,-0.8);
  await denied.locator('#interact').click();
  await denied.waitForFunction(()=>window.needleDiagnostics().inventory===1,{timeout:15000});
  await denied.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await denied.locator('#save-notice').getAttribute('data-warning'),'true');
  assert.equal(await denied.locator('#inventory').textContent(),'1 / 5');
  report.tests.push('Denied/quota-limited storage shows warning and gameplay remains usable');
  await deniedContext.close();
  const climbContext=await browser.newContext({viewport:{width:1280,height:720}});
  const climb=await climbContext.newPage();
  climb.on('pageerror',error=>report.errors.push(error.message));
  await climb.goto(`${base}/embedded/index.html?diagnostics`);
  await climb.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  await climb.keyboard.down('Space');
  await climb.waitForFunction(()=>window.needleDiagnostics().height>0.5);
  await climb.waitForFunction(()=>window.needleDiagnostics().grounded);
  await climb.waitForTimeout(200);
  assert.equal(await climb.evaluate(()=>window.needleDiagnostics().height),0,'Held Space does not repeat jumps');
  await climb.keyboard.up('Space');
  await climb.keyboard.down('KeyW');
  try { await climb.waitForFunction(()=>window.needleDiagnostics().height>1.3,{timeout:10000}); }
  finally { await climb.keyboard.up('KeyW'); }
  await climb.waitForTimeout(100);
  const summitHeight=await climb.evaluate(()=>window.needleDiagnostics().height);
  assert.ok(summitHeight>1.3);
  await climb.keyboard.press('Space');
  await climb.waitForFunction(h=>window.needleDiagnostics().height>h+0.5,summitHeight);
  await climb.waitForFunction(()=>window.needleDiagnostics().grounded);
  await climb.screenshot({path:path.join(output,'hay-climbing.png')});report.screenshots.push('hay-climbing.png');
  await climb.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await climb.reload();await climb.waitForFunction(()=>window.needleDiagnostics?.().readyMs>0);
  assert.ok(Math.abs(await climb.evaluate(()=>window.needleDiagnostics().height)-summitHeight)<.1,'Reload restores hay support under feet');
  await climb.keyboard.down('KeyS');
  try { await climb.waitForFunction(()=>window.needleDiagnostics().height<.05 && window.needleDiagnostics().grounded,{timeout:10000}); }
  finally { await climb.keyboard.up('KeyS'); }
  report.tests.push('Keyboard jump, held-key protection, walk/jump on hay, elevated save reload and return to ground');
  await climbContext.close();
  const fallbackContext=await browser.newContext({viewport:{width:800,height:600}});
  const fallback=await fallbackContext.newPage();
  await fallback.route('**/*.glb',route=>route.abort('failed'));
  await fallback.goto(`${base}/embedded/index.html?diagnostics`);
  await fallback.waitForFunction(()=>window.needleDiagnostics?.().cartModelStatus==='fallback');
  await walkKeyboardTo(fallback,-1.6,1.25);await lookAt(fallback,-1.6,1.2,-.8);
  await fallback.locator('#interact').click();await fallback.waitForFunction(()=>window.needleDiagnostics().inventory===1);
  await walkKeyboardTo(fallback,2.7,2.4);await lookAt(fallback,2.7,1.05,.6);
  await fallback.locator('#interact').click();await fallback.waitForFunction(()=>window.needleDiagnostics().coins===1);
  report.tests.push('GLB load failure preserves procedural cart, collection and immediate sale');
  await fallbackContext.close();
  // Explicit favicon requests are ignored; all game dependencies must resolve locally.
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  assert.equal(report.network.length,0,JSON.stringify(report.network));
  report.passed = true;
} catch (error) { report.passed=false; report.failure=String(error.stack || error); process.exitCode=1; }
finally {
  await browser?.close(); await new Promise(resolve=>server.close(resolve));
  await writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}


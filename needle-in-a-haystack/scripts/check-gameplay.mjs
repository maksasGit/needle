import assert from 'node:assert/strict';
import { build } from 'vite';
import { Vector3, Mesh } from 'three';

async function load(entry) {
  const result = await build({ configFile: false, logLevel: 'silent', build: { ssr: entry, write: false, minify: false } });
  const source = result.output[0].code.replace(/from ["']three["']/g, `from ${JSON.stringify(import.meta.resolve('three'))}`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { config } = await load('src/config/balance.ts');
const totalHay = config.totalHay;
const { EconomySystem } = await load('src/systems/EconomySystem.ts');
const { Game } = await load('src/core/Game.ts');
const { Player } = await load('src/entities/Player.ts');
const { MovementSystem } = await load('src/systems/MovementSystem.ts');
const economy = new EconomySystem();
assert.equal(economy.collect(), 1);
assert.equal(economy.remaining, totalHay - 1);
for (let i = 0; i < 10; i++) economy.collect();
assert.equal(economy.inventory, 5);
assert.equal(economy.remaining, totalHay - 5);
assert.equal(economy.unload(), 5);
assert.equal(economy.coins, 5);
assert.equal(economy.unload(), 0);
assert.equal(economy.coins, 5);
economy.remaining = 1;
assert.equal(economy.collect(), 1);
assert.equal(economy.collect(), 0);
assert.equal(economy.remaining, 0);
assert.equal(economy.unload(), 1);

// Exercise actual Game commands without needing a WebGL renderer.
const elements = new Map();
globalThis.document = { querySelector(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
const game = Object.create(Game.prototype);
game.player = new Player();
game.economy = new EconomySystem();
game.status = {}; game.collectionTimer = 0;
game.world = { marker: new Mesh(), collectHay() {}, depositHay() {}, hayIdAt() {} };
game.movement = new MovementSystem([{ x: -1.6, z: -0.8, radius: 1.65 }, { x: 2.7, z: 0.6, radius: 1.35 }]);
const hay = new Vector3(-1.6, 0, -0.8), cart = new Vector3(2.7, 0, 0.6);
function arrive() {
  let steps = 0;
  while ((game.player.state === 'Moving' || game.collectionTimer > 0) && steps++ < 2000) game.updateGameplay(0.05);
  assert.ok(steps < 2000);
}
const spawn = game.player.position.clone();
game.command('hay', hay);
for (let frame=0;frame<40;frame++) game.updateGameplay(0.05);
assert.equal(game.economy.inventory,0,'Remote clicks do not collect');
assert.ok(game.player.position.equals(spawn),'Remote clicks never start walking');
assert.equal(game.player.route.length,0);
game.command('ground',new Vector3(4,0,4));
for(let frame=0;frame<10;frame++)game.updateGameplay(0.05);
assert.ok(game.player.position.equals(spawn),'Ground clicks do nothing');
game.player.group.position.set(config.hay.x,0,config.hay.z+2.05);
game.command('hay',hay);arrive();
assert.equal(game.economy.inventory,1);
for(let i=0;i<40;i++)game.updateGameplay(0.05);
assert.equal(game.economy.inventory,1,'No automatic repeat');
for(let i=0;i<8;i++)game.command('hay',hay);
arrive();assert.equal(game.economy.inventory,2,'Rapid taps do not queue');
for(let i=0;i<3;i++){game.command('hay',hay);arrive();}
assert.equal(game.economy.inventory,5);
const atHay=game.player.position.clone();
game.command('cart',cart);arrive();
assert.equal(game.economy.coins,0,'No remote sale');
assert.ok(game.player.position.equals(atHay),'Cart clicks never start walking');
game.player.group.position.set(config.cart.x,0,config.cart.z+1.8);
game.command('cart',cart);
assert.equal(game.economy.inventory,0);
assert.equal(game.economy.coins,5,'Full sale is immediate in range');
game.command('cart',cart);assert.equal(game.economy.coins,5,'No duplicate payment');
console.log('Gameplay checks passed: manual-only movement, ignored ground taps, per-tap collection and range-limited sale.');

// Upgrade transactions and limits.
const upgraded = new EconomySystem();
assert.equal(upgraded.buy('tools'), false, 'Cannot spend unavailable coins');
assert.equal(upgraded.levels.tools, 0);
upgraded.coins = 5;
assert.equal(upgraded.buy('capacity'), true);
assert.equal(upgraded.coins, 0);
assert.equal(upgraded.capacity, 10);
assert.ok(upgraded.price('capacity') > 5);
upgraded.coins = 10000;
const oldSeconds = upgraded.collectionSeconds;
const oldSpeed = upgraded.movementSpeed;
upgraded.buy('collection'); upgraded.buy('movement'); upgraded.buy('tools');
assert.ok(upgraded.collectionSeconds < oldSeconds);
assert.ok(upgraded.movementSpeed > oldSpeed);
assert.equal(upgraded.collectionAmount, 3);
upgraded.inventory = 9;
assert.equal(upgraded.collect(), 1, 'Tool respects remaining capacity');
upgraded.unload(); upgraded.remaining = 2;
assert.equal(upgraded.collect(), 2, 'Tool respects remaining hay');
for (const id of ['capacity', 'movement', 'collection', 'tools']) {
  let previousPrice = 0;
  while (upgraded.price(id) !== null) {
    const price = upgraded.price(id);
    assert.ok(price > previousPrice);
    const coins = upgraded.coins;
    assert.equal(upgraded.buy(id), true);
    assert.equal(upgraded.coins, coins - price);
    previousPrice = price;
  }
  const coins = upgraded.coins;
  assert.equal(upgraded.buy(id), false);
  assert.equal(upgraded.coins, coins);
}

// Movement upgrades apply immediately; actual manual walking cancels collection.
game.economy.coins = 100;
game.buy('movement');
assert.equal(game.player.movementSpeed, game.economy.movementSpeed);
game.player.group.position.set(config.hay.x,0,config.hay.z+2.05);
game.command('hay', hay);
arrive();
const beforeCancel = game.economy.inventory;
game.command('hay', hay);
assert.ok(game.collectionTimer > 0);
game.input={movement:()=>new (game.player.position.constructor)(1,0)}; game.camera={yaw:0};
game.moveManually(0.05);
arrive();
assert.equal(game.economy.inventory, beforeCancel, 'Movement cancels unfinished collection');
console.log('Upgrade checks passed: prices, funds, limits, effects, partial portions, action cancellation.');

const { CameraController } = await load('src/core/CameraController.ts');
const firstPerson = new CameraController();
firstPerson.follow(game.player.position);
assert.equal(firstPerson.camera.isPerspectiveCamera, true);
assert.equal(firstPerson.camera.position.y, 1.55);
firstPerson.resize(390, 844);
assert.equal(firstPerson.camera.aspect, 390 / 844);
firstPerson.look(200, 100000);
firstPerson.follow(game.player.position);
assert.ok(Math.abs(firstPerson.camera.rotation.x) <= 1.25, 'Look cannot flip camera');
game.camera = firstPerson;
game.input = { movement: () => new (game.player.position.constructor)(0, 1) };
game.player.group.position.set(5, 0, 5);
const beforeMove = game.player.position.clone();
game.collectionTimer = 0.4;
game.moveManually(0.05);
assert.equal(game.collectionTimer, 0, 'Manual walk cancels collection');
assert.ok(game.player.position.distanceTo(beforeMove) > 0);
assert.ok(game.movement.walkable(game.player.position));
for (let i = 0; i < 500; i++) game.moveManually(0.05);
assert.ok(game.movement.walkable(game.player.position), 'Manual walk stays within bounds');
game.player.group.position.set(-1.6, 0, 1.3);
firstPerson.yaw = 0;
for (let i = 0; i < 50; i++) game.moveManually(0.05);
assert.ok(game.movement.walkable(game.player.position), 'Manual walk cannot enter hay');
console.log('First-person checks passed: perspective, eye height, resize, pitch clamp, manual movement and collisions.');


const { Haystack } = await load('src/world/Haystack.ts');
const pile = new Haystack();
assert.equal(pile.count, totalHay);
assert.equal(pile.mesh.count, totalHay);
assert.equal(pile.mesh.isInstancedMesh, true);
const pickPoint = new Vector3(-1.6, 1.5, 0.5);
const receiver = new Vector3(0, 0, 3.3);
let removed = 0, sawRolling = false;
for (const amount of [1, 3, 6, 10, 5]) {
  pile.remove(amount, pickPoint, receiver); removed += amount;
  assert.equal(pile.count, totalHay - removed);
  assert.equal(pile.mesh.count, pile.count);
  assert.ok(pile.activeCount <= 96);
  sawRolling ||= pile.activeCount > 0;
  for (let frame = 0; frame < 120; frame++) pile.update(1 / 60);
}
assert.ok(sawRolling, 'Nearby straws should roll into a gap');
for (let i = 0; i < 600; i++) pile.update(1 / 60);
assert.equal(pile.activeCount, 0, 'Physics goes to sleep after settling');
const idleVersion = pile.mesh.instanceMatrix.version;
pile.update(1 / 60);
assert.equal(pile.mesh.instanceMatrix.version, idleVersion, 'No matrix uploads for an idle pile');
while (pile.count) {
  pile.remove(Math.min(10, pile.count), pickPoint, receiver);
  for (let i = 0; i < 3; i++) pile.update(1 / 30);
  assert.ok(pile.activeCount <= 96);
  assert.equal(pile.columns.reduce((sum, column) => sum + column.pieces.length, 0), pile.count);
  pile.pieces.forEach((piece, slot) => {
    assert.equal(piece.slot, slot, 'Dense instance indices stay valid after removal');
    assert.ok(Number.isFinite(piece.position.y));
    assert.ok(piece.position.y >= 0, 'Straws stay above ground');
  });
}
assert.equal(pile.mesh.count, 0);
assert.equal(pile.activeCount, 0);
pile.remove(10, pickPoint, receiver);
assert.equal(pile.count, 0);
console.log('Hay checks passed: Configured instance count, exact removal, local rolling, sleep, simulation cap, full depletion.');

const densePile = new Haystack();
assert.ok(new Set(densePile.columns.map(column => column.phase.toFixed(6))).size > densePile.columns.length * 0.8, 'Columns must not share horizontal layer planes');
densePile.mesh.geometry.computeBoundingBox();
assert.equal(densePile.mesh.geometry.index.count, 36, 'Exactly one 12-triangle stalk per instance');
assert.ok(densePile.mesh.geometry.boundingBox.max.z - densePile.mesh.geometry.boundingBox.min.z > 4 * (densePile.mesh.geometry.boundingBox.max.x - densePile.mesh.geometry.boundingBox.min.x), 'Single elongated straw shape');
// Transformed bounds must cover the full height without the old empty bands.
const { Box3, Matrix4 } = await import('three');
function checkVerticalCoverage(stack) {
  const intervals = stack.pieces.map(piece => {
    const matrix = new Matrix4(); stack.mesh.getMatrixAt(piece.slot, matrix);
    const bounds = stack.mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    return [bounds.min.y, bounds.max.y];
  }).sort((a,b) => a[0] - b[0]);
  let highest = intervals[0][1];
  for (const [low, high] of intervals) {
    assert.ok(low <= highest + 0.01, 'No full-width horizontal air band');
    highest = Math.max(highest, high);
  }
}
checkVerticalCoverage(densePile);
for (let i = 0; i < 10; i++) { densePile.remove(5, pickPoint, receiver); for (let frame = 0; frame < 120; frame++) densePile.update(1 / 60); }
checkVerticalCoverage(densePile);
assert.equal(densePile.count, totalHay - 50);
console.log('Packing checks passed: staggered columns, individual straws, no empty horizontal bands before/after collection.');



const targeted = new Haystack();
const column = targeted.columns.find(column => column.pieces.length > 4);
const selectedStraw = column.pieces[1];
const selectedId = targeted.idAt(selectedStraw.slot);
const above = column.pieces[2];
const previousHeight = above.target.y;
targeted.highlight(selectedId);
assert.equal(targeted.highlightMesh.visible, true);
assert.ok(targeted.highlightMesh.position.distanceTo(selectedStraw.position) < 0.00001);
// Slot swapping must not change the identity of a selected straw.
const lastStraw = targeted.pieces.at(-1);
const lastId = targeted.idAt(lastStraw.slot);
targeted.remove(1, pickPoint, receiver, selectedId);
assert.equal(targeted.count, totalHay - 1);
assert.equal(targeted.byId.has(selectedId), false, 'The selected straw is removed, including one below the surface');
assert.equal(targeted.idAt(lastStraw.slot), lastId, 'Selection identity survives compacted slots');
assert.equal(targeted.highlightMesh.visible, false, 'Removed straw leaves no phantom highlight');
assert.ok(above.target.y < previousHeight, 'Straws above the selection settle down');
targeted.highlight(lastId);
for (let i = 0; i < 120; i++) targeted.update(1 / 60);
assert.ok(targeted.highlightMesh.position.distanceTo(lastStraw.position) < 0.00001, 'Highlight follows settling straw');
targeted.highlight();
assert.equal(targeted.highlightMesh.visible, false);
targeted.highlight(-1);
assert.equal(targeted.highlightMesh.visible, false);
console.log('Targeting checks passed: exact selected straw, stable identity, highlight follows motion, removal and clearing.');



assert.equal(config.totalHay, 20000);
assert.ok(Math.abs(config.hayVisual.stalkLength - 0.1725 * 1.5) < 1e-12, 'Length is 1.5 times the previous version');
assert.ok(Math.abs(config.hayVisual.stalkWidth - 0.034 * 0.75) < 1e-12, 'Thickness is 75 percent of the previous version');
const { Raycaster, InstancedMesh } = await import('three');
const rayPile = new Haystack();
function compareRaycasts() {
  rayPile.group.updateMatrixWorld(true);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const origin = new Vector3(-1.6 + Math.cos(angle) * 3, 0.5 + i % 4 * 0.45, -0.8 + Math.sin(angle) * 3);
    const direction = new Vector3(-1.6, 0.9, -0.8).sub(origin).normalize();
    const ray = new Raycaster(origin, direction);
    const optimized = [], standard = [];
    rayPile.mesh.raycast(ray, optimized);
    InstancedMesh.prototype.raycast.call(rayPile.mesh, ray, standard);
    optimized.sort((a,b) => a.distance - b.distance);
    standard.sort((a,b) => a.distance - b.distance);
    assert.equal(optimized.length, standard.length, 'Column filtering preserves all hits');
    assert.equal(optimized[0]?.instanceId, standard[0]?.instanceId, 'Same nearest straw as standard raycaster');
  }
}
compareRaycasts();
const movingColumn = rayPile.columns.find(column => column.pieces.length > 5);
rayPile.remove(5, pickPoint, receiver, movingColumn.pieces[1].id);
rayPile.update(1 / 60);
compareRaycasts();
console.log('20,000-straw checks passed: updated dimensions and accelerated raycasts match standard picking, including moving straws.');


const { FirstPersonView } = await load('src/entities/FirstPersonView.ts');
const hands = new FirstPersonView();
assert.equal(hands.count, 0);
for (let level = 0; level <= 3; level++) {
  for (const amount of [1, 2, 5, 10, 30, 80]) {
    hands.setInventory(amount, level);
    assert.equal(hands.count, amount, 'Visible carried straws match the exact inventory');
    assert.equal(hands.toolLevel, level);
    assert.equal(hands.tool.visible, level > 0);
    assert.equal(hands.left.visible, level === 0, 'Left hand is hidden after buying a tool, even with carried hay');
    assert.equal(hands.right.visible, level === 0, 'Right hand is hidden after buying a tool');
    hands.update(0.01, 0.2, 0.45);
    assert.equal(hands.left.visible, level === 0);
    assert.equal(hands.right.visible, level === 0);
    assert.equal(hands.heads.filter(head => head.visible).length, level > 0 ? 1 : 0);
  }
}
hands.setInventory(5, 0);
hands.update(0, 0, 0.45);
const idleZ = hands.root.position.z;
hands.update(0.01, 0.225, 0.45);
assert.ok(hands.root.position.z < idleZ, 'Collection reaches forward');
hands.update(0.5, 0, 0.45);
assert.ok(Math.abs(hands.root.position.z) < 1e-9, 'Cancelled/finished collection returns to rest');
hands.setInventory(0, 0); hands.sell(); hands.update(0.1, 0, 0.45);
assert.equal(hands.count, 0, 'Sale clears the carried straws');

const { CartCargo } = await load('src/world/CartCargo.ts');
const cargo = new CartCargo();
cargo.mesh.position.set(config.cart.x, 0, config.cart.z);
cargo.mesh.updateMatrixWorld(true);
const cargoOrigin = new Vector3(1.5, 1.2, 1.8);
cargo.deposit(5, cargoOrigin);
assert.equal(cargo.count, 5);
assert.equal(cargo.activeCount, 5);
for (let frame = 0; frame < 120; frame++) cargo.update(1 / 60);
assert.equal(cargo.activeCount, 0);
const cargoMatrix = new Matrix4(), cargoPosition = new Vector3();
for (let slot = 0; slot < 5; slot++) {
  cargo.mesh.getMatrixAt(slot, cargoMatrix);
  cargoPosition.setFromMatrixPosition(cargoMatrix);
  assert.ok(cargoPosition.distanceTo(cargo.target(slot).position) < 1e-6, 'Cargo settles exactly into its assigned row');
}
cargo.deposit(2, cargoOrigin);
assert.equal(cargo.count, 7, 'Later sales append, rather than replace cargo');
for (let frame = 0; frame < 120; frame++) cargo.update(1 / 60);
cargo.deposit(0, cargoOrigin);
assert.equal(cargo.count, 7);
assert.equal(cargo.activeCount, 0, 'Empty sale starts no animation');
const settledVersion = cargo.mesh.instanceMatrix.version;
cargo.update(1 / 60);
assert.equal(cargo.mesh.instanceMatrix.version, settledVersion, 'Settled cargo does not upload matrices');
for (let slot = 0; slot < config.totalHay; slot++) {
  const target = cargo.target(slot);
  assert.ok(Math.abs(target.position.x) < 0.7 && Math.abs(target.position.z) < 0.7, 'Cargo rows remain within the cart floor');
  assert.ok(target.position.y >= 0.735);
}
assert.equal(cargo.target(0).rotation, Math.PI / 2);
assert.equal(cargo.target(config.presentation.cartColumns * config.presentation.cartRows).rotation, 0, 'Alternate layers cross directions');
let deposited = 0;
game.world.depositHay = amount => { deposited += amount; };
game.player.group.position.set(config.cart.x, 0, config.cart.z + config.cart.radius + config.playerRadius + config.interactionGap);
game.economy.inventory = 3;
const coinsBeforeSale = game.economy.coins;
game.command('cart', cart);
assert.equal(deposited, 3);
assert.equal(game.economy.coins, coinsBeforeSale + 3, 'Coins are immediate, independent of cargo animation');
assert.equal(game.economy.inventory, 0);
game.command('cart', cart);
assert.equal(deposited, 3, 'Repeated empty sale cannot duplicate cargo');
console.log('Presentation checks passed: hands/tools, growing carried inventory, reach animation, layered cargo, exact one-time sale.');




const { validateSave, decodeHay, SaveSystem, SAVE_KEY } = await load('src/systems/SaveSystem.ts');
const snapshotPile = new Haystack();
snapshotPile.remove(3, pickPoint, receiver);
const encoded = snapshotPile.snapshot();
assert.ok(encoded.length < 500 * 1024);
assert.equal(decodeHay(encoded).length / 8, totalHay - 3);
const restoredPile = new Haystack();
restoredPile.restore(encoded);
assert.equal(restoredPile.count, snapshotPile.count);
const restoredData = decodeHay(restoredPile.snapshot()), originalData = decodeHay(encoded);
for (let i=0;i<originalData.length;i++) assert.equal(restoredData[i],originalData[i], 'Compact save field '+i+' round-trips exactly');
const save = { version:1, totalHay:config.totalHay, hay:encoded, inventory:3, coins:0, levels:{capacity:0,movement:0,collection:0,tools:0}, position:[0,3.3],yaw:0,pitch:0,won:false };
assert.equal(validateSave(save),save);
for (const invalid of [null, {}, {...save,version:2},{...save,hay:'bad!'},{...save,inventory:6},{...save,coins:9999},{...save,won:true},{...save,position:[Infinity,0]},{...save,levels:{...save.levels,tools:99}}]) {
  assert.throws(()=>validateSave(invalid));
}
const duplicate = new Int16Array(decodeHay(encoded).slice(0,16));
duplicate.set(duplicate.subarray(0,8),8);
assert.throws(()=>decodeHay(Buffer.from(duplicate.buffer).toString('base64')));
let stored = null;
globalThis.localStorage = { getItem:()=>stored, setItem:(_,value)=>{stored=value;} };
const saves = new SaveSystem();
assert.equal(saves.write(save),true);
assert.equal(saves.read().inventory,3);
stored = '{broken';
assert.equal(saves.read(),undefined); assert.equal(saves.invalid,true);
globalThis.localStorage = { getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');} };
const blockedSaves = new SaveSystem();
assert.equal(blockedSaves.read(),undefined); assert.equal(blockedSaves.available,false);
assert.equal(blockedSaves.write(save),false);
// Needle cannot grant victory remotely or before the last straw is removed.
let wins = 0;
game.options = { onWin:()=>wins++ }; game.world.hideNeedle=()=>{};
game.won=false; game.economy.remaining=1;
game.command('needle',new Vector3(config.needle.x,0,config.needle.z));
assert.equal(wins,0);
game.economy.remaining=0;
game.player.group.position.set(5,0,5);
game.destination='needle'; game.interact();
assert.equal(wins,0);
game.player.group.position.set(config.needle.x,0,config.needle.z+0.5);
game.interact(); assert.equal(wins,1); assert.equal(game.won,true);
game.interact(); assert.equal(wins,1,'Victory cannot fire twice');
console.log('Save/win checks passed: exact compact round-trip, validation, storage failure, needle range and single victory.');


const compactPile = new Haystack();
const compactData = decodeHay(compactPile.snapshot());
const legacyData = new Int16Array(compactData);
for (let i=0;i<legacyData.length;i+=8) legacyData[i+3] = Math.round((config.hayVisual.floor + (compactData[i+3]/1000-config.hayVisual.floor)/config.hayVisual.contactScale)*1000);
const legacyEncoded=Buffer.from(legacyData.buffer).toString('base64');
const migratedPile=new Haystack();
migratedPile.restore(legacyEncoded,1);
assert.equal(migratedPile.count,totalHay,'Compaction preserves every remaining straw');
const migratedData=decodeHay(migratedPile.snapshot());
for(let i=0;i<legacyData.length;i+=8) {
  assert.equal(migratedData[i],legacyData[i]);
  assert.equal(migratedData[i+2],legacyData[i+2],'Compaction preserves horizontal positions');
  assert.equal(migratedData[i+4],legacyData[i+4]);
  const expected=config.hayVisual.floor+(legacyData[i+3]/1000-config.hayVisual.floor)*0.75;
  assert.ok(Math.abs(migratedData[i+3]/1000-expected)<=0.00051,'Old saves receive the same tighter support spacing');
}
assert.equal(migratedPile.supportHeight,config.hayVisual.layerHeight*0.75);
assert.throws(()=>migratedPile.restore(legacyEncoded,0));
assert.throws(()=>validateSave({...save,hayContactScale:NaN}));
console.log('Compaction checks passed: 25 percent smaller support spacing and legacy-save migration preserve counts and identity.');


const { upgrades:expandedUpgrades, upgradePrice }=await load('src/config/balance.ts');
const progression=new EconomySystem();
progression.coins=config.totalHay;
for (const id of ['capacity','collection']) while(progression.price(id)!==null) assert.equal(progression.buy(id),true);
assert.equal(progression.capacity,80);
assert.equal(progression.levels.capacity,15);
assert.equal(progression.levels.collection,10);
assert.ok(progression.collectionSeconds<0.05);
assert.ok(progression.coins>0,'Expanded upgrades remain affordable within one haystack');
for(let level=0;level<5;level++) assert.equal(upgradePrice('capacity',level),Math.ceil(5*1.8**level),'Old purchases retain their original costs');
assert.equal(decodeHay(new Haystack().snapshot()).length/8,20000,'A full expanded haystack can be encoded and decoded');
const oldPrefix=Buffer.from(new Haystack().snapshot(),'base64').subarray(5*16,10000*16).toString('base64');
const legacyRun={version:1,hay:oldPrefix,hayContactScale:config.hayVisual.contactScale,inventory:2,coins:3,levels:{capacity:0,movement:0,collection:0,tools:0},position:[0,3.3],yaw:0,pitch:0,won:false};
validateSave(legacyRun);
const expandedPile=new Haystack();
expandedPile.restore(oldPrefix,config.hayVisual.contactScale,10000);
assert.equal(expandedPile.count,19995);
for(let id=0;id<5;id++) assert.equal(expandedPile.byId.has(id),false,'Already collected legacy ids stay removed');
for(let id=10000;id<20000;id++) assert.equal(expandedPile.byId.has(id),true,'New straw ids are appended exactly once');
const expandedSave={...legacyRun,totalHay:20000,hay:expandedPile.snapshot()};
validateSave(expandedSave);
const secondLoad=new Haystack(); secondLoad.restore(expandedSave.hay,config.hayVisual.contactScale,20000);
assert.equal(secondLoad.count,19995,'Reload does not append the extension twice');
assert.ok(JSON.stringify(expandedSave).length<500*1024,'Expanded save remains below preferred size limit');
const enlargedHands=new FirstPersonView(); enlargedHands.setInventory(80,3);
assert.equal(enlargedHands.count,80);
assert.ok(enlargedHands.straws.instanceMatrix.count>=80);
const carryMatrix=new Matrix4(),carryPoint=new Vector3();
for(let slot=0;slot<80;slot++) { enlargedHands.straws.getMatrixAt(slot,carryMatrix);carryPoint.setFromMatrixPosition(carryMatrix);assert.ok(carryPoint.y<0.1,'Larger carry is packed in depth instead of a tall stack'); }
const largeCargo=new CartCargo();largeCargo.deposit(80,cargoOrigin);
assert.equal(largeCargo.count,80);
for(let frame=0;frame<180;frame++)largeCargo.update(1/60);
assert.equal(largeCargo.activeCount,0);
console.log('Expanded progression checks passed: 80 capacity, 10 speed levels, 20,000 straws, affordable costs, legacy migration and larger carry.');


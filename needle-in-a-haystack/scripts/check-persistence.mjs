import assert from 'node:assert/strict';
import { build } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';

// Real production modules, with the existing in-memory Vite loader; no browser.
const result = await build({ configFile: false, logLevel: 'silent', build: { ssr: 'src/systems/SaveSystem.ts', write: false, minify: false } });
const { validateSave, SaveSystem, SAVE_KEY } = await import(`data:text/javascript;base64,${Buffer.from(result.output[0].code + '\n//# sourceURL=persistence-SaveSystem.bundle.js').toString('base64')}`);
async function load(entry) {
  const result = await build({ configFile: false, logLevel: 'silent', build: { ssr: entry, write: false, minify: false } });
  return import(`data:text/javascript;base64,${Buffer.from(result.output[0].code + `\n//# sourceURL=persistence-${entry.split('/').at(-1)}.bundle.js`).toString('base64')}`);
}
const { RunClock, RunRecords } = await load('src/systems/RunRecords.ts');
const { ChestEvent } = await load('src/systems/ChestEvent.ts');
const { MetaProgress } = await load('src/systems/MetaProgress.ts');

const clone = value => structuredClone(value);
const levels = () => ({ capacity: 0, movement: 0, collection: 0, tools: 0, sale: 0 });
const buffs = () => ({ legs: false, luck: false, gold: false, friends: false, memory: false, tool: 0 });
// Fixed storage fixtures, independent expected prices/revenues. Empty hay means
// 20,000 already sold at base price; this suite tests persistence, not rendering.
function checkpoint(version = 9) {
  const save = { version, hay: '', totalHay: 20000, inventory: 0, coins: 20000, levels: levels(), position: [-5, 0], yaw: 0, pitch: 0, won: false };
  if (version >= 7) save.run = { id: 'fixed-run', activeMs: 123000, eligible: true, finished: false, rules: 'farm-20000-e1-chests-v1' };
  if (version >= 8) {
    save.buffs = buffs();
    save.meta = { earned: 20, bought: buffs() };
    save.gems = { claimed: 2 ** 20 - 1, drops: Array(20).fill(null) };
    save.run.buffs = clone(save.buffs);
  }
  return save;
}
const checks = [];
for (let version = 1; version <= 9; version++) {
  const source = checkpoint(version), normalized = validateSave(source);
  assert.equal(normalized.coins, 20000);
  assert.equal(normalized.saleRevenue, 20000);
  assert.deepEqual(source, checkpoint(version), 'Validation must not mutate its input');
  const current = { ...normalized, version: 9, meta: normalized.meta ?? { earned: 0, bought: buffs() }, buffs: normalized.buffs ?? buffs(), gems: normalized.gems ?? { claimed: 0, drops: Array(20).fill(null) } };
  assert.doesNotThrow(() => validateSave(current), `v${version} normalization must be writable as v9`);
}
checks.push('v1-v9 validation, normalization and no input mutation');

const legacyPurchases = checkpoint(2);
legacyPurchases.levels = { capacity: 1, movement: 1, collection: 1, tools: 1, sale: 0 };
legacyPurchases.toolVolumes = [1, 0, 0, 0]; legacyPurchases.toolSpecials = [1, 0, 0, 0];
legacyPurchases.pigCount = 1;
legacyPurchases.coins = 19857; // Frozen 5+10+10+15+8+15+80 = 143 paid coins.
const legacyNormalized = validateSave(legacyPurchases);
assert.equal(legacyNormalized.legacyProgress.levels.capacity, 1);
assert.doesNotThrow(() => validateSave({ ...legacyNormalized, version: 9, meta: { earned: 0, bought: buffs() }, buffs: buffs(), gems: { claimed: 0, drops: Array(20).fill(null) } }));
const oldTenths = checkpoint(3);
oldTenths.levels = { capacity: 1, movement: 1, collection: 1, tools: 1, sale: 1 };
oldTenths.toolVolumes = [1, 0, 0, 0]; oldTenths.toolSpecials = [1, 0, 0, 0];
oldTenths.pigCount = 1; oldTenths.pigPortionLevel = 1; oldTenths.pigSpeedLevel = 1;
oldTenths.saleRemainder = 7;
oldTenths.coins = 14910; // Previous prices: 30+120+150+120+2500+90+180+800+450+650.
assert.equal(validateSave(oldTenths).saleRemainder, 70);
assert.throws(() => validateSave({ ...oldTenths, coins: 14911 }), /Unbalanced economy/);
checks.push('frozen legacy character/tool/pig prices and tenths-to-hundredths migration');

const oldPig = checkpoint(8);
oldPig.pigCount = 1; oldPig.coins = 19440; // 20,000 minus the pre-discount 560.
const migratedPig = validateSave(oldPig);
assert.equal(migratedPig.pigPriceBaseline, 1);
assert.doesNotThrow(() => validateSave({ ...migratedPig, version: 9 }));
const newPig = checkpoint(); newPig.pigCount = 1; newPig.coins = 19524;
assert.doesNotThrow(() => validateSave(newPig)); // Current price: 476, no refund.
assert.throws(() => validateSave({ ...newPig, coins: 19525 }), /Unbalanced economy/);
checks.push('old pig price 560, new price 476, no fictional coin');

const friend = checkpoint(8);
friend.meta.bought.friends = friend.buffs.friends = friend.run.buffs.friends = true;
friend.pigCount = 1;
assert.doesNotThrow(() => validateSave(friend), 'Free starter pig must not count as a paid purchase');

const memory = checkpoint();
memory.meta.earned = 150;
memory.meta.bought = memory.buffs = { ...buffs(), memory: true, friends: true, tool: 2 };
memory.run.buffs = clone(memory.buffs);
memory.levels = { capacity: 2, movement: 1, collection: 1, tools: 2, sale: 0 };
memory.toolVolumes = [2, 1, 0, 0]; memory.toolSpecials = [1, 1, 0, 0];
memory.activeTool = 2; memory.pigCount = 2; memory.pigPortionLevel = 2; memory.pigSpeedLevel = 1;
memory.startProgress = { levels: clone(memory.levels), toolVolumes: [...memory.toolVolumes], toolSpecials: [...memory.toolSpecials], pigCount: 2, pigPortionLevel: 2, pigSpeedLevel: 1 };
memory.meta.memoryProgress = clone(memory.startProgress);
assert.doesNotThrow(() => validateSave(memory), 'Inherited progress must not be charged coin prices');
const missingStart = clone(memory); delete missingStart.startProgress;
assert.throws(() => validateSave(missingStart), /Missing memory starting progress/);
const tooMuchStart = clone(memory); tooMuchStart.startProgress.levels.capacity++;
assert.throws(() => validateSave(tooMuchStart), /Invalid free starting progress/);
checks.push('free starting pig, muscle memory levels and invariant rejection');

const bonus = checkpoint();
bonus.chestRevenue = 1000; bonus.chestClaims = [0, 0, 0, 1];
bonus.chestState = { wait: 100, sequence: 1, randomState: 42 };
bonus.eventRevenue = 120; bonus.saleRemainder = 25; bonus.eventRemainder = 75;
bonus.saleEvent = { wait: 100, remaining: 0 }; bonus.coins = 21120;
const reloaded = validateSave(JSON.parse(JSON.stringify(bonus)));
assert.equal(reloaded.eventRemainder, 75); assert.equal(reloaded.saleRemainder, 25);
assert.equal(reloaded.chestRevenue, 1000); assert.equal(reloaded.saleRevenue, 20000);
assert.throws(() => validateSave({ ...bonus, chestRevenue: 2000 }), /Invalid chest revenue/);
assert.throws(() => validateSave({ ...bonus, coins: 21121 }), /Invalid helper economy/);
assert.throws(() => validateSave({ ...bonus, coins: 21119 }), /Unbalanced economy/);
const chest = new ChestEvent({ wait: 0, sequence: 1, randomState: 42, active: { id: 1, position: 0, stage: 1, remaining: 30 } });
let awards = 0;
assert.equal(chest.claim(1, stage => { assert.equal(stage, 1); awards++; return 100; }), 100);
assert.equal(chest.claim(1, () => { awards++; return 100; }), 0);
assert.equal(new ChestEvent(chest.snapshot()).claim(1, () => { awards++; return 100; }), 0);
assert.equal(awards, 1);
checks.push('separate chest/event/base ledgers, hundredths and one chest claim across reload');

const originalPerformance = globalThis.performance;
const originalStorage = globalThis.localStorage;
let now = 0;
const stored = new Map();
try {
  globalThis.performance = { now: () => now };
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const clock = new RunClock(); now = 500; clock.setRunning(true);
  now = 2000; clock.setRunning(false); assert.equal(clock.state.activeMs, 1500);
  now = 10000; clock.setRunning(true); now = 11000; clock.finish();
  assert.equal(clock.state.activeMs, 2500);
  now = 20000; assert.equal(new RunClock(clock.snapshot()).snapshot().activeMs, 2500);
  const records = new RunRecords();
  for (let i = 1; i <= 6; i++) records.record({ ...clock.snapshot(), id: `run-${i}`, activeMs: i * 1000 });
  assert.deepEqual(records.list().map(row => row.activeMs), [1000, 2000, 3000, 4000, 5000]);
  records.record({ ...clock.snapshot(), id: 'run-1', activeMs: 1000 });
  assert.equal(records.list().filter(row => row.id === 'run-1').length, 1);
  assert.deepEqual(new RunRecords().list().map(row => row.activeMs), [1000, 2000, 3000, 4000, 5000]);
  checks.push('controlled foreground clock, finished reload, top-five and record deduplication');

  const saves = new SaveSystem(); assert.equal(saves.write(bonus), true);
  assert.equal(saves.read().coins, 21120);
  const before = stored.get(SAVE_KEY);
  globalThis.localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  assert.equal(saves.write(memory), false);
  assert.equal(stored.get(SAVE_KEY), before, 'Failed checkpoint must preserve previous stored progress');
  const meta = new MetaProgress(memory.meta);
  assert.equal(meta.diamonds, 50);
  assert.equal(meta.buy('legs'), true); assert.equal(meta.diamonds, 40);
  assert.equal(meta.buy('legs'), false); assert.equal(meta.diamonds, 40);
  const profileCopy = meta.snapshot(); profileCopy.memoryProgress.levels.capacity++;
  assert.equal(meta.profile.memoryProgress.levels.capacity, 2);
  checks.push('checkpoint storage failure, meta debit once and independent memory snapshot');
} finally {
  globalThis.performance = originalPerformance;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
const report = { scope: 'Node persistence/components with fixed fixtures and clock; no Game/WebGL/browser/device coverage', checks };
await mkdir('verification', { recursive: true });
await writeFile('verification/persistence-components.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

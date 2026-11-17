import { MetaProgress, freshGems, copyMemory } from '../systems/MetaProgress';
import type { MetaProfile, MemoryProgress } from '../systems/MetaProgress';
import { emptyBuffs, wellConfig } from '../config/meta';
import type { MetaBuffs, MetaId } from '../config/meta';
import { WellMenu } from '../ui/WellMenu';
import { RunClock, RunRecords } from '../systems/RunRecords';
import { Leaderboard } from '../ui/Leaderboard';
import { recordsConfig } from '../config/records';
import * as THREE from 'three';
import { World } from '../world/World';
import type { Target } from '../world/World';
import { Player } from '../entities/Player';
import { Locomotion } from '../systems/Locomotion';
import { MovementSystem } from '../systems/MovementSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { config } from '../config/balance';
import { CameraController } from './CameraController';
import { InputManager } from './InputManager';
import { Shop } from '../ui/Shop';
import type { ShopAction } from '../ui/Shop';
import { barnItems, barnWalls, isBarnTarget, pigUpgrades, pigBalance, pigUpgradePrice, toolUpgradeLimits, toolUpgradePrice } from '../config/progression';
import { presentation } from '../config/presentation';
import type { UpgradeId } from '../config/balance';
import { FirstPersonView } from '../entities/FirstPersonView';
import { disposeTree } from './dispose';
import { SaveSystem, decodeHay } from '../systems/SaveSystem';
import type { Settings } from '../systems/SaveSystem';
import { t } from '../ui/i18n';
import { strawRarity, rarityVersion } from '../config/rarity';
import { FloatingFeedback } from '../ui/FloatingFeedback';
import { HudFeedback } from '../ui/HudFeedback';
import { BarnCard } from '../ui/BarnCard';
import { Onboarding } from '../ui/Onboarding';
import { SaleEvent } from '../systems/SaleEvent';
import { EconomyTelemetry } from '../systems/EconomyTelemetry';
import type { AudioManager } from './AudioManager';
import { ChestEvent } from '../systems/ChestEvent';
import { chestBalance } from '../config/chests';
import { ChestTimer } from '../ui/ChestTimer';

type Options = { newGame?: boolean; retainedMeta?: MetaProfile; audio?: AudioManager; settings?: Settings; onReady?: () => void; onWin?: () => void; onError?: (message: string) => void };
export class Game {
  private renderer!: THREE.WebGLRenderer;
  private world = new World();
  private player = new Player();
  private camera = new CameraController();
  private economy = new EconomySystem();
  private movement = new MovementSystem([config.cart, recordsConfig, wellConfig, ...barnWalls]);
  private locomotion = new Locomotion();
  private destination: 'ground' | 'hay' | 'cart' | 'needle' = 'ground';
  private collectionTimer = 0;
  private collectionTool=0;
  private collectionInput='pointer';
  private collectionDuration = 0;
  private lastRejectionAt = -Infinity;
  private shop?: Shop;
  private input?: InputManager;
  private harvestPoint = new THREE.Vector3(config.hay.x, 1, config.hay.z);
  private harvestId?: number;
  private aimTarget?: Target;
  private aimRarity = strawRarity();
  private lastBought?: UpgradeId;
  private viewModel?: FirstPersonView;
  private feedback?: FloatingFeedback;
  private hud?: HudFeedback;
  private barnCard?: BarnCard;
  private guide = new Onboarding();
  private saleEvent = new SaleEvent();
  private displayedEventSeconds = -1;
  private meta = new MetaProgress();
  private buffs:MetaBuffs=emptyBuffs();
  private startProgress?:MemoryProgress;
  private gems=freshGems();
  private gemAge=0;
  private wellMenu?:WellMenu;
  private lastMetaPurchaseAt=-Infinity;
  private run = new RunClock();
  private records = new RunRecords();
  private leaderboard?: Leaderboard;
  private chests = new ChestEvent();
  private chestTimer?: ChestTimer;
  private chestSpawnPoint = new THREE.Vector2();
  private chestViewport = new THREE.Vector2(1, 1);
  private canSpawnChest = (index: number) => {
    const [x,z] = chestBalance.positions[index];
    this.chestSpawnPoint.set(x,z);
    return this.movement.walkable(this.chestSpawnPoint) && Math.hypot(x - config.hay.x, z - config.hay.z) > config.hay.radius + 1 && Math.hypot(x - config.cart.x, z - config.cart.z) > config.cart.radius + 1 && this.player.position.distanceTo(this.chestSpawnPoint) > 2;
  };
  private telemetry?: EconomyTelemetry;
  private telemetryDialog='';
  private measurePig = (mode: 'wander' | 'approach' | 'waiting', dt: number,index:number) => this.telemetry?.pigActivity(mode, dt,index,this.economy.pigPortionLevel,this.economy.pigSpeedLevel);
  private saveSystem?: SaveSystem = new SaveSystem();
  private dirty = false;
  private saveAge = 0;
  private won = false;
  private runTotal: number = config.totalHay;
  private disposed = false;
  private failed = false;
  private contextLost = false;
  private background = document.hidden;
  private menuOpen = false;
  private needsRender = true;
  private observer?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private controller = new AbortController();
  private options: Options;
  private statusKey: Parameters<typeof t>[0] = 'ready';
  private statusVars: Record<string, string | number> = {};
  private manual = new THREE.Vector2();
  private delta = new THREE.Vector2();
  private step = new THREE.Vector2();
  private stepSoundStart = new THREE.Vector2();
  private previous = performance.now();
  private frameSamples = 0;
  private frameTotal = 0;
  private boot = performance.now();
  constructor(host: HTMLElement, private status: HTMLElement, options: Options = {}) {
    this.options = options;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio <= 1.5, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, config.maxPixelRatio));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Shadows only change while something in the world moves.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.domElement.setAttribute('aria-label', t('world'));
      this.renderer.domElement.tabIndex = 0;
      host.append(this.renderer.domElement);
      this.viewModel = new FirstPersonView(this.world.toolAssets);
      this.hud = new HudFeedback(); this.hud.reducedMotion = !!options.settings?.reducedMotion;
      const feedbackHost = document.querySelector<HTMLElement>('#action-feedback');
      if (feedbackHost) { this.feedback = new FloatingFeedback(feedbackHost); this.feedback.reducedMotion = !!options.settings?.reducedMotion; }
      this.world.reducedMotion = this.viewModel.reducedMotion = !!options.settings?.reducedMotion;
      const source = this.saveSystem!.read();
      this.meta=new MetaProgress(options.retainedMeta ?? source?.meta);
      const saved=options.newGame?undefined:source;
      this.buffs=saved ? {...(saved.buffs??emptyBuffs())} : {...this.meta.profile.bought};
      this.economy.metaMovement=this.buffs.legs?1.5:1;
      this.saleEvent=new SaleEvent(saved?.saleEvent,this.buffs.gold?2:1);
      this.chests=new ChestEvent(saved?.chestState,this.buffs.luck ? 0.5 : 1);
      if(!saved){this.economy.levels.tools=this.economy.activeTool=this.buffs.tool;this.economy.pigCount=this.buffs.friends?1:0;this.run.state.buffs={...this.buffs};}
      if(!saved && this.buffs.memory){
        const inherited=this.meta.profile.memoryProgress;
        if(inherited){Object.assign(this.economy.levels,inherited.levels);this.economy.toolVolumes.splice(0,4,...inherited.toolVolumes);this.economy.toolSpecials.splice(0,4,...inherited.toolSpecials);this.economy.pigCount=inherited.pigCount;this.economy.pigPortionLevel=inherited.pigPortionLevel;this.economy.pigSpeedLevel=inherited.pigSpeedLevel;}
        this.economy.levels.tools=Math.max(this.economy.levels.tools,this.buffs.tool);this.economy.activeTool=this.economy.levels.tools;this.economy.pigCount=Math.max(this.economy.pigCount,this.buffs.friends?1:0);
        this.startProgress=this.progressSnapshot();
      }
      this.player.movementSpeed=this.economy.movementSpeed;
      if (saved) {
        try {
          const remaining = decodeHay(saved.hay).length / 8;
          const sourceTotal = saved.totalHay ?? 10000;
          const restoredRemaining = this.world.restore(saved.hay, sourceTotal - remaining - saved.inventory - (saved.pigEaten ?? 0), saved.won, saved.hayContactScale ?? 1, sourceTotal, saved.hayProfile ?? 0);
          this.runTotal = saved.won ? sourceTotal : config.totalHay;
          this.dirty = saved.version !== 9 || saved.hayProfile !== config.hayVisual.profileVersion || saved.hayContactScale !== config.hayVisual.contactScale || saved.totalHay === undefined || (!saved.won && sourceTotal !== config.totalHay);
          Object.assign(this.economy.levels, saved.levels);
          this.economy.remaining = restoredRemaining; this.economy.inventory = saved.inventory; this.economy.coins = saved.coins;
          this.economy.discoveryCoins = saved.discoveryCoins ?? 0;
          this.economy.saleRevenue = saved.saleRevenue ?? (sourceTotal - remaining - saved.inventory) * config.salePrice;
          this.economy.pigPortionLevel = saved.pigPortionLevel ?? 0; this.economy.pigSpeedLevel = saved.pigSpeedLevel ?? 0;
          this.economy.saleRemainder = saved.saleRemainder ?? 0; this.economy.legacyProgress = saved.legacyProgress; this.economy.priceBaseline = saved.priceBaseline;
          this.economy.eventRevenue = saved.eventRevenue ?? 0; this.economy.eventRemainder = saved.eventRemainder ?? 0;
          this.saleEvent = new SaleEvent(saved.saleEvent,this.buffs.gold?2:1);
          this.economy.chestRevenue = saved.chestRevenue ?? 0;
          for (let i = 0; i < this.economy.chestClaims.length; i++) this.economy.chestClaims[i] = saved.chestClaims?.[i] ?? 0;
          this.chests = new ChestEvent(saved.chestState,this.buffs.luck ? 0.5 : 1);
          this.run = new RunClock(saved.run, false);
          if (!saved.run && saved.won) this.run.finish();
          this.startProgress=saved.startProgress?copyMemory(saved.startProgress):undefined;
          this.economy.pigPriceBaseline=saved.pigPriceBaseline??0;
          this.economy.pigCount = saved.pigCount ?? 0; this.economy.pigEaten = saved.pigEaten ?? 0;
          this.economy.activeTool = saved.activeTool ?? saved.levels.tools;
          for (let i = 0; i < 4; i++) {
            this.economy.toolVolumes[i] = saved.toolVolumes?.[i] ?? 0;
            this.economy.toolSpecials[i] = saved.toolSpecials?.[i] ?? 0;
          }
          this.player.group.position.set(saved.position[0], 0, saved.position[1]);
          this.player.movementSpeed = this.economy.movementSpeed;
          this.camera.yaw = saved.yaw; this.camera.pitch = saved.pitch; this.won = saved.won;
          if (!restoredRemaining) this.movement = new MovementSystem([config.cart, recordsConfig, wellConfig, ...barnWalls]);
          if (saved.layoutVersion !== config.layoutVersion || !this.movement.walkable(this.player.position)) {
            this.player.group.position.set(config.playerSpawn.x, 0, config.playerSpawn.z);
            this.camera.yaw = -Math.atan2(config.hay.x - config.playerSpawn.x, config.playerSpawn.z - config.hay.z);
            this.camera.pitch = config.firstPerson.startPitch;
            this.dirty = true;
          }
        } catch { this.saveSystem!.invalid = true; }
      }
      this.gems=saved?.gems ? {claimed:saved.gems.claimed,drops:saved.gems.drops.map(p=>p?[...p] as [number,number,number]:null)} : freshGems();
      if(saved&&!saved.gems)for(let i=0;i<20;i++)if(!this.world.hasStraw(500+i*1000))this.gems.claimed|=1<<i;
      if (this.won) this.records.record(this.run.state);
      this.syncChest();
      if(options.settings?.economyTelemetry)this.startTelemetrySegment();
      this.telemetry = new EconomyTelemetry(this.economy.remaining, !!options.settings?.economyTelemetry, !!saved,()=>this.playtestContext());
      this.locomotion.height = this.world.surfaceHeight(this.player.group.position.x, this.player.group.position.z);
      this.player.group.position.y = this.locomotion.height;
      this.camera.follow(this.player.position, this.locomotion.height);
      this.input = new InputManager(this.renderer.domElement, this.camera.camera, this.world.pickables,
        (target, point, instanceId,source) => this.command(target, point, instanceId,source),
        (dx, dy) => { this.camera.look(dx, dy); this.dirty = true; },
        (instanceId, target) => {
          this.world.highlightHay(this.paused ? undefined : this.collectionTimer > 0 ? this.harvestId : this.world.hayIdAt(instanceId));
          const next = this.paused ? undefined : target;
          this.world.highlightBarn(next && isBarnTarget(next) && this.inBarnRange(next) ? next : undefined);
          document.querySelector('.crosshair')?.classList.toggle('has-target', !!next);
          const rarity = next === 'hay' ? strawRarity(this.world.hayIdAt(instanceId)) : strawRarity();
          if (this.aimTarget !== next || this.aimRarity.id !== rarity.id) { this.aimTarget = next; this.aimRarity = rarity; this.updateAimLabel(); }
        },
        () => this.paused, () => this.jump(), () => this.economy.activeTool === 4,kind=>this.telemetry?.event(`input:${kind}`));
      this.resizeObserver = new ResizeObserver(() => {
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        this.camera.resize(width, height); this.renderer.setSize(width, height); this.chestViewport.set(width, height);this.telemetry?.event('resize');this.telemetry?.viewport(width,height);
        this.needsRender = true;
      });
      this.resizeObserver.observe(host);
      const { width, height } = host.getBoundingClientRect(); this.camera.resize(width, height); this.renderer.setSize(width, height); this.chestViewport.set(width, height);
      this.refreshHUD(); this.shop = new Shop(this.economy, id => this.buy(id), text => this.reject(text));
      this.barnCard = new BarnCard(this.economy, target => this.purchaseBarn(target), text => this.reject(text));
      const signal = this.controller.signal;
      const syncPause = () => {
        this.run.setRunning(!this.disposed && !this.failed && !document.querySelector('dialog[open]') && !this.background && !this.contextLost && !this.won && !!this.metrics.readyMs);
        this.menuOpen = !!document.querySelector('dialog[open]');
        const dialogId=Array.from(document.querySelectorAll('dialog[open]')).at(-1)?.id??'';
        if(dialogId&&dialogId!==this.telemetryDialog)this.telemetry?.event(`menu:${dialogId}`);this.telemetryDialog=dialogId;
        if(this.background)this.telemetry?.pause('background');else if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume();
        this.status.setAttribute('aria-live', this.menuOpen ? 'off' : 'polite');
        this.previous = performance.now();
        this.input?.reset();
        this.hud?.stop(); this.feedback?.stop(); this.guide.hide();
        this.chestTimer?.hide();
        if (this.menuOpen) this.cancelCollection('state-change');
        this.needsRender = true;
        if (this.metrics.readyMs) { this.dirty = true; this.saveNow(); }
      };
      this.observer = new MutationObserver(syncPause);
      this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      syncPause();
      document.addEventListener('visibilitychange', () => { this.background = document.hidden; this.run.setRunning(!this.paused && !!this.metrics.readyMs); if (this.background) this.telemetry?.pause('background'); else if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume(); this.previous = performance.now(); this.input?.reset(); this.hud?.stop(); this.feedback?.stop(); this.guide.hide(); this.chestTimer?.hide(); this.saveNow(); }, { signal });
      window.addEventListener('blur', () => { this.run.setRunning(false); this.background = true; this.telemetry?.pause('background'); this.input?.reset(); this.hud?.stop(); this.feedback?.stop(); this.guide.hide(); this.chestTimer?.hide(); this.saveNow(); }, { signal });
      window.addEventListener('focus', () => { this.background = document.hidden; this.run.setRunning(!this.paused && !!this.metrics.readyMs); if (!this.background) { if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume(); } this.previous = performance.now(); }, { signal });
      window.addEventListener('pagehide', () => {this.telemetry?.final('endReason','pagehide');this.saveNow();this.telemetry?.save();}, { signal });
      this.renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault();this.telemetry?.event('webglContextLost');this.telemetry?.webgl('lost'); this.run.setRunning(false); this.contextLost = true; this.input?.reset(); this.saveNow(); this.message('contextLost');
      }, { signal });
      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.telemetry?.event('webglContextRestored');this.telemetry?.webgl('restored');this.contextLost = false; this.run.setRunning(!this.paused && !!this.metrics.readyMs); this.previous = performance.now(); this.renderer.shadowMap.needsUpdate = true; this.needsRender = true;
        this.message(this.won ? 'wonStatus' : this.economy.remaining === 0 ? 'discovered' : 'ready');
      }, { signal });
      this.message(this.saveSystem!.invalid ? 'saveInvalid' : this.won ? 'wonStatus' : this.economy.remaining === 0 ? 'discovered' : 'ready');
      this.updateSaveNotice(); this.refreshEvent();
      if (this.won) queueMicrotask(() => { if (!this.disposed) this.options.onWin?.(); });
      this.renderer.setAnimationLoop(now => this.frame(now));
    } catch (error) { this.dispose(false); throw error; }
  }
  get paused() { return this.disposed || this.failed || this.contextLost || this.background || this.menuOpen || this.won; }
  private frame(now: number) {
    if (this.disposed) return;
    const elapsed = Math.max(0, now - this.previous);
    const dt = Math.min(elapsed / 1000, 0.05); this.previous = now;
    if (this.background || this.contextLost || this.failed) { this.options.audio?.setWalking(false); return; }
    if (this.paused) { this.options.audio?.setWalking(false); if (!this.needsRender) return; }
    try {
      const cpuStart=this.telemetry?.isEnabled&&!this.paused&&this.metrics.readyMs?performance.now():null;
      if (!this.paused) {
        if(this.metrics.readyMs)this.telemetry?.frame(elapsed);
        this.run.settle();
        this.stepSoundStart.copy(this.player.position);
        this.moveManually(dt);
        if (this.economy.activeTool === 4 && !this.input?.holdingCollection()) this.cancelCollection('state-change');
        this.input?.updateHeld(dt, this.collectionTimer === 0 && this.economy.inventory < this.economy.capacity && this.economy.remaining > 0 && this.inRange('hay'));
        const collecting = this.collectionTimer > 0;
        this.updateGameplay(dt);
        if (this.metrics.readyMs) this.telemetry?.tick(elapsed / 1000, this.stepSoundStart.distanceTo(this.player.position), collecting, this.economy.activeTool, this.economy.remaining, this.saleEvent.active, dt,this.economy.inventory>=this.economy.capacity);
        if (this.saleEvent.update(dt, this.guide.completed)) { this.telemetry?.event(this.saleEvent.active?'saleEventStarted':'saleEventEnded');this.dirty = true; this.refreshEvent(); this.saveNow(); }
        this.refreshEvent(false);
        if (this.guide.completed || this.saleEvent.active) this.dirty = true;
        const chestChange = this.chests.update(dt, this.economy.remaining, this.runTotal, this.canSpawnChest);
        this.dirty = true;
        if (chestChange) {
          this.telemetry?.event(`chest:${chestChange}`);
          this.syncChest();
          if (chestChange === 'spawn') { this.feedback?.notice(t('chestAppeared')); this.message('chestAppeared'); }
          this.saveNow();
        }
        this.world.updatePigs(dt, this.economy.pigCount, this.onPigEat, this.economy.pigIntervalMultiplier, this.telemetry?.isEnabled ? this.measurePig : undefined); this.world.updateHay(dt);
        this.gemAge+=dt;if(this.gemAge>=.1){this.gemAge=0;this.world.updateDiamonds(this.gems);}
        this.player.group.position.y = this.locomotion.height;
        this.options.audio?.setWalking(this.locomotion.grounded && this.stepSoundStart.distanceToSquared(this.player.position) > .000001, this.economy.movementSpeed / config.movementSpeed);
        this.viewModel?.update(dt, this.collectionTimer, this.collectionDuration || this.economy.collectionSeconds);
        this.saveAge += dt;
        if (this.saveAge >= 5) { this.saveAge = 0; this.saveNow(); }
      }
      this.camera.follow(this.player.position, this.locomotion.height);
      if (this.paused) this.chestTimer?.hide();
      else {this.chestTimer?.update(dt, this.chests.active, this.camera.camera, this.chestViewport.x, this.chestViewport.y);this.telemetry?.chestVisible(this.chests.active?.id,this.chestTimer?.visible??false);}
      this.guide.update(dt, this.paused, this.economy, this.inRange('hay'), this.inRange('cart'), this.camera.camera, !!this.options.settings?.reducedMotion);
      const pickingStart=cpuStart!==null?performance.now():0;
      this.world.scene.updateMatrixWorld(); this.input?.updateAim(dt, this.paused);
      const pickingMs=cpuStart!==null?performance.now()-pickingStart:0;
      this.renderer.shadowMap.needsUpdate = this.world.takeShadowUpdate();
      this.renderer.info.autoReset = false; this.renderer.info.reset();
      const renderStart=cpuStart!==null?performance.now():0;
      this.renderer.render(this.world.scene, this.camera.camera); this.viewModel?.render(this.renderer, this.camera.camera);
      if(cpuStart!==null)this.telemetry?.cpu(performance.now()-cpuStart,pickingMs,performance.now()-renderStart);
      this.needsRender = false;
      if (!this.metrics.readyMs) {
        this.metrics.readyMs = performance.now() - this.boot;
        this.metrics.startupMs = performance.now();
        this.metrics.initialTransferBytes = performance.getEntriesByType('resource').reduce((sum, item) => sum + (item as PerformanceResourceTiming).transferSize, 0);
        this.run.setRunning(!this.paused);
        this.options.onReady?.();
        this.world.loadNoncriticalAssets();this.world.updateDiamonds(this.gems);
        if(this.options.newGame||this.telemetry?.isEnabled){this.dirty=true;this.saveNow();}
      }
      this.frameTotal += elapsed; this.frameSamples++;
      if (this.frameSamples >= 60) {
        // Plain data for diagnostics; no per-frame DOM telemetry.
        this.metrics = { samples: this.metrics.samples + 1, frameMs: this.frameTotal / this.frameSamples, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
          geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, readyMs: this.metrics.readyMs || performance.now() - this.boot, startupMs: this.metrics.startupMs, initialTransferBytes: this.metrics.initialTransferBytes };
        if(!this.paused)this.telemetry?.render(this.metrics.calls,this.metrics.triangles,this.metrics.geometries,this.metrics.textures);
        this.frameSamples = 0; this.frameTotal = 0;
      }
    } catch (error) {
      this.telemetry?.event('gameLoopError');this.telemetry?.final('endReason','game-loop-error');console.error(error); this.run.setRunning(false); this.failed = true; this.input?.reset(); this.saveNow();
      this.options.onError?.(t('error'));
    }
  }
  metrics = { samples: 0, frameMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, readyMs: 0, startupMs: 0, initialTransferBytes: 0 };
  private message(key: Parameters<typeof t>[0], vars: Record<string, string | number> = {}) {
    this.statusKey = key; this.statusVars = vars; this.status.textContent = t(key, vars);
  }
  private inRange(target: 'hay' | 'cart' | 'needle') {
    const object = config[target];
    if (target !== 'hay' && this.player.group.position.y > (target === 'cart' ? 1.8 : 1)) return false;
    const baseRange = object.radius + config.playerRadius + config.interactionGap + config.interactionTolerance;
    const reach = target === 'hay' ? baseRange * config.collectionRangeMultiplier + this.economy.collectionReach : baseRange;
    return this.player.position.distanceTo(this.step ? this.step.set(object.x, object.z) : new THREE.Vector2(object.x, object.z)) <= reach;
  }
  private inBarnRange(target: keyof typeof barnItems) {
    const item = barnItems[target];
    return Math.hypot(this.player.group.position.x - item.x, this.player.group.position.z - item.z) <= 1.9 && this.player.group.position.y <= 1;
  }
  private syncChest() {
    this.world.setChest(this.chests.active);
    if (this.chests.active && !this.chestTimer) this.chestTimer = new ChestTimer();
    if (!this.chests.active) this.chestTimer?.hide();
    this.updateAimLabel();
  }
  private collectChest() {
    const active = this.chests.active;
    if (!active) { this.reject(t('chestGone')); return; }
    const [x,z] = chestBalance.positions[active.position];
    if (this.player.group.position.y > chestBalance.maxPlayerHeight || Math.hypot(this.player.group.position.x - x, this.player.group.position.z - z) > chestBalance.pickupDistance) { this.reject(t('denyFar')); return; }
    const earned = this.chests.claim(active.id, stage => this.economy.creditChest(stage));
    if (!earned) { this.reject(t('denyUnavailable')); return; }
    this.cancelCollection('state-change'); this.player.command([]); this.destination = 'ground';
    this.syncChest(); this.feedback?.show('coins', earned); this.hud?.pulse('coins'); this.options.audio?.effect('sell');
    this.telemetry?.chest(earned);
    this.message('chestReward', { n: earned }); this.dirty = true; this.refreshHUD(); this.saveNow();
  }
  private reject(text: string) {
    if (this.disposed || this.failed) return;
    const now = performance.now();
    if (now - this.lastRejectionAt < presentation.rejectionCooldownMs) return;
    this.lastRejectionAt = now;this.telemetry?.denial(text);
    const focusedDialog = document.activeElement?.closest<HTMLDialogElement>('dialog[open]');
    const dialog = focusedDialog ?? Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1);
    if (dialog) {
      let node = dialog.querySelector<HTMLElement>('[data-barn-feedback], [data-book-feedback], [data-well-feedback], [data-denial-feedback]');
      if (!node) { node = document.createElement('p'); node.dataset.denialFeedback = ''; node.setAttribute('role', 'status'); dialog.append(node); }
      node.dataset.feedbackState = 'error'; node.textContent = text;
    } else this.feedback?.notice(text);
    this.status.textContent = text;
    this.options.audio?.effect('deny');
  }
  private priceRejection(price: number | null) {
    return price === null ? t('denyMax') : price > this.economy.coins ? t('denyFunds', { n: price - this.economy.coins }) : t('denyUnavailable');
  }
  private purchaseRejection(action: ShopAction) {
    if (action.kind === 'character') return this.priceRejection(this.economy.price(action.id));
    if (action.kind === 'pig') {
      if (!this.economy.pigCount) return t('denyNeedPig');
      const level = action.upgrade === 'portion' ? this.economy.pigPortionLevel : this.economy.pigSpeedLevel;
      return this.priceRejection(level >= pigUpgrades.maxLevel ? null : pigUpgradePrice(action.upgrade, level));
    }
    if (action.tool < 1 || action.tool > this.economy.levels.tools) return t('denyNeedTool');
    if (action.kind === 'equip') return t('denyUnavailable');
    const level = (action.kind === 'volume' ? this.economy.toolVolumes : this.economy.toolSpecials)[action.tool - 1];
    return this.priceRejection(level >= toolUpgradeLimits[action.kind] ? null : toolUpgradePrice(action.tool, action.kind, level));
  }
  private purchaseBarn(target: keyof typeof barnItems) {
    if (this.disposed || this.failed) return false;
    if (!this.inBarnRange(target)) { this.reject(t('denyFar')); return false; }
    const offer = this.economy.barnOffer(target);
    const purchaseBefore=this.telemetry?.isEnabled?this.purchaseState():undefined;
    const before = this.economy.coins;
    if (!this.economy.buyAtBarn(target)) { this.reject(offer.locked ? t('denyPrevious') : this.priceRejection(offer.price)); return false; }
    this.cancelCollection('state-change'); this.player.command([]); this.destination = 'ground'; this.dirty = true;
    if (!offer.owned) { this.guide.action('upgrade'); this.hud?.pulse('purchase'); this.telemetry?.purchase(target, before - this.economy.coins, this.economy.remaining, this.economy.levels.sale,purchaseBefore?{before:purchaseBefore,after:this.purchaseState()}:undefined); }
    this.feedback?.notice(offer.owned ? `${t('equipped')}: ${offer.name}` : t('boughtItem', { name: offer.name }));
    this.message(offer.owned ? 'equipped' : 'boughtItem', { name: offer.name });
    this.refreshHUD(); this.saveNow(); return true;
  }
  private refreshEvent(force = true) {
    const seconds = this.saleEvent.remainingSeconds;
    if (!force && seconds === this.displayedEventSeconds) return;
    this.displayedEventSeconds = seconds;
    const node = document.querySelector<HTMLElement>('#sale-event');
    if (node) { node.hidden = !this.saleEvent.active; node.textContent = `${t('saleEventActive')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  }
  replayGuide() { this.guide.replay(); }
  private jump() {
    this.telemetry?.event('jumpAttempt');
    if (this.paused) return;
    if (!this.locomotion.jump()) { this.reject(t('denyAirborne')); return; }
    this.options.audio?.setWalking(false);
    this.cancelCollection('state-change'); this.player.command([]); this.destination = 'ground';
  }
  private moveManually(dt: number) {
    const input = this.input!.movement();
    if (input.lengthSq()) {
      if (this.economy.activeTool !== 4){if(this.collectionTimer>0)this.telemetry?.event('collectionCancelledByMovement');this.cancelCollection('state-change');}
      this.player.command([]); this.destination = 'ground'; this.dirty = true;
    }
    const yaw = this.camera.yaw;
    const delta = this.delta ?? new THREE.Vector2();
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), stepTime = dt / steps;
    delta.set(input.x * Math.cos(yaw) - input.y * Math.sin(yaw), -input.x * Math.sin(yaw) - input.y * Math.cos(yaw)).multiplyScalar(this.economy.movementSpeed * stepTime);
    const candidate = this.step ?? new THREE.Vector2();
    for (let i = 0; i < steps; i++) {
      const start = this.player.position;
      candidate.set(start.x + delta.x, start.y);
      if (this.movement.clear(start, candidate) && (!this.locomotion || this.locomotion.canStep(this.world.surfaceHeight(candidate.x, candidate.y)))) this.player.group.position.x = candidate.x;
      const next = this.player.position;
      candidate.set(next.x, next.y + delta.y);
      if (this.movement.clear(next, candidate) && (!this.locomotion || this.locomotion.canStep(this.world.surfaceHeight(candidate.x, candidate.y)))) this.player.group.position.z = candidate.y;
      if (this.locomotion) this.locomotion.update(stepTime, this.world.surfaceHeight(this.player.group.position.x, this.player.group.position.z));
    }
    if (this.locomotion) this.player.group.position.y = this.locomotion.height;
  }
  private cancelCollection(reason:string){if(this.collectionTimer>0){this.telemetry?.tool(this.collectionTool,'cancelled');this.telemetry?.event(`collectionCancelled:${reason}`);}this.collectionTimer=0;}
  private command(target: Target, point: THREE.Vector3, instanceId?: number,source='pointer') {
    if (this.paused) return;
    this.telemetry?.event(`command:${target}`);
    if (target === 'ground') return;
    if(target==='well'){
      if(this.player.group.position.y>1.5||Math.hypot(this.player.position.x-wellConfig.x,this.player.position.y-wellConfig.z)>wellConfig.reach){this.reject(t('denyFar'));return;}
      this.cancelCollection('menu');this.input?.reset();this.run.setRunning(false);this.wellMenu??=new WellMenu(this.meta,id=>this.purchaseMeta(id));this.wellMenu.show();return;
    }
    if(target==='diamond'){
      if(instanceId===undefined||!Number.isInteger(instanceId)||instanceId<0||instanceId>=20)return;
      const index=this.world.diamondId(instanceId);if(index===undefined)return;
      const pos=this.world.diamondPosition(index);if(!pos||this.player.group.position.distanceTo(pos)>2.5){this.reject(t('denyFar'));return;}
      this.awardGem(index);return;
    }
    if (target === 'records') {
      if (this.player.group.position.y > recordsConfig.maxHeight || Math.hypot(this.player.position.x-recordsConfig.x,this.player.position.y-recordsConfig.z) > recordsConfig.reach) { this.reject(t('denyFar')); return; }
      this.cancelCollection('menu'); this.input?.reset(); this.run.setRunning(false);
      this.showRecords(); return;
    }
    if (target === 'chest') { this.collectChest(); return; }
    if (isBarnTarget(target)) {
      if (!this.inBarnRange(target)) { this.reject(t('denyFar')); return; }
      this.hud?.flush(); this.barnCard?.show(target); return;
    }
    if(target==='hay'&&this.economy.inventory>=this.economy.capacity)this.telemetry?.tool(this.economy.activeTool,'fullAttempts',source);
    if (target === 'hay' && this.collectionTimer > 0){this.telemetry?.event('busyCollectionIgnored');this.telemetry?.tool(this.economy.activeTool,'busy',source);return;}
    if (this.won || (target === 'needle' && this.economy.remaining > 0)) return;
    if (!this.inRange(target)) { this.reject(t('denyFar')); return; }
    if (target === 'hay') { this.collectionInput=source;this.harvestPoint = point.clone(); this.harvestId = this.world.hayIdAt(instanceId); }
    this.cancelCollection('state-change'); this.player.command([]); this.destination = target;
    this.interact();
  }
  private interact() {
    const target = this.destination;
    if (target === 'ground') { this.message('arrived'); return; }
    if (target === 'needle') {
      if (this.economy.remaining > 0 || !this.inRange('needle') || this.won) return;
      this.run.finish();this.telemetry?.final('needleFoundRunSeconds',this.run.state.activeMs/1000);const recorded=this.records.record(this.run.state);this.telemetry?.final('recordResult',recorded===undefined?'ineligible':recorded?'stored':'storage-failed');
      this.won = true;this.telemetry?.final('victoryRunSeconds',this.run.state.activeMs/1000); this.player.state = 'Winning'; this.world.hideNeedle(); this.message('wonStatus');
      this.guide.action('needle');
      this.telemetry?.finish();
      this.dirty = true; this.saveNow();this.telemetry?.save(); this.options?.onWin?.(); return;
    }
    if (target === 'hay' && this.economy.remaining === 0) { this.message('discovered'); return; }
    if (target === 'hay' && this.economy.inventory >= this.economy.capacity) { this.reject(t('denyFull')); return; }
    if (!this.inRange(target)) { this.reject(t('denyFar')); return; }
    const object = config[target];
    this.player.group.rotation.y = Math.atan2(object.x - this.player.group.position.x, object.z - this.player.group.position.z);
    if (target === 'hay') {
      this.collectionTool=this.economy.activeTool;this.telemetry?.tool(this.collectionTool,'started',this.collectionInput);
      this.collectionTimer = this.collectionDuration = this.economy.collectionSeconds;
      this.player.action('Collecting', this.collectionTimer); this.message('collecting');
    } else {
      const sold = this.economy.inventory;
      const eventBefore = this.economy.eventRevenue;
      const earned = this.economy.unload(this.saleEvent.active ? 2 : 1);
      this.telemetry?.sale(sold, earned, this.economy.eventRevenue - eventBefore);
      if (earned > 0) this.options.audio?.effect('sell'); else this.reject(t('denyEmpty'));
      this.feedback?.show('coins', earned);
      if (earned > 0) {
        const point = new THREE.Vector3(config.cart.x, 1.2, config.cart.z).project(this.camera.camera);
        this.hud?.sale(point.z < 1 ? Math.max(30, Math.min(innerWidth - 30, (point.x * .5 + .5) * innerWidth)) : innerWidth / 2, point.z < 1 ? Math.max(70, Math.min(innerHeight - 80, (-point.y * .5 + .5) * innerHeight)) : innerHeight / 2);
        this.guide.action('sell');
      }
      if (sold > 0) { this.world.depositHay(sold); this.dirty = true; }
      this.message(earned ? 'sold' : 'empty', { n: earned });
      this.dirty = true; this.saveNow();
    }
    this.refreshHUD();
  }
  private updateGameplay(dt: number) {
    if (this.collectionTimer > 0) {
      this.collectionTimer = Math.max(0, this.collectionTimer - dt);
      if (this.collectionTimer === 0 && this.inRange('hay')) {
        const amount = this.economy.collect();
        if(!amount){this.telemetry?.tool(this.collectionTool,'cancelled');this.telemetry?.event('collectionEndedEmpty');}
        if(amount>0)this.telemetry?.final('firstSuccessfulCollectionNavigationMs',performance.now());
        if (amount > 0) this.options.audio?.effect('collect');
        if (amount > 0) { this.hud?.pulse('hay'); const done = this.guide.completed; this.guide.action('collect'); if (!done && this.guide.completed) this.feedback?.notice(t('guideComplete')); }
        const receiver = this.viewModel ? this.viewModel.releasePoint(this.camera.camera) : this.player.group.position;
        const discovery = this.world.collectHay(amount, this.harvestPoint, receiver, this.harvestId, this.economy.discoveryMultiplier);
        this.feedback?.show('hay', amount);
        for(const gem of discovery.diamonds)this.awardGem(gem,false);
        const discoveryBonus = discovery?.bonus ?? 0;
        this.telemetry?.collect(this.economy.activeTool, amount, discoveryBonus);
        if (discoveryBonus) this.economy.creditDiscovery(discoveryBonus);
        if (discoveryBonus) this.feedback?.show('coins', discoveryBonus);
        if (discoveryBonus) { this.hud?.pulse('coins'); this.feedback?.notice(`${discovery.highest.badge} ${t(discovery.highest.id)}`); }
        if (amount > 0 && this.economy.inventory === this.economy.capacity) { this.hud?.pulse('full'); this.feedback?.notice(t('sellHayHint')); }
        this.message(this.economy.remaining === 0 ? 'discovered' : this.economy.inventory === this.economy.capacity ? 'collectedFull' : 'collected', { n: amount });
        if (discovery?.bonus) this.message('rareFound', { amount, n: discoveryBonus, rarity: `${discovery.highest.badge} ${t(discovery.highest.id)}` });
        if(!this.economy.remaining)this.telemetry?.final('hayClearedRunSeconds',this.run.state.activeMs/1000);
        if (this.economy.remaining === 0) this.movement = new MovementSystem([config.cart, recordsConfig, wellConfig, ...barnWalls]);
        this.dirty = true; this.refreshHUD();
        if(discovery.diamonds.length)this.saveNow();
      }else if(this.collectionTimer===0){this.telemetry?.tool(this.collectionTool,'cancelled');this.telemetry?.event('collectionEndedOutOfRange');}
    }
    this.player.update(dt);
  }
  private onPigEat = (index: number, point: THREE.Vector3, mouth: THREE.Vector3) => {
    if (!this.economy.remaining) return;
    const payout = this.economy.feedPig(this.economy.pigPortion(index));
    const discovery = this.world.collectHay(payout.amount, point, mouth);
    for(const gem of discovery.diamonds)if(!(this.gems.claimed&(1<<gem)))this.gems.drops[gem]=[point.x,.18,point.z];
    this.telemetry?.pig(payout.amount, payout.earned, discovery.bonus,index,this.economy.pigPortionLevel,this.economy.pigSpeedLevel);
    if (discovery.bonus) this.economy.creditDiscovery(discovery.bonus);
    this.feedback?.show('coins', payout.earned + discovery.bonus);
    if (!this.economy.remaining){this.telemetry?.final('hayClearedRunSeconds',this.run.state.activeMs/1000);this.message('discovered');}
    this.dirty = true; this.refreshHUD();
    if(discovery.diamonds.length){this.world.updateDiamonds(this.gems);this.saveNow();}
  };
  private awardGem(index:number,persist=true){
    if(this.gems.claimed&(1<<index))return;
    if(!this.meta.award())return;this.gems.claimed|=1<<index;this.gems.drops[index]=null;
    this.telemetry?.event('diamondCollected');
    this.feedback?.notice(t('diamondFound'));this.options.audio?.effect('sell');this.dirty=true;this.refreshHUD();
    if(persist){this.world.updateDiamonds(this.gems);this.saveNow();}
  }
  private purchaseMeta(id:MetaId){
    if(performance.now()-this.lastMetaPurchaseAt<presentation.purchaseGuardMs)return;
    const price=this.meta.price(id);if(price===null){this.reject(t('denyMax'));return;}
    if(price>this.meta.diamonds){this.reject(t('metaMissing',{n:price-this.meta.diamonds}));return;}
    if(!this.meta.buy(id))return;this.lastMetaPurchaseAt=performance.now();this.telemetry?.event(`metaPurchase:${id}`);this.dirty=true;this.saveNow();this.options.audio?.effect('sell');this.wellMenu?.render();this.wellMenu?.feedback(t('metaNextRun'));this.refreshHUD();
  }
  private progressSnapshot():MemoryProgress{return {levels:{...this.economy.levels},toolVolumes:[...this.economy.toolVolumes],toolSpecials:[...this.economy.toolSpecials],pigCount:this.economy.pigCount,pigPortionLevel:this.economy.pigPortionLevel,pigSpeedLevel:this.economy.pigSpeedLevel};}
  private captureMemory(){if(this.meta.profile.bought.memory)this.meta.profile.memoryProgress=this.progressSnapshot();}
  metaSnapshot(){this.captureMemory();return this.meta.snapshot();}
  private buy(action: ShopAction) {
    let success = false;
    const purchaseBefore=this.telemetry?.isEnabled?this.purchaseState():undefined;
    const before = this.economy.coins;
    if (action.kind === 'character') {
      success = this.economy.buy(action.id); this.lastBought = action.id;
    } else if (action.kind === 'pig') success = this.economy.upgradePig(action.upgrade);
    else if (action.kind === 'equip') success = this.economy.equip(action.tool);
    else success = this.economy.upgradeTool(action.tool, action.kind);
    if (!success) { this.reject(this.purchaseRejection(action)); return false; }
    this.cancelCollection('state-change'); this.player.command([]); this.destination = 'ground';
    this.player.movementSpeed = this.economy.movementSpeed; this.dirty = true;
    if (action.kind !== 'equip') { this.hud?.pulse('purchase'); this.guide.action('upgrade'); this.telemetry?.purchase(action.kind === 'character' ? action.id : action.kind === 'pig' ? `pig-${action.upgrade}` : `tool${action.tool}-${action.kind}`, before - this.economy.coins, this.economy.remaining, this.economy.levels.sale,purchaseBefore?{before:purchaseBefore,after:this.purchaseState()}:undefined); }
    if (action.kind === 'character') this.message('bought', { effect: this.economy.effect(action.id) });
    else this.message(action.kind === 'equip' ? 'equipped' : 'boughtItem', { name: t(action.kind === 'volume' ? 'volumeUpgrade' : 'specialization') });
    this.refreshHUD(); this.saveNow(); return true;
  }
  private refreshHUD() {
    const diamonds=document.querySelector('#diamonds');if(diamonds)diamonds.textContent=String(this.meta.diamonds);
    this.hud?.set(this.economy.coins, this.economy.inventory, this.economy.capacity, this.economy.remaining, this.runTotal);
    this.player.setInventory(this.economy.inventory, this.economy.capacity);
    this.viewModel?.setInventory(this.economy.inventory, this.economy.activeTool); this.world.updateBarn(this.economy); this.shop?.render(); this.updateAimLabel();
    this.barnCard?.render();
  }
  private updateSaveNotice() {
    const node = document.querySelector<HTMLElement>('#save-notice');
    if (node) { node.textContent = t(this.saveSystem?.available ? 'saveNotice' : 'saveUnavailable'); node.dataset.warning = String(!this.saveSystem?.available); }
  }
  private purchaseState():Record<string,unknown>{return {remaining:this.economy.remaining,inventory:this.economy.inventory,capacity:this.economy.capacity,coins:this.economy.coins,tool:this.economy.activeTool,amount:this.economy.collectionAmount,duration:this.economy.collectionSeconds,movement:this.economy.movementSpeed,salePrice:this.economy.salePrice,pigCount:this.economy.pigCount,pigPortionLevel:this.economy.pigPortionLevel,pigSpeedLevel:this.economy.pigSpeedLevel};}
  saveNow() {
    if (!this.saveSystem || this.disposed) return;
    if (!this.paused && this.metrics.readyMs) this.dirty = true;
    if (!this.dirty) return;
    const prepareStart=this.telemetry?.isEnabled?performance.now():0;
    this.captureMemory();
    const data = { startProgress:this.startProgress?copyMemory(this.startProgress):undefined,version: 9 as const, pigPriceBaseline:this.economy.pigPriceBaseline, meta:this.meta.snapshot(),buffs:{...this.buffs},gems:{claimed:this.gems.claimed,drops:this.gems.drops.map(p=>p?[...p] as [number,number,number]:null)}, run: this.run.snapshot(), chestRevenue: this.economy.chestRevenue, chestClaims: [...this.economy.chestClaims], chestState: this.chests.snapshot(), eventRevenue: this.economy.eventRevenue, eventRemainder: this.economy.eventRemainder, saleEvent: this.saleEvent.snapshot(), priceBaseline: this.economy.priceBaseline, layoutVersion: config.layoutVersion, pigPortionLevel: this.economy.pigPortionLevel, pigSpeedLevel: this.economy.pigSpeedLevel, saleRemainder: this.economy.saleRemainder, legacyProgress: this.economy.legacyProgress, saleRevenue: this.economy.saleRevenue, activeTool: this.economy.activeTool, toolVolumes: [...this.economy.toolVolumes], toolSpecials: [...this.economy.toolSpecials], pigCount: this.economy.pigCount, pigEaten: this.economy.pigEaten, totalHay: this.runTotal, hay: this.world.snapshotHay(), hayContactScale: config.hayVisual.contactScale, hayProfile: config.hayVisual.profileVersion, discoveryCoins: this.economy.discoveryCoins, rarityVersion, inventory: this.economy.inventory, coins: this.economy.coins, levels: { ...this.economy.levels },
      position: [this.player.group.position.x, this.player.group.position.z] as [number, number], yaw: this.camera.yaw, pitch: this.camera.pitch, won: this.won };
    const saveStart=performance.now();const saved=this.saveSystem.write(data,!!this.telemetry?.isEnabled);
    this.telemetry?.event(saved?'saveSuccess':'saveFailure');this.telemetry?.event('saveTotalMs',performance.now()-saveStart);
    if(this.telemetry?.isEnabled){const m=this.saveSystem.lastWriteMetrics;this.telemetry.saved(m.utf8Bytes,saveStart-prepareStart,m.serializationMs,m.storageMs,performance.now()-prepareStart,saved);}
    if(saved)this.dirty=false;
    this.updateSaveNotice();
  }
  private updateAimLabel() {
    const node = document.querySelector('#aim-label');
    if(node&&this.aimTarget==='well'){node.textContent=t('well');return;}
    if(node&&this.aimTarget==='diamond'){node.textContent=t('diamonds');return;}
    if (node && this.aimTarget === 'records') { node.textContent=t('recordsAim'); return; }
    if (node && this.aimTarget === 'chest') { node.textContent = this.chests.active ? t('chestAim', { n: chestBalance.rewards[this.chests.active.stage] }) : ''; return; }
    if (node && this.aimTarget && isBarnTarget(this.aimTarget)) {
      const offer = this.economy.barnOffer(this.aimTarget);
      node.textContent = t(offer.owned ? 'barnOwnedAim' : offer.price === null ? 'barnMaxAim' : 'barnAim', { name: offer.name, price: offer.price ?? 0 }) + (offer.locked ? ` / ${t('previousTool')}` : '');
      return;
    }
    if (node) node.textContent = this.aimTarget === 'hay' ? t('aimHay') : this.aimTarget === 'cart' ? t('aimCartCount', { n: this.world.cargoCount }) : this.aimTarget === 'needle' ? t('needle') : '';
    if (node && this.aimTarget === 'hay' && this.aimRarity.bonus) node.textContent = t('aimRare', { rarity: `${this.aimRarity.badge} ${t(this.aimRarity.id)}`, n: Math.ceil(this.aimRarity.bonus * this.economy.discoveryMultiplier) });
  }
  refreshLanguage() {
    this.refreshHUD();
    this.refreshEvent();
    this.leaderboard?.render();this.wellMenu?.render();
    if (this.statusKey === 'bought' && this.lastBought) this.statusVars.effect = this.economy.effect(this.lastBought);
    this.status.textContent = t(this.statusKey, this.statusVars); this.updateSaveNotice(); this.updateAimLabel();
    this.renderer.domElement.setAttribute('aria-label', t('world'));
  }
  showRecords() { this.run.setRunning(false); this.leaderboard ??= new Leaderboard(this.records); this.leaderboard.show(); }
  private startTelemetrySegment(){this.run.state.playtestId??=globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);this.run.state.playtestSegment=(this.run.state.playtestSegment??0)+1;this.dirty=true;}
  setEconomyTelemetry(value: boolean) {if(value&&!this.telemetry?.isEnabled)this.startTelemetrySegment(); this.telemetry?.setEnabled(value, this.economy.remaining); if(value&&this.background)this.telemetry?.pause('background');else if (value && this.menuOpen) this.telemetry?.pause('menu'); }
  downloadEconomyMetrics() { return this.telemetry?.download(); }
  resetEconomyMetrics() {if(this.telemetry?.isEnabled)this.startTelemetrySegment(); this.telemetry?.reset(this.economy.remaining); }
  setReducedMotion(reduced: boolean) { this.world.reducedMotion = reduced; if (this.viewModel) this.viewModel.reducedMotion = reduced; if (this.feedback) { this.feedback.reducedMotion = reduced; if (reduced) this.feedback.stop(); } if (this.hud) { this.hud.reducedMotion = reduced; this.hud.stop(); } }
  private playtestContext():Record<string,unknown>{return {revision:'pigs-x3-memory50-reach1.5',sessionLink:{runId:this.run.state.playtestId??null,segment:this.run.state.playtestSegment??null,runClockSeconds:this.run.state.activeMs/1000},chestActive:!!this.chests.active,remaining:this.economy.remaining,inventory:this.economy.inventory,capacity:this.economy.capacity,coins:this.economy.coins,levels:{...this.economy.levels},toolVolumes:[...this.economy.toolVolumes],toolSpecials:[...this.economy.toolSpecials],activeTool:this.economy.activeTool,pigCount:this.economy.pigCount,pigPortionLevel:this.economy.pigPortionLevel,pigSpeedLevel:this.economy.pigSpeedLevel,buffs:{...this.buffs},diamonds:this.meta.diamonds,metaBought:{...this.meta.profile.bought},runActiveSeconds:this.run.state.activeMs/1000,runEligible:this.run.state.eligible,won:this.won,tutorial:this.guide.diagnostics,balance:{totalHay:this.runTotal,collectionRangeMultiplier:config.collectionRangeMultiplier,pigPrices:[...pigBalance.prices],pigPortions:[...pigBalance.portions],pigPortionStep:pigUpgrades.portionStep},startup:{readyMs:this.metrics.readyMs,navigationFirstFrameMs:this.metrics.startupMs,initialTransferBytes:this.metrics.initialTransferBytes},cartModelStatus:this.world.cartModelStatus,saveAvailable:this.saveSystem?.available,saveInvalid:this.saveSystem?.invalid,viewport:[innerWidth,innerHeight],renderBuffer:[this.renderer.domElement.width,this.renderer.domElement.height],renderPixelRatio:this.renderer.getPixelRatio(),language:this.options.settings?.language,reducedMotion:this.options.settings?.reducedMotion};}
  diagnostics() { return { ...this.metrics, remaining: this.economy.remaining, inventory: this.economy.inventory, coins: this.economy.coins, cargo: this.world.cargoCount, activeTool: this.economy.activeTool, pigCount: this.economy.pigCount, pigEaten: this.economy.pigEaten, salePrice: this.economy.salePrice, won: this.won, paused: this.paused, position: [this.player.group.position.x, this.player.group.position.z], yaw: this.camera.yaw, pitch: this.camera.pitch, height: this.locomotion.height, grounded: this.locomotion.grounded, cartModelStatus: this.world.cartModelStatus, saleEvent: this.saleEvent.snapshot(), eventRevenue: this.economy.eventRevenue, tutorialCompleted: this.guide.completed, chest: this.chests.snapshot(), chestRevenue: this.economy.chestRevenue }; }
  dispose(save = true) {
    if (this.disposed) return;
    if (save) this.saveNow();
    this.options.audio?.stopEffects();
    this.telemetry?.final('endReason',save?'dispose':this.metrics.readyMs?'new-game':'initialization-failure');this.telemetry?.dispose();
    this.disposed = true; this.controller.abort(); this.resizeObserver?.disconnect(); this.observer?.disconnect();
    this.input?.dispose(); this.shop?.dispose(); this.barnCard?.dispose(); this.leaderboard?.dispose(); this.wellMenu?.dispose(); this.chestTimer?.dispose(); this.guide.dispose(); this.hud?.dispose(); this.renderer?.setAnimationLoop(null);
    this.world.dispose(); this.viewModel?.dispose(); this.feedback?.dispose(); disposeTree(this.player.group);
    this.renderer?.renderLists.dispose(); this.renderer?.forceContextLoss(); this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}

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
import { barnItems, barnWalls, isBarnTarget, pigUpgrades, pigUpgradePrice, toolUpgradeLimits, toolUpgradePrice } from '../config/progression';
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

type Options = { audio?: AudioManager; settings?: Settings; onReady?: () => void; onWin?: () => void; onError?: (message: string) => void };
export class Game {
  private renderer!: THREE.WebGLRenderer;
  private world = new World();
  private player = new Player();
  private camera = new CameraController();
  private economy = new EconomySystem();
  private movement = new MovementSystem([config.cart, ...barnWalls]);
  private locomotion = new Locomotion();
  private destination: 'ground' | 'hay' | 'cart' | 'needle' = 'ground';
  private collectionTimer = 0;
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
  private telemetry?: EconomyTelemetry;
  private measurePig = (mode: 'wander' | 'approach' | 'waiting', dt: number) => this.telemetry?.pigActivity(mode, dt);
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
      const saved = this.saveSystem!.read();
      if (saved) {
        try {
          const remaining = decodeHay(saved.hay).length / 8;
          const sourceTotal = saved.totalHay ?? 10000;
          const restoredRemaining = this.world.restore(saved.hay, sourceTotal - remaining - saved.inventory - (saved.pigEaten ?? 0), saved.won, saved.hayContactScale ?? 1, sourceTotal, saved.hayProfile ?? 0);
          this.runTotal = saved.won ? sourceTotal : config.totalHay;
          this.dirty = saved.version !== 5 || saved.hayProfile !== config.hayVisual.profileVersion || saved.hayContactScale !== config.hayVisual.contactScale || saved.totalHay === undefined || (!saved.won && sourceTotal !== config.totalHay);
          Object.assign(this.economy.levels, saved.levels);
          this.economy.remaining = restoredRemaining; this.economy.inventory = saved.inventory; this.economy.coins = saved.coins;
          this.economy.discoveryCoins = saved.discoveryCoins ?? 0;
          this.economy.saleRevenue = saved.saleRevenue ?? (sourceTotal - remaining - saved.inventory) * config.salePrice;
          this.economy.pigPortionLevel = saved.pigPortionLevel ?? 0; this.economy.pigSpeedLevel = saved.pigSpeedLevel ?? 0;
          this.economy.saleRemainder = saved.saleRemainder ?? 0; this.economy.legacyProgress = saved.legacyProgress; this.economy.priceBaseline = saved.priceBaseline;
          this.economy.eventRevenue = saved.eventRevenue ?? 0; this.economy.eventRemainder = saved.eventRemainder ?? 0;
          this.saleEvent = new SaleEvent(saved.saleEvent);
          this.economy.pigCount = saved.pigCount ?? 0; this.economy.pigEaten = saved.pigEaten ?? 0;
          this.economy.activeTool = saved.activeTool ?? saved.levels.tools;
          for (let i = 0; i < 4; i++) {
            this.economy.toolVolumes[i] = saved.toolVolumes?.[i] ?? 0;
            this.economy.toolSpecials[i] = saved.toolSpecials?.[i] ?? 0;
          }
          this.player.group.position.set(saved.position[0], 0, saved.position[1]);
          this.player.movementSpeed = this.economy.movementSpeed;
          this.camera.yaw = saved.yaw; this.camera.pitch = saved.pitch; this.won = saved.won;
          if (!restoredRemaining) this.movement = new MovementSystem([config.cart, ...barnWalls]);
          if (saved.layoutVersion !== config.layoutVersion || !this.movement.walkable(this.player.position)) {
            this.player.group.position.set(config.playerSpawn.x, 0, config.playerSpawn.z);
            this.camera.yaw = -Math.atan2(config.hay.x - config.playerSpawn.x, config.playerSpawn.z - config.hay.z);
            this.camera.pitch = config.firstPerson.startPitch;
            this.dirty = true;
          }
        } catch { this.saveSystem!.invalid = true; }
      }
      this.telemetry = new EconomyTelemetry(this.economy.remaining, !!options.settings?.economyTelemetry, !!saved);
      this.locomotion.height = this.world.surfaceHeight(this.player.group.position.x, this.player.group.position.z);
      this.player.group.position.y = this.locomotion.height;
      this.camera.follow(this.player.position, this.locomotion.height);
      this.input = new InputManager(this.renderer.domElement, this.camera.camera, this.world.pickables,
        (target, point, instanceId) => this.command(target, point, instanceId),
        (dx, dy) => { this.camera.look(dx, dy); this.dirty = true; },
        (instanceId, target) => {
          this.world.highlightHay(this.paused ? undefined : this.collectionTimer > 0 ? this.harvestId : this.world.hayIdAt(instanceId));
          const next = this.paused ? undefined : target;
          this.world.highlightBarn(next && isBarnTarget(next) && this.inBarnRange(next) ? next : undefined);
          document.querySelector('.crosshair')?.classList.toggle('has-target', !!next);
          const rarity = next === 'hay' ? strawRarity(this.world.hayIdAt(instanceId)) : strawRarity();
          if (this.aimTarget !== next || this.aimRarity.id !== rarity.id) { this.aimTarget = next; this.aimRarity = rarity; this.updateAimLabel(); }
        },
        () => this.paused, () => this.jump(), () => this.economy.activeTool === 4);
      this.resizeObserver = new ResizeObserver(() => {
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        this.camera.resize(width, height); this.renderer.setSize(width, height);
        this.needsRender = true;
      });
      this.resizeObserver.observe(host);
      const { width, height } = host.getBoundingClientRect(); this.camera.resize(width, height); this.renderer.setSize(width, height);
      this.refreshHUD(); this.shop = new Shop(this.economy, id => this.buy(id), text => this.reject(text));
      this.barnCard = new BarnCard(this.economy, target => this.purchaseBarn(target), text => this.reject(text));
      const signal = this.controller.signal;
      const syncPause = () => {
        this.menuOpen = !!document.querySelector('dialog[open]');
        if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume();
        this.status.setAttribute('aria-live', this.menuOpen ? 'off' : 'polite');
        this.previous = performance.now();
        this.input?.reset();
        this.hud?.stop(); this.feedback?.stop(); this.guide.hide();
        if (this.menuOpen) this.collectionTimer = 0;
        this.needsRender = true;
      };
      this.observer = new MutationObserver(syncPause);
      this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      syncPause();
      document.addEventListener('visibilitychange', () => { this.background = document.hidden; if (this.background) this.telemetry?.pause('background'); else if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume(); this.previous = performance.now(); this.input?.reset(); this.hud?.stop(); this.feedback?.stop(); this.guide.hide(); this.saveNow(); }, { signal });
      window.addEventListener('blur', () => { this.background = true; this.telemetry?.pause('background'); this.input?.reset(); this.hud?.stop(); this.feedback?.stop(); this.guide.hide(); this.saveNow(); }, { signal });
      window.addEventListener('focus', () => { this.background = document.hidden; if (!this.background) { if (this.menuOpen) this.telemetry?.pause('menu'); else this.telemetry?.resume(); } this.previous = performance.now(); }, { signal });
      window.addEventListener('pagehide', () => this.saveNow(), { signal });
      this.renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); this.contextLost = true; this.input?.reset(); this.saveNow(); this.message('contextLost');
      }, { signal });
      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.contextLost = false; this.previous = performance.now(); this.renderer.shadowMap.needsUpdate = true; this.needsRender = true;
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
      if (!this.paused) {
        this.stepSoundStart.copy(this.player.position);
        this.moveManually(dt);
        if (this.economy.activeTool === 4 && !this.input?.holdingCollection()) this.collectionTimer = 0;
        this.input?.updateHeld(dt, this.collectionTimer === 0 && this.economy.inventory < this.economy.capacity && this.economy.remaining > 0 && this.inRange('hay'));
        const collecting = this.collectionTimer > 0;
        this.updateGameplay(dt);
        if (this.metrics.readyMs) this.telemetry?.tick(elapsed / 1000, this.stepSoundStart.distanceTo(this.player.position), collecting, this.economy.activeTool, this.economy.remaining, this.saleEvent.active, dt);
        if (this.saleEvent.update(dt, this.guide.completed)) { this.dirty = true; this.refreshEvent(); this.saveNow(); }
        if (this.guide.completed || this.saleEvent.active) this.dirty = true;
        this.world.updatePigs(dt, this.economy.pigCount, this.onPigEat, this.economy.pigIntervalMultiplier, this.options.settings?.economyTelemetry ? this.measurePig : undefined); this.world.updateHay(dt);
        this.player.group.position.y = this.locomotion.height;
        this.options.audio?.setWalking(this.locomotion.grounded && this.stepSoundStart.distanceToSquared(this.player.position) > .000001, this.economy.movementSpeed / config.movementSpeed);
        this.viewModel?.update(dt, this.collectionTimer, this.collectionDuration || this.economy.collectionSeconds);
        this.saveAge += dt;
        if (this.saveAge >= 5) { this.saveAge = 0; this.saveNow(); }
      }
      this.camera.follow(this.player.position, this.locomotion.height);
      this.guide.update(dt, this.paused, this.economy, this.inRange('hay'), this.inRange('cart'), this.camera.camera, !!this.options.settings?.reducedMotion);
      this.world.scene.updateMatrixWorld(); this.input?.updateAim(dt, this.paused);
      this.renderer.shadowMap.needsUpdate = this.world.takeShadowUpdate();
      this.renderer.info.autoReset = false; this.renderer.info.reset();
      this.renderer.render(this.world.scene, this.camera.camera); this.viewModel?.render(this.renderer, this.camera.camera);
      this.needsRender = false;
      if (!this.metrics.readyMs) {
        this.metrics.readyMs = performance.now() - this.boot;
        this.metrics.startupMs = performance.now();
        this.metrics.initialTransferBytes = performance.getEntriesByType('resource').reduce((sum, item) => sum + (item as PerformanceResourceTiming).transferSize, 0);
        this.options.onReady?.();
        this.world.loadNoncriticalAssets();
      }
      this.frameTotal += elapsed; this.frameSamples++;
      if (this.frameSamples >= 60) {
        // Plain data for diagnostics; no per-frame DOM telemetry.
        this.metrics = { samples: this.metrics.samples + 1, frameMs: this.frameTotal / this.frameSamples, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
          geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, readyMs: this.metrics.readyMs || performance.now() - this.boot, startupMs: this.metrics.startupMs, initialTransferBytes: this.metrics.initialTransferBytes };
        this.frameSamples = 0; this.frameTotal = 0;
      }
    } catch (error) {
      console.error(error); this.failed = true; this.input?.reset(); this.saveNow();
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
    return this.player.position.distanceTo(this.step ? this.step.set(object.x, object.z) : new THREE.Vector2(object.x, object.z)) <= object.radius + config.playerRadius + config.interactionGap + config.interactionTolerance + (target === 'hay' ? this.economy.collectionReach : 0);
  }
  private inBarnRange(target: keyof typeof barnItems) {
    const item = barnItems[target];
    return Math.hypot(this.player.group.position.x - item.x, this.player.group.position.z - item.z) <= 1.9 && this.player.group.position.y <= 1;
  }
  private reject(text: string) {
    if (this.disposed || this.failed) return;
    const now = performance.now();
    if (now - this.lastRejectionAt < presentation.rejectionCooldownMs) return;
    this.lastRejectionAt = now;
    const focusedDialog = document.activeElement?.closest<HTMLDialogElement>('dialog[open]');
    const dialog = focusedDialog ?? Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1);
    if (dialog) {
      let node = dialog.querySelector<HTMLElement>('[data-barn-feedback], [data-book-feedback], [data-denial-feedback]');
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
    const before = this.economy.coins;
    if (!this.economy.buyAtBarn(target)) { this.reject(offer.locked ? t('denyPrevious') : this.priceRejection(offer.price)); return false; }
    this.collectionTimer = 0; this.player.command([]); this.destination = 'ground'; this.dirty = true;
    if (!offer.owned) { this.guide.action('upgrade'); this.hud?.pulse('purchase'); this.telemetry?.purchase(target, before - this.economy.coins, this.economy.remaining, this.economy.levels.sale); }
    this.feedback?.notice(offer.owned ? `${t('equipped')}: ${offer.name}` : t('boughtItem', { name: offer.name }));
    this.message(offer.owned ? 'equipped' : 'boughtItem', { name: offer.name });
    this.refreshHUD(); this.saveNow(); return true;
  }
  private refreshEvent() {
    const node = document.querySelector<HTMLElement>('#sale-event');
    if (node) { node.hidden = !this.saleEvent.active; node.textContent = t('saleEventActive'); }
  }
  replayGuide() { this.guide.replay(); }
  private jump() {
    if (this.paused) return;
    if (!this.locomotion.jump()) { this.reject(t('denyAirborne')); return; }
    this.options.audio?.setWalking(false);
    this.collectionTimer = 0; this.player.command([]); this.destination = 'ground';
  }
  private moveManually(dt: number) {
    const input = this.input!.movement();
    if (input.lengthSq()) {
      if (this.economy.activeTool !== 4) this.collectionTimer = 0;
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
  private command(target: Target, point: THREE.Vector3, instanceId?: number) {
    if (this.paused) return;
    if (target === 'ground') return;
    if (isBarnTarget(target)) {
      if (!this.inBarnRange(target)) { this.reject(t('denyFar')); return; }
      this.hud?.flush(); this.barnCard?.show(target); return;
    }
    if (target === 'hay' && this.collectionTimer > 0) return;
    if (this.won || (target === 'needle' && this.economy.remaining > 0)) return;
    if (!this.inRange(target)) { this.reject(t('denyFar')); return; }
    if (target === 'hay') { this.harvestPoint = point.clone(); this.harvestId = this.world.hayIdAt(instanceId); }
    this.collectionTimer = 0; this.player.command([]); this.destination = target;
    this.interact();
  }
  private interact() {
    const target = this.destination;
    if (target === 'ground') { this.message('arrived'); return; }
    if (target === 'needle') {
      if (this.economy.remaining > 0 || !this.inRange('needle') || this.won) return;
      this.won = true; this.player.state = 'Winning'; this.world.hideNeedle(); this.message('wonStatus');
      this.guide.action('needle');
      this.telemetry?.finish();
      this.dirty = true; this.saveNow(); this.options?.onWin?.(); return;
    }
    if (target === 'hay' && this.economy.remaining === 0) { this.message('discovered'); return; }
    if (target === 'hay' && this.economy.inventory >= this.economy.capacity) { this.reject(t('denyFull')); return; }
    if (!this.inRange(target)) { this.reject(t('denyFar')); return; }
    const object = config[target];
    this.player.group.rotation.y = Math.atan2(object.x - this.player.group.position.x, object.z - this.player.group.position.z);
    if (target === 'hay') {
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
        if (amount > 0) this.options.audio?.effect('collect');
        if (amount > 0) { this.hud?.pulse('hay'); const done = this.guide.completed; this.guide.action('collect'); if (!done && this.guide.completed) this.feedback?.notice(t('guideComplete')); }
        const receiver = this.viewModel ? this.viewModel.releasePoint(this.camera.camera) : this.player.group.position;
        const discovery = this.world.collectHay(amount, this.harvestPoint, receiver, this.harvestId, this.economy.discoveryMultiplier);
        this.feedback?.show('hay', amount);
        const discoveryBonus = discovery?.bonus ?? 0;
        this.telemetry?.collect(this.economy.activeTool, amount, discoveryBonus);
        if (discoveryBonus) this.economy.creditDiscovery(discoveryBonus);
        if (discoveryBonus) this.feedback?.show('coins', discoveryBonus);
        if (discoveryBonus) { this.hud?.pulse('coins'); this.feedback?.notice(`${discovery.highest.badge} ${t(discovery.highest.id)}`); }
        if (amount > 0 && this.economy.inventory === this.economy.capacity) { this.hud?.pulse('full'); this.feedback?.notice(t('sellHayHint')); }
        this.message(this.economy.remaining === 0 ? 'discovered' : this.economy.inventory === this.economy.capacity ? 'collectedFull' : 'collected', { n: amount });
        if (discovery?.bonus) this.message('rareFound', { amount, n: discoveryBonus, rarity: `${discovery.highest.badge} ${t(discovery.highest.id)}` });
        if (this.economy.remaining === 0) this.movement = new MovementSystem([config.cart, ...barnWalls]);
        this.dirty = true; this.refreshHUD();
      }
    }
    this.player.update(dt);
  }
  private onPigEat = (index: number, point: THREE.Vector3, mouth: THREE.Vector3) => {
    if (!this.economy.remaining) return;
    const payout = this.economy.feedPig(this.economy.pigPortion(index));
    const discovery = this.world.collectHay(payout.amount, point, mouth);
    this.telemetry?.pig(payout.amount, payout.earned, discovery.bonus);
    if (discovery.bonus) this.economy.creditDiscovery(discovery.bonus);
    this.feedback?.show('coins', payout.earned + discovery.bonus);
    if (!this.economy.remaining) this.message('discovered');
    this.dirty = true; this.refreshHUD();
  };
  private buy(action: ShopAction) {
    let success = false;
    const before = this.economy.coins;
    if (action.kind === 'character') {
      success = this.economy.buy(action.id); this.lastBought = action.id;
    } else if (action.kind === 'pig') success = this.economy.upgradePig(action.upgrade);
    else if (action.kind === 'equip') success = this.economy.equip(action.tool);
    else success = this.economy.upgradeTool(action.tool, action.kind);
    if (!success) { this.reject(this.purchaseRejection(action)); return false; }
    this.collectionTimer = 0; this.player.command([]); this.destination = 'ground';
    this.player.movementSpeed = this.economy.movementSpeed; this.dirty = true;
    if (action.kind !== 'equip') { this.hud?.pulse('purchase'); this.guide.action('upgrade'); this.telemetry?.purchase(action.kind === 'character' ? action.id : action.kind === 'pig' ? `pig-${action.upgrade}` : `tool${action.tool}-${action.kind}`, before - this.economy.coins, this.economy.remaining, this.economy.levels.sale); }
    if (action.kind === 'character') this.message('bought', { effect: this.economy.effect(action.id) });
    else this.message(action.kind === 'equip' ? 'equipped' : 'boughtItem', { name: t(action.kind === 'volume' ? 'volumeUpgrade' : 'specialization') });
    this.refreshHUD(); this.saveNow(); return true;
  }
  private refreshHUD() {
    this.hud?.set(this.economy.coins, this.economy.inventory, this.economy.capacity, this.economy.remaining, this.runTotal);
    this.player.setInventory(this.economy.inventory, this.economy.capacity);
    this.viewModel?.setInventory(this.economy.inventory, this.economy.activeTool); this.world.updateBarn(this.economy); this.shop?.render(); this.updateAimLabel();
    this.barnCard?.render();
  }
  private updateSaveNotice() {
    const node = document.querySelector<HTMLElement>('#save-notice');
    if (node) { node.textContent = t(this.saveSystem?.available ? 'saveNotice' : 'saveUnavailable'); node.dataset.warning = String(!this.saveSystem?.available); }
  }
  saveNow() {
    if (!this.dirty || !this.saveSystem || this.disposed) return;
    const data = { version: 5 as const, eventRevenue: this.economy.eventRevenue, eventRemainder: this.economy.eventRemainder, saleEvent: this.saleEvent.snapshot(), priceBaseline: this.economy.priceBaseline, layoutVersion: config.layoutVersion, pigPortionLevel: this.economy.pigPortionLevel, pigSpeedLevel: this.economy.pigSpeedLevel, saleRemainder: this.economy.saleRemainder, legacyProgress: this.economy.legacyProgress, saleRevenue: this.economy.saleRevenue, activeTool: this.economy.activeTool, toolVolumes: [...this.economy.toolVolumes], toolSpecials: [...this.economy.toolSpecials], pigCount: this.economy.pigCount, pigEaten: this.economy.pigEaten, totalHay: this.runTotal, hay: this.world.snapshotHay(), hayContactScale: config.hayVisual.contactScale, hayProfile: config.hayVisual.profileVersion, discoveryCoins: this.economy.discoveryCoins, rarityVersion, inventory: this.economy.inventory, coins: this.economy.coins, levels: { ...this.economy.levels },
      position: [this.player.group.position.x, this.player.group.position.z] as [number, number], yaw: this.camera.yaw, pitch: this.camera.pitch, won: this.won };
    if (this.saveSystem.write(data)) this.dirty = false;
    this.updateSaveNotice();
  }
  private updateAimLabel() {
    const node = document.querySelector('#aim-label');
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
    if (this.statusKey === 'bought' && this.lastBought) this.statusVars.effect = this.economy.effect(this.lastBought);
    this.status.textContent = t(this.statusKey, this.statusVars); this.updateSaveNotice(); this.updateAimLabel();
    this.renderer.domElement.setAttribute('aria-label', t('world'));
  }
  setEconomyTelemetry(value: boolean) { this.telemetry?.setEnabled(value, this.economy.remaining); if (value && this.menuOpen) this.telemetry?.pause('menu'); }
  downloadEconomyMetrics() { return this.telemetry?.download(); }
  resetEconomyMetrics() { this.telemetry?.reset(this.economy.remaining); }
  setReducedMotion(reduced: boolean) { this.world.reducedMotion = reduced; if (this.viewModel) this.viewModel.reducedMotion = reduced; if (this.feedback) { this.feedback.reducedMotion = reduced; if (reduced) this.feedback.stop(); } if (this.hud) { this.hud.reducedMotion = reduced; this.hud.stop(); } }
  diagnostics() { return { ...this.metrics, remaining: this.economy.remaining, inventory: this.economy.inventory, coins: this.economy.coins, cargo: this.world.cargoCount, activeTool: this.economy.activeTool, pigCount: this.economy.pigCount, pigEaten: this.economy.pigEaten, salePrice: this.economy.salePrice, won: this.won, paused: this.paused, position: [this.player.group.position.x, this.player.group.position.z], yaw: this.camera.yaw, pitch: this.camera.pitch, height: this.locomotion.height, grounded: this.locomotion.grounded, cartModelStatus: this.world.cartModelStatus, saleEvent: this.saleEvent.snapshot(), eventRevenue: this.economy.eventRevenue, tutorialCompleted: this.guide.completed }; }
  dispose(save = true) {
    if (this.disposed) return;
    if (save) this.saveNow();
    this.options.audio?.stopEffects();
    this.telemetry?.dispose();
    this.disposed = true; this.controller.abort(); this.resizeObserver?.disconnect(); this.observer?.disconnect();
    this.input?.dispose(); this.shop?.dispose(); this.barnCard?.dispose(); this.guide.dispose(); this.hud?.dispose(); this.renderer?.setAnimationLoop(null);
    this.world.dispose(); this.viewModel?.dispose(); this.feedback?.dispose(); disposeTree(this.player.group);
    this.renderer?.renderLists.dispose(); this.renderer?.forceContextLoss(); this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}

import { NoticeBoard } from './NoticeBoard';
﻿import * as THREE from 'three';
import { Haystack } from './Haystack';
import { config } from '../config/balance';
import { CartCargo } from './CartCargo';
import { Needle } from './Needle';
import { Barn } from './Barn';
import { PigHerd } from './PigHerd';
import { ToolAssets } from './ToolAssets';
import type { BarnTarget } from '../config/progression';
import type { EconomySystem } from '../systems/EconomySystem';
import { disposeTree } from '../core/dispose';
import { presentation } from '../config/presentation';
import { RewardChest } from './RewardChest';
import type { ActiveChest } from '../systems/ChestEvent';
export type Target = 'ground' | 'hay' | 'cart' | 'needle' | 'chest' | 'records' | BarnTarget;
export class World {
  readonly scene = new THREE.Scene();
  readonly pickables: THREE.Object3D[] = [];
  private hay = new Haystack();
  private cargo = new CartCargo();
  private needle = new Needle();
  private needleAdded = false;
  reducedMotion = false;
  private shadowDirty = true;
  private disposed = false;
  private modelRequested = false;
  cartModelStatus: 'idle' | 'loading' | 'ready' | 'fallback' = 'idle';
  private cart = new THREE.Group();
  private cartFallback = new THREE.Group();
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BoxGeometry>();
  readonly toolAssets = new ToolAssets();
  private barn?: Barn;
  private barnHighlight?: THREE.BoxHelper;
  private selectedBarn?: BarnTarget;
  private latestEconomy?: EconomySystem;
  private optionalTimer?: ReturnType<typeof setTimeout>;
  private chest?: RewardChest;
  private pigs = new PigHerd(this.toolAssets);
  private pigSurface = (x: number, z: number) => this.surfaceHeight(x, z);
  private pigFeed = (point: THREE.Vector2) => this.hay.feedingPoint(point);

  constructor() {
    this.scene.background = new THREE.Color(0x36c9ff);
    this.scene.fog = new THREE.Fog(0x36c9ff, 32, 90);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b28a, 1.8));
    const sun = new THREE.DirectionalLight(0xfff3ce, 2.3);
    sun.position.set(-10, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 0.5, far: 65 });
    sun.shadow.normalBias = 0.04; this.scene.add(sun);
    this.box(this.scene, [config.worldHalfSize * 2 + 1, 0.5, config.worldHalfSize * 2 + 1], [0, -0.3, 0], 0x986239);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(config.worldHalfSize * 2, config.worldHalfSize * 2), new THREE.MeshStandardMaterial({ color: 0x67d83d, roughness: 0.85 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.035; ground.receiveShadow = true;
    ground.userData.target = 'ground'; this.scene.add(ground); this.pickables.push(ground);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.8, 9), new THREE.MeshStandardMaterial({ color: 0xe4b96b }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(config.hay.x, -0.025, config.hay.z); this.scene.add(patch);
    this.scene.add(this.hay.group); this.pickables.push(this.hay.mesh);
    this.scene.add(this.needle.group);
    let seed = 42;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    this.cart.position.set(config.cart.x, 0, config.cart.z);
    this.cart.rotation.y = config.cart.yaw;
    this.cart.add(this.cargo.group, this.cartFallback);
    const cart = this.cartFallback;
    this.box(cart, [1.6, 0.15, 1.55], [0, 0.64, 0], 0x6d3c24);
    for (let i = 0; i < 3; i++) {
      for (const x of [-0.78, 0.78]) this.box(cart, [0.1, 0.16, 1.65], [x, 0.8 + i * 0.22, 0], 0xb86b38);
      this.box(cart, [1.6, 0.16, 0.1], [0, 0.8 + i * 0.22, -0.78], 0xb86b38);
    }
    for (const x of [-0.88, 0.88]) for (const z of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x245b99 }));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.36, z); wheel.castShadow = true; cart.add(wheel);
      this.box(cart, [0.17, 0.12, 0.12], [x * 1.08, 0.36, z], 0xffe14a);
    }
    this.scene.add(this.cart); this.tag(this.cart, 'cart');
    const edge = config.worldHalfSize + .3;
    for (let i = 0; i <= 8; i++) {
      const along = -edge + i * edge / 4;
      for (const side of [-1, 1]) {
        this.box(this.scene, [.23, 1.1, .23], [along, .44, side * edge], 0xfff4d6);
        if (i > 0 && i < 8) this.box(this.scene, [.23, 1.1, .23], [side * edge, .44, along], 0xfff4d6);
      }
    }
    for (const y of [.3, .65]) for (const side of [-1, 1]) {
      this.box(this.scene, [edge * 2, .16, .14], [0, y, side * edge], 0xfff4d6);
      this.box(this.scene, [.14, .16, edge * 2], [side * edge, y, 0], 0xfff4d6);
    }
    for (const [x, z] of [[-14, -8], [-14, 4], [8, -14]]) {
      this.box(this.scene, [0.25, 1.5, 0.25], [x, 0.5, z], 0x836849);
      this.box(this.scene, [1.8, 1.25, 1.7], [x, 1.85, z], 0x38a92e);
      this.box(this.scene, [1.25, 0.8, 1.2], [x + 0.16, 2.75, z - 0.08], 0x67d83d);
    }
    // Background scenery stays outside the playable boundaries.
    const landscape = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x67d83d, roughness: 0.8 }));
    landscape.rotation.x = -Math.PI / 2; landscape.position.y = -0.56; this.scene.add(landscape);
    this.scene.add(this.pigs.group);
    for (const [x, z] of [[-12, -16], [10, -20], [16, 6]]) {
      this.box(this.scene, [4.5, 0.7, 2], [x, 9, z], 0xffffff);
      this.box(this.scene, [2.5, 0.8, 1.9], [x + 0.5, 9.5, z], 0xffffff);
    }
    for (let i = 0; i < 65; i++) {
      const x = (random() - 0.5) * (config.worldHalfSize * 2 - 1), z = (random() - 0.5) * (config.worldHalfSize * 2 - 1);
      if (Math.hypot(x - config.hay.x, z - config.hay.z) < 3 || Math.hypot(x - config.cart.x, z - config.cart.z) < 2) continue;
      const blade = this.box(this.scene, [0.035, 0.14, 0.035], [x, 0.04, z], 0x38a92e); blade.rotation.z = random() - 0.5;
      blade.castShadow = false;
    }
  }
  private box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], color: number) {
    const key = size.join(',');
    let geometry = this.geometries.get(key);
    if (!geometry) { geometry = new THREE.BoxGeometry(...size); this.geometries.set(key, geometry); }
    let material = this.materials.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.58 }); this.materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  updateBarn(economy: EconomySystem) { this.latestEconomy = economy; this.barn?.update(economy); }
  setChest(active?: Readonly<ActiveChest>) {
    if (!this.chest && active) { this.chest = new RewardChest(); this.scene.add(this.chest.group); }
    if (!this.chest) return;
    this.chest.set(active);
    const index = this.pickables.indexOf(this.chest.hitbox);
    if (active && index < 0) this.pickables.push(this.chest.hitbox);
    if (!active && index >= 0) this.pickables.splice(index, 1);
  }
  highlightBarn(target?: BarnTarget) {
    if (target === this.selectedBarn) return;
    this.selectedBarn = target;
    if (this.barnHighlight) this.barnHighlight.visible = false;
    const object = target && this.barn?.object(target);
    if (!object) return;
    if (!this.barnHighlight) { this.barnHighlight = new THREE.BoxHelper(object, 0xffe14a); this.scene.add(this.barnHighlight); }
    else this.barnHighlight.setFromObject(object);
    this.barnHighlight.visible = true;
  }
  updatePigs(dt: number, count: number, onEat: (index: number, point: THREE.Vector3, mouth: THREE.Vector3) => void, intervalMultiplier = 1, measure?: (mode: 'wander' | 'approach' | 'waiting', dt: number) => void) {
    this.pigs.update(dt, count, this.pigSurface, this.pigFeed, onEat, intervalMultiplier, measure);
  }
  hayIdAt(slot?: number) { return this.hay.idAt(slot); }
  loadNoncriticalAssets() {
    if (this.modelRequested || this.disposed) return;
    this.modelRequested = true;
    this.optionalTimer = setTimeout(() => {
      if (this.disposed) return;
      const board = new NoticeBoard(); this.scene.add(board.group); this.pickables.push(board.hitbox);
      this.barn = new Barn(this.toolAssets); this.scene.add(this.barn.group); this.pickables.push(...this.barn.pickables);
      if (this.latestEconomy) this.barn.update(this.latestEconomy);
      this.barn.group.updateMatrixWorld(true); this.shadowDirty = true;
      void import('./FarmDecor').then(module => {
        if (this.disposed) return;
        this.scene.add(module.createFarmDecor()); this.shadowDirty = true;
      }).catch(() => { /* Optional dressing never blocks a playable farm. */ });
    }, presentation.sceneDelayMs);
    this.cartModelStatus = 'loading';
    // Keep the first frame and interactions independent of model transfer/parse.
    void import('./cartModel').then(module => module.loadCartModel()).then(model => {
      if (this.disposed) { disposeTree(model); return; }
      this.cartFallback.visible = false;
      for (let i = this.pickables.length - 1; i >= 0; i--) {
        if (this.pickables[i].parent === this.cartFallback) this.pickables.splice(i, 1);
      }
      this.cart.add(model); this.tag(model, 'cart');
      this.cargo.group.scale.set(0.67, 1, 0.98);
      this.cargo.group.position.y = 0.2;
      this.cartModelStatus = 'ready';
      this.shadowDirty = true;
    }).catch(() => {
      this.cartModelStatus = 'fallback';
      // The procedural cart remains fully playable when offline/loading fails.
    });
  }
  surfaceHeight(x: number, z: number) { return this.hay.surfaceHeight(x, z); }
  get cargoCount() { return this.cargo.count; }
  snapshotHay() { return this.hay.snapshot(); }
  restore(hay: string, sold: number, won: boolean, sourceContactScale: number = config.hayVisual.contactScale, sourceTotal: number = config.totalHay, sourceProfile: number = config.hayVisual.profileVersion) {
    this.hay.restore(hay, sourceContactScale, won ? config.totalHay : sourceTotal, sourceProfile); this.cargo.restore(sold);
    if (this.hay.count === 0) this.revealNeedle();
    if (won) this.hideNeedle();
    return this.hay.count;
  }
  revealNeedle() {
    const index = this.pickables.indexOf(this.hay.mesh);
    if (index >= 0) this.pickables.splice(index, 1);
    if (!this.needleAdded) { this.pickables.push(this.needle.hitbox); this.needleAdded = true; }
    this.needle.reveal();
  }
  hideNeedle() {
    this.needle.hide();
    const index = this.pickables.indexOf(this.needle.hitbox);
    if (index >= 0) this.pickables.splice(index, 1);
  }
  highlightHay(id?: number) { this.hay.highlight(id); }
  collectHay(amount: number, point: THREE.Vector3, receiver: THREE.Vector3, selectedId?: number, discoveryMultiplier = 1) {
    this.shadowDirty = true;
    const result = this.hay.remove(amount, point, receiver, selectedId, discoveryMultiplier);
    if (this.hay.count === 0) {
      this.revealNeedle();
    }
    if (this.reducedMotion) this.hay.settleImmediately();
    return result;
  }
  depositHay(amount: number) {
    this.shadowDirty = true; this.cargo.deposit(amount);
  }
  updateHay(dt: number) {
    if (this.hay.activeCount) this.shadowDirty = true;
    this.hay.update(dt); this.needle.update(dt, this.reducedMotion);
  }
  takeShadowUpdate() { const dirty = this.shadowDirty; this.shadowDirty = false; return dirty; }
  dispose() { this.disposed = true; clearTimeout(this.optionalTimer); this.latestEconomy = undefined; disposeTree(this.scene); this.pickables.length = 0; this.materials.clear(); this.geometries.clear(); }
  private tag(group: THREE.Group, target: Target) {
    group.traverse(object => { if (object instanceof THREE.Mesh) { object.userData.target = target; this.pickables.push(object); } });
  }
}




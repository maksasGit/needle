import * as THREE from 'three';
import { Haystack } from './Haystack';
import { config } from '../config/balance';
import { CartCargo } from './CartCargo';
import { Needle } from './Needle';
import { disposeTree } from '../core/dispose';
export type Target = 'ground' | 'hay' | 'cart' | 'needle';
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

  constructor() {
    this.scene.background = new THREE.Color(0x36c9ff);
    this.scene.fog = new THREE.Fog(0x36c9ff, 18, 65);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b28a, 1.8));
    const sun = new THREE.DirectionalLight(0xfff3ce, 2.3);
    sun.position.set(-4, 7, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 30 });
    sun.shadow.normalBias = 0.04; this.scene.add(sun);
    this.box(this.scene, [14, 0.5, 14], [0, -0.3, 0], 0x986239);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshStandardMaterial({ color: 0x67d83d, roughness: 0.85 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.035; ground.receiveShadow = true;
    ground.userData.target = 'ground'; this.scene.add(ground); this.pickables.push(ground);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.8, 9), new THREE.MeshStandardMaterial({ color: 0xe4b96b }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(0.3, -0.025, 0.7); this.scene.add(patch);
    this.scene.add(this.hay.group); this.pickables.push(this.hay.mesh);
    this.scene.add(this.needle.group);
    let seed = 42;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    this.cart.position.set(config.cart.x, 0, config.cart.z);
    this.cart.add(this.cargo.mesh, this.cartFallback);
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
    for (let i = -3; i <= 3; i++) {
      this.box(this.scene, [0.23, 1.1, 0.23], [i * 2, 0.44, -6.8], 0xfff4d6);
      this.box(this.scene, [0.23, 1.1, 0.23], [-6.8, 0.44, i * 2], 0xfff4d6);
    }
    for (const y of [0.3, 0.65]) {
      this.box(this.scene, [12.3, 0.16, 0.14], [0, y, -6.8], 0xfff4d6);
      this.box(this.scene, [0.14, 0.16, 12.3], [-6.8, y, 0], 0xfff4d6);
    }
    for (const [x, z] of [[-7.3, -4.3], [-7.3, 2], [4, -7.3]]) {
      this.box(this.scene, [0.25, 1.5, 0.25], [x, 0.5, z], 0x836849);
      this.box(this.scene, [1.8, 1.25, 1.7], [x, 1.85, z], 0x38a92e);
      this.box(this.scene, [1.25, 0.8, 1.2], [x + 0.16, 2.75, z - 0.08], 0x67d83d);
    }
    // Background scenery stays outside the playable boundaries.
    const landscape = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x67d83d, roughness: 0.8 }));
    landscape.rotation.x = -Math.PI / 2; landscape.position.y = -0.56; this.scene.add(landscape);
    this.box(this.scene, [5, 3, 3], [1.8, 1.2, -10], 0xef5341);
    for (const side of [-1, 1]) {
      const roof = this.box(this.scene, [5.5, 0.22, 2.05], [1.8, 3.05, -10 + side * 0.8], 0x237fce);
      roof.rotation.x = side * 0.55;
    }
    this.box(this.scene, [1.8, 2.2, 0.12], [1.8, 0.82, -8.44], 0xc63532);
    for (const x of [0.85, 1.8, 2.75]) this.box(this.scene, [0.12, 2.35, 0.16], [x, 0.88, -8.34], 0xfff2cd);
    this.box(this.scene, [2.02, 0.13, 0.16], [1.8, 2, -8.34], 0xfff2cd);
    for (const side of [-1, 1]) {
      const brace = this.box(this.scene, [0.12, 2.3, 0.16], [1.8, 0.88, -8.3], 0xfff2cd);
      brace.rotation.z = side * 0.66;
    }
    for (const [x, z] of [[-12, -16], [10, -20], [16, 6]]) {
      this.box(this.scene, [4.5, 0.7, 2], [x, 9, z], 0xffffff);
      this.box(this.scene, [2.5, 0.8, 1.9], [x + 0.5, 9.5, z], 0xffffff);
    }
    for (let i = 0; i < 65; i++) {
      const x = (random() - 0.5) * 12, z = (random() - 0.5) * 12;
      if (Math.hypot(x, z) < 4.4) continue;
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
  hayIdAt(slot?: number) { return this.hay.idAt(slot); }
  loadNoncriticalAssets() {
    if (this.modelRequested || this.disposed) return;
    this.modelRequested = true;
    this.cartModelStatus = 'loading';
    // Keep the first frame and interactions independent of model transfer/parse.
    void import('./cartModel').then(module => module.loadCartModel()).then(model => {
      if (this.disposed) { disposeTree(model); return; }
      this.cartFallback.visible = false;
      for (let i = this.pickables.length - 1; i >= 0; i--) {
        if (this.pickables[i].parent === this.cartFallback) this.pickables.splice(i, 1);
      }
      this.cart.add(model); this.tag(model, 'cart');
      this.cargo.mesh.scale.set(0.67, 1, 0.98);
      this.cargo.mesh.position.y = 0.2;
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
  restore(hay: string, sold: number, won: boolean, sourceContactScale: number = config.hayVisual.contactScale, sourceTotal: number = config.totalHay) {
    this.hay.restore(hay, sourceContactScale, won ? config.totalHay : sourceTotal); this.cargo.restore(sold);
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
  collectHay(amount: number, point: THREE.Vector3, receiver: THREE.Vector3, selectedId?: number) {
    this.shadowDirty = true;
    this.hay.remove(amount, point, receiver, selectedId);
    if (this.hay.count === 0) {
      this.revealNeedle();
    }
    if (this.reducedMotion) this.hay.settleImmediately();
  }
  depositHay(amount: number, origin: THREE.Vector3) {
    this.shadowDirty = true;
    this.scene.updateMatrixWorld(true);
    this.cargo.deposit(amount, origin);
    if (this.reducedMotion) this.cargo.update(10);
  }
  updateHay(dt: number) {
    if (this.hay.activeCount || this.cargo.activeCount) this.shadowDirty = true;
    this.hay.update(dt); this.cargo.update(dt); this.needle.update(dt, this.reducedMotion);
  }
  takeShadowUpdate() { const dirty = this.shadowDirty; this.shadowDirty = false; return dirty; }
  dispose() { this.disposed = true; disposeTree(this.scene); this.pickables.length = 0; this.materials.clear(); this.geometries.clear(); }
  private tag(group: THREE.Group, target: Target) {
    group.traverse(object => { if (object instanceof THREE.Mesh) { object.userData.target = target; this.pickables.push(object); } });
  }
}




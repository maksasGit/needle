import * as THREE from 'three';
import { config } from '../config/balance';
import { createStrawGeometry } from './strawGeometry';

type Flight = { slot: number; start: THREE.Vector3; end: THREE.Vector3; age: number; rotation: number };
export class CartCargo {
  readonly mesh = new THREE.InstancedMesh(createStrawGeometry(), new THREE.MeshStandardMaterial({ color: 0xf6ad22, roughness: 1 }), config.totalHay);
  private flights: Flight[] = [];
  private dummy = new THREE.Object3D();
  private position = new THREE.Vector3();
  get count() { return this.mesh.count; }
  get activeCount() { return this.flights.length; }
  constructor() {
    this.mesh.count = 0; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.userData.target = 'cart';
    const bounds = new THREE.Box3(), point = new THREE.Vector3();
    // Cargo is an interaction surface, without raycasting thousands of stalks.
    this.mesh.raycast = (raycaster, hits) => {
      if (!this.count) return;
      const top = this.target(this.count - 1).position.y + config.hayVisual.stalkWidth;
      bounds.min.set(-0.72, 0.71, -0.72); bounds.max.set(0.72, top, 0.72); bounds.applyMatrix4(this.mesh.matrixWorld);
      if (!raycaster.ray.intersectBox(bounds, point)) return;
      const distance = raycaster.ray.origin.distanceTo(point);
      if (distance >= raycaster.near && distance <= raycaster.far) hits.push({ distance, point: point.clone(), object: this.mesh });
    };
  }
  private target(slot: number) {
    const s = config.presentation;
    const perLayer = s.cartColumns * s.cartRows;
    const layer = Math.floor(slot / perLayer), cell = slot % perLayer;
    const x = ((cell % s.cartColumns) - (s.cartColumns - 1) / 2) * s.cartColumnStep;
    const z = (Math.floor(cell / s.cartColumns) - (s.cartRows - 1) / 2) * s.cartRowStep;
    return { position: new THREE.Vector3(layer % 2 ? z : x, s.cartFloor + layer * s.cartLayerHeight, layer % 2 ? x : z), rotation: layer % 2 ? 0 : Math.PI / 2 };
  }
  deposit(amount: number, worldOrigin: THREE.Vector3) {
    const start = this.mesh.worldToLocal(worldOrigin.clone());
    const first = this.count;
    const added = Math.min(amount, config.totalHay - first);
    for (let i = 0; i < added; i++) {
      const slot = first + i, target = this.target(slot);
      const origin = start.clone().add(new THREE.Vector3((i % 5 - 2) * 0.025, Math.floor(i / 5) * 0.02, 0));
      this.flights.push({ slot, start: origin, end: target.position, rotation: target.rotation, age: -i * config.presentation.unloadStagger });
      this.write(slot, origin, target.rotation);
    }
    this.mesh.count += added;
    if (added) this.mesh.instanceMatrix.needsUpdate = true;
  }
  restore(count: number) {
    this.flights.length = 0; this.mesh.count = count;
    for (let i = 0; i < count; i++) { const target = this.target(i); this.write(i, target.position, target.rotation); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  private write(slot: number, position: THREE.Vector3, angle: number) {
    this.dummy.position.copy(position); this.dummy.rotation.set(0, angle, 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
    this.mesh.setMatrixAt(slot, this.dummy.matrix);
    this.mesh.instanceMatrix.addUpdateRange(slot * 16, 16);
  }
  update(dt: number) {
    if (!this.flights.length) return;
    const duration = config.presentation.unloadSeconds;
    for (const flight of this.flights) {
      flight.age += dt;
      const t = THREE.MathUtils.clamp(flight.age / duration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      const position = this.position.copy(flight.start).lerp(flight.end, eased);
      position.y += Math.sin(t * Math.PI) * config.presentation.unloadArc;
      this.write(flight.slot, position, flight.rotation + (1 - eased) * 0.6);
    }
    let live = 0;
    for (const flight of this.flights) if (flight.age < duration) this.flights[live++] = flight;
    this.flights.length = live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

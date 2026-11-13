import * as THREE from 'three';
import { config } from '../config/balance';

export type PlayerState = 'Idle' | 'Moving' | 'Collecting' | 'Unloading' | 'Winning';
export class Player {
  readonly group = new THREE.Group();
  state: PlayerState = 'Idle';
  route: THREE.Vector2[] = [];
  private legs: THREE.Mesh[] = [];
  private time = 0;
  private actionTime = 0;
  movementSpeed: number = config.movementSpeed;
  private actionDuration: number = config.actionFeedbackSeconds;
  private bundle: THREE.Mesh;
  private point = new THREE.Vector2();
  private delta = new THREE.Vector2();
  constructor() {
    const box = (size: number[], color: number, y: number, x = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      m.position.set(x, y, 0); m.castShadow = true; this.group.add(m); return m;
    };
    box([0.46, 0.52, 0.3], 0x527d87, 0.66);
    box([0.34, 0.32, 0.32], 0xefc494, 1.08);
    box([0.63, 0.07, 0.57], 0xd8af58, 1.25);
    box([0.36, 0.18, 0.34], 0xc99a49, 1.35);
    for (const x of [-0.14, 0.14]) this.legs.push(box([0.18, 0.35, 0.22], 0x344c58, 0.23, x));
    for (const x of [-0.31, 0.31]) box([0.15, 0.4, 0.17], 0xefc494, 0.66, x);
    this.bundle = box([0.5, 0.32, 0.4], 0xe6b64b, 0.65);
    this.bundle.position.z = 0.35;
    this.bundle.visible = false;
    this.group.position.set(0, 0, 3.3);
  }
  get position() { return this.point.set(this.group.position.x, this.group.position.z); }
  command(route: THREE.Vector2[]) { this.route = route; this.state = route.length ? 'Moving' : 'Idle'; }
  action(state: 'Collecting' | 'Unloading', duration: number = config.actionFeedbackSeconds) { this.state = state; this.actionTime = duration; this.actionDuration = duration; }
  setInventory(amount: number, capacity: number = config.capacity) {
    this.bundle.visible = amount > 0;
    this.bundle.scale.setScalar(0.6 + amount / capacity * 0.4);
  }
  update(dt: number): boolean {
    this.time += dt;
    let budget = this.movementSpeed * dt;
    const wasMoving = this.state === 'Moving';
    while (this.route.length && budget > 0) {
      const delta = this.delta.copy(this.route[0]).sub(this.position), distance = delta.length();
      this.group.rotation.y = Math.atan2(delta.x, delta.y);
      if (distance <= budget) { this.group.position.x = this.route[0].x; this.group.position.z = this.route[0].y; this.route.shift(); budget -= distance; }
      else { delta.multiplyScalar(budget / distance); this.group.position.x += delta.x; this.group.position.z += delta.y; budget = 0; }
    }
    if (this.state === 'Collecting' || this.state === 'Unloading') {
      this.actionTime -= dt;
      if (this.actionTime <= 0) this.state = 'Idle';
    } else this.state = this.route.length ? 'Moving' : 'Idle';
    this.legs.forEach((leg, i) => { leg.rotation.x = this.state === 'Moving' ? Math.sin(this.time * 12 + i * Math.PI) * 0.5 : 0; });
    return wasMoving && this.state === 'Idle';
  }
}

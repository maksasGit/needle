import * as THREE from 'three';
import { config } from '../config/balance';
export class Needle {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  private halo: THREE.Mesh;
  private age = 0;
  constructor() {
    this.group.position.set(config.hay.x, 0.12, config.hay.z);
    const metal = new THREE.MeshStandardMaterial({ color: 0xe9f9ff, metalness: 0.65, roughness: 0.24, emissive: 0x386d85, emissiveIntensity: 0.4 });
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.6, 6), metal);
    shaft.rotation.z = -Math.PI / 2; shaft.position.x = 0.14;
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 5, 12), metal);
    eye.scale.set(1.5, 0.8, 1); eye.rotation.x = -Math.PI / 2; eye.position.x = -0.2;
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.37, 32), new THREE.MeshBasicMaterial({ color: 0xffe05a, side: THREE.DoubleSide }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = -0.06;
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.8, 0.95), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 0.25; this.hitbox.userData.target = 'needle';
    this.group.add(shaft, eye, this.halo, this.hitbox); this.group.visible = false;
  }
  reveal() { this.group.visible = true; }
  hide() { this.group.visible = false; }
  update(dt: number, reduced: boolean) { this.age += dt; this.halo.scale.setScalar(reduced ? 1 : 1 + Math.sin(this.age * 3) * 0.08); }
}

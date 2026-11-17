import * as THREE from 'three';
import { recordsConfig } from '../config/records';

/** Original toy farm board: shared boxes, no textures, lights or shadows. */
export class NoticeBoard {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  private fallback: THREE.Object3D[] = [];
  constructor() {
    const geometry = new THREE.BoxGeometry(1,1,1);
    const wood = new THREE.MeshStandardMaterial({ color: 0xb86b38, roughness: .75 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x6d3c24, roughness: .8 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: .9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd83d, roughness: .4 });
    const box = (size: number[], pos: number[], mat: THREE.Material) => {
      const mesh = new THREE.Mesh(geometry, mat); mesh.scale.set(size[0],size[1],size[2]); mesh.position.set(pos[0],pos[1],pos[2]); this.group.add(mesh); return mesh;
    };
    for (const x of [-.85,.85]) box([.18,2.25,.2],[x,1.1,0],dark);
    box([1.95,1.15,.16],[0,1.57,0],wood);
    box([2.2,.18,.65],[0,2.26,0],dark);
    for (const x of [-.57,0,.57]) box([.43,.66,.025],[x,1.55,-.1],paper).rotation.z = x * .12;
    // Three rising gold bars suggest records without relying on text or borrowed symbols.
    for (const [i,h] of [.14,.26,.4].entries()) box([.09,h,.035],[-.14+i*.14,1.4+h/2,-.13],gold);
    this.fallback = this.group.children.slice();
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.6,1.2),new THREE.MeshBasicMaterial({ visible:false }));
    this.hitbox.position.y=1.5; this.hitbox.userData.target='records'; this.group.add(this.hitbox);
    this.group.position.set(recordsConfig.x,0,recordsConfig.z);
  }
  applyModel(model: THREE.Object3D) { for (const object of this.fallback) object.visible=false; this.group.add(model); }
}

import * as THREE from 'three';
import { chestBalance } from '../config/chests';
import type { ActiveChest } from '../systems/ChestEvent';

/** Original toy chest; one reusable model and one forgiving interaction target. */
export class RewardChest {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  constructor() {
    const wood = new THREE.MeshStandardMaterial({ color: 0xb86b38, roughness: .7 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd83d, metalness: .2, roughness: .5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x6d3c24, roughness: .85 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const box = (size: number[], point: number[], material: THREE.Material) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(point[0], point[1], point[2]); this.group.add(mesh);
    };
    box([.94,.5,.64], [0,.27,0], wood);
    box([1,.19,.7], [0,.59,0], wood);
    box([1.02,.05,.72], [0,.49,0], dark);
    for (const x of [-.33,.33]) {
      box([.075,.69,.72], [x,.36,0], gold);
    }
    box([.18,.23,.07], [0,.45,.38], gold);
    box([.055,.08,.025], [0,.43,.427], dark);
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.2,.95,1), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = .45; this.hitbox.userData.target = 'chest'; this.group.add(this.hitbox);
    this.group.visible = false;
  }
  set(active?: Readonly<ActiveChest>) {
    this.group.visible = !!active;
    if (!active) return;
    const [x,z] = chestBalance.positions[active.position]; this.group.position.set(x, 0, z);
    this.group.rotation.y = active.position * .7;
    this.hitbox.userData.chestId = active.id;
  }
}

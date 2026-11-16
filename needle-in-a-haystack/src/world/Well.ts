import * as THREE from 'three';
import { wellConfig } from '../config/meta';
export class Well {
  readonly group=new THREE.Group();
  readonly hitbox: THREE.Mesh;
  constructor() {
    const stone=new THREE.MeshStandardMaterial({color:0xc5d9e6,roughness:.8}),wood=new THREE.MeshStandardMaterial({color:0xb86b38,roughness:.7}),roof=new THREE.MeshStandardMaterial({color:0x23b8ff,roughness:.6});
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.8,.85,.7,12,1,true),stone);base.position.y=.35;this.group.add(base);
    const water=new THREE.Mesh(new THREE.CircleGeometry(.72,12),new THREE.MeshStandardMaterial({color:0x138ef2,roughness:.3}));water.rotation.x=-Math.PI/2;water.position.y=.18;this.group.add(water);
    const geometry=new THREE.BoxGeometry(1,1,1);
    const box=(size:number[],p:number[],mat:THREE.Material)=>{const m=new THREE.Mesh(geometry,mat);m.scale.set(size[0],size[1],size[2]);m.position.set(p[0],p[1],p[2]);this.group.add(m);return m;};
    for(const x of [-.72,.72])box([.16,1.9,.16],[x,1,0],wood);
    for(const side of [-1,1])box([1.9,.14,.7],[0,2.05,side*.28],roof).rotation.x=side*-.4;
    box([1.5,.12,.12],[0,1.4,0],wood);
    this.hitbox=new THREE.Mesh(new THREE.BoxGeometry(1.9,2.3,1.5),new THREE.MeshBasicMaterial({visible:false}));this.hitbox.position.y=1.1;this.hitbox.userData.target='well';this.group.add(this.hitbox);
    this.group.position.set(wellConfig.x,0,wellConfig.z);
  }
}

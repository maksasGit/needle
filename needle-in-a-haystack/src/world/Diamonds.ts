import * as THREE from 'three';
import type { GemState } from '../systems/MetaProgress';
/** Bounded instanced gems; source positions use stable straw IDs, never instance slots. */
export class Diamonds {
  readonly group=new THREE.Group();
  readonly hitbox: THREE.InstancedMesh;
  private mesh: THREE.InstancedMesh;
  private matrix=new THREE.Matrix4();
  private point=new THREE.Vector3();
  private rotation=new THREE.Quaternion();
  private scale=new THREE.Vector3();
  private positions=Array.from({length:20},()=>new THREE.Vector3());
  private slots:number[]=[];
  constructor() {
    this.mesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.13),new THREE.MeshStandardMaterial({color:0x23e5ff,emissive:0x075477,roughness:.25,metalness:.15}),20);
    this.hitbox=new THREE.InstancedMesh(new THREE.SphereGeometry(.22,6,4),new THREE.MeshBasicMaterial({visible:false}),20);this.hitbox.userData.target='diamond';
    this.mesh.frustumCulled=this.hitbox.frustumCulled=false;this.group.add(this.mesh,this.hitbox);
  }
  update(state: GemState, source: (id:number,out:THREE.Vector3)=>boolean) {
    this.slots.length=0;
    for(let i=0;i<20;i++) {
      const visible=!(state.claimed&(1<<i)) && (state.drops[i] ? (this.point.fromArray(state.drops[i]!),true) : source(500+i*1000,this.point));
      if(!visible)continue;
      const slot=this.slots.length;this.slots.push(i);
      this.positions[i].copy(this.point);this.scale.setScalar(1);this.matrix.compose(this.point,this.rotation,this.scale);this.mesh.setMatrixAt(slot,this.matrix);this.hitbox.setMatrixAt(slot,this.matrix);
    }
    this.mesh.count=this.hitbox.count=this.slots.length;
    this.mesh.instanceMatrix.needsUpdate=this.hitbox.instanceMatrix.needsUpdate=true;
    this.hitbox.computeBoundingSphere();
  }
  idAt(slot:number) { return this.slots[slot]; }
  position(index:number) { return this.positions[index]; }
}

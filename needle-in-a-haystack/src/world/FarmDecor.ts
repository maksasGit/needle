import * as THREE from 'three';

/** Optional static dressing: shared resources, no colliders, lights or update loop. */
export function createFarmDecor() {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1,1,1), rounded = new THREE.IcosahedronGeometry(1,0);
  const addInstances = (geometry: THREE.BufferGeometry, color: number, points: number[][]) => {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .9 }), points.length);
    const dummy = new THREE.Object3D();
    points.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0], i) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xd6b978, roughness: 1 });
  const roadGeometry = new THREE.BoxGeometry(1, .012, 1);
  for (const [ax, az, bx, bz] of [[-5,-2,-5,5],[-5,5,-8,8],[-4,-3,0,-3],[0,-3,6,-6]]) {
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.position.set((ax + bx) / 2, -.022, (az + bz) / 2);
    road.scale.set(1.2, 1, Math.hypot(bx - ax, bz - az) + .35); road.rotation.y = Math.atan2(bx - ax, bz - az);
    road.receiveShadow = true; group.add(road);
  }
  addInstances(box, 0xb86b38, [[9,.36,-5,.72,.72,.72,.1],[9.8,.28,-5,.55,.55,.55,-.2],[-10,.35,8,.7,.7,.7,.15],[-10,.91,8,.45,.45,.45,-.1]]);
  addInstances(box, 0xffd796, [[9,.38,-5.37,.76,.08,.06,.1],[9,.38,-4.63,.76,.08,.06,.1],[-10,.36,7.63,.74,.08,.06,.15],[-10,.36,8.37,.74,.08,.06,.15]]);
  addInstances(new THREE.CylinderGeometry(.32,.29,.75,10), 0x99613d, [[10,.36,-7],[10.8,.36,-7.2],[-10.2,.36,9.5]]);
  addInstances(new THREE.TorusGeometry(.32,.028,3,10).rotateX(Math.PI / 2), 0x516479, [[10,.55,-7,1,1,1],[10.8,.55,-7.2,1,1,1],[-10.2,.55,9.5,1,1,1]]);
  addInstances(rounded, 0x8d9c9a, [[-11,.18,-9,.5,.24,.4],[11,.2,7,.6,.28,.4],[-10,.16,2,.35,.2,.45],[4,.15,10,.4,.2,.35],[10,.14,2,.3,.18,.4]]);
  addInstances(rounded, 0x38a92e, [[-11,.45,-11,.9,.65,.8],[-11,.4,11,1.1,.55,.8],[11,.5,10,1.2,.7,.9],[-15,.7,-4,1.4,.9,1.2]]);
  addInstances(rounded, 0x54b945, [[-24,-1,-24,11,4,8],[6,-1,-29,14,5,8],[27,-1,10,9,4,12],[-27,-1,12,8,3,9]]);
  addInstances(new THREE.CylinderGeometry(.13,.2,1.5,5), 0x86562f, [[-17,.4,-11],[-18,.4,8],[17,.4,4],[12,.4,-17]]);
  addInstances(rounded, 0x29994f, [[-17,2,-11,1.3,1.6,1.2],[-18,2,8,1.5,1.8,1.3],[17,2,4,1.3,1.6,1.2],[12,2,-17,1.6,1.8,1.3]]);
  addInstances(new THREE.IcosahedronGeometry(.1,0), 0xffd83d, [[-10,.12,-10],[-10.3,.13,-10.2],[10,.13,9],[10.3,.13,9.3],[3,.13,10.7]]);
  group.name = 'optional-farm-dressing'; group.userData.optional = true;
  // Decorative geometry never joins World.pickables or movement obstacles.
  return group;
}

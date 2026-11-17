import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import barnUrl from '../../public/models/barn.glb?url';
import wellUrl from '../../public/models/medival_well.glb?url';
import boardUrl from '../../public/models/leaderboard.glb?url';

const models = {
  barn: { url: barnUrl, size: [5.4, 5, 3.8] },
  well: { url: wellUrl, size: [1.9, 2.3, 1.5] },
  board: { url: boardUrl, size: [2.2, 2.5, 1.2] },
} as const;

/** Authored materials/UVs preserved; one uniformly scaled, grounded model. */
export async function loadFarmModel(kind: keyof typeof models) {
  const spec = models[kind];
  const model = (await new GLTFLoader().loadAsync(spec.url)).scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(...spec.size.map((limit, i) => limit / Math.max(size.getComponent(i), .0001)));
  model.scale.multiplyScalar(scale);
  model.position.x -= center.x * scale;
  model.position.y -= bounds.min.y * scale;
  model.position.z -= center.z * scale;
  if (kind === 'board') {
    const facing = new THREE.Group();
    facing.add(model); facing.rotation.y = Math.PI;
    return prepare(facing, kind);
  }
  return prepare(model, kind);
}

function prepare(model: THREE.Group, kind: keyof typeof models) {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = kind === 'barn';
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && material.map) material.map.anisotropy = 2;
    }
  });
  return model;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import cartUrl from '../../public/models/cart_colored.glb?url';

/** Preserve the user's authored texture, UVs, normals and materials. */
export async function loadCartModel() {
  const gltf = await new GLTFLoader().loadAsync(cartUrl);
  const model = gltf.scene;
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true; object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && material.map) material.map.anisotropy = 2;
    }
  });
  // Same Y-up geometry and cargo bed as the original untextured cart.
  model.rotation.y = Math.PI / 2;
  model.scale.setScalar(3.3);
  model.position.set(0, 0.24633799493312836 * 3.3, 0.14 * 3.3);
  model.userData.cartModel = true;
  return model;
}

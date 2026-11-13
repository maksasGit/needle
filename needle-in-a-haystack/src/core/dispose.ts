import type { Object3D, Material } from 'three';
import { Mesh, DirectionalLight, Texture } from 'three';
export function disposeTree(root: Object3D) {
  const geometries = new Set<{ dispose(): void }>(), materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if ('dispose' in object && typeof object.dispose === 'function') object.dispose();
    }
    if (object instanceof DirectionalLight) object.shadow.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  root.clear();
}

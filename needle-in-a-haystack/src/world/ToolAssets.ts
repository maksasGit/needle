import * as THREE from 'three';

/** One per game session: display racks, hands and pigs share primitive resources. */
export class ToolAssets {
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private models = new Map<string, THREE.Group>();
  private modelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65 });
  private finish(key: string, root: THREE.Group) {
    const positions: number[] = [], normals: number[] = [], colors: number[] = [];
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry, source = geometry.getAttribute('position'), sourceNormals = geometry.getAttribute('normal');
      const index = geometry.index, count = index?.count ?? source.count;
      const color = (object.material as THREE.MeshStandardMaterial).color;
      normalMatrix.getNormalMatrix(object.matrixWorld);
      for (let i = 0; i < count; i++) {
        const v = index ? index.getX(i) : i;
        point.fromBufferAttribute(source, v).applyMatrix4(object.matrixWorld);
        normal.fromBufferAttribute(sourceNormals, v).applyMatrix3(normalMatrix).normalize();
        positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); colors.push(color.r, color.g, color.b);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    root.clear(); const mesh = new THREE.Mesh(geometry, this.modelMaterial); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    this.models.set(key, root); return root.clone();
  }
  box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], color: number) {
    const key = size.join(',');
    let geometry = this.geometries.get(key);
    if (!geometry) { geometry = new THREE.BoxGeometry(...size); this.geometries.set(key, geometry); }
    let material = this.materials.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.65 }); this.materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  tool(level: number) {
    const key = `tool${level}`, cached = this.models.get(key); if (cached) return cached.clone();
    const root = new THREE.Group();
    if (level === 4) {
      this.box(root, [.24, .32, .2], [0, -.06, .06], 0x23b8ff);
      this.box(root, [.16, .1, .22], [0, .15, .06], 0xffd83d);
      this.box(root, [.07, .54, .07], [0, .38, 0], 0x526985);
      this.box(root, [.27, .12, .18], [0, .66, -.05], 0x23b8ff);
      this.box(root, [.21, .055, .02], [0, .66, -.15], 0x20212a);
    } else {
      this.box(root, [.05, .8, .05], [0, .05, 0], 0xba7e34);
      const rake = level === 1, count = rake ? 7 : level === 2 ? 3 : 5, width = level === 3 ? .36 : .25;
      this.box(root, [width, .045, .05], [0, .45, 0], 0x237fce);
      for (let i = 0; i < count; i++) {
        const tine = this.box(root, [.024, rake ? .11 : .25, .025], [-width / 2 + i * width / (count - 1), rake ? .46 : .57, rake ? -.045 : 0], 0xb4d8ed);
        if (rake) tine.rotation.x = -Math.PI / 2;
      }
    }
    return this.finish(key, root);
  }
  backpack() {
    const cached = this.models.get('backpack'); if (cached) return cached.clone();
    const root = new THREE.Group();
    this.box(root, [.42, .52, .23], [0, .1, 0], 0x54d845);
    this.box(root, [.31, .19, .1], [0, -.03, .16], 0x38a92e);
    this.box(root, [.16, .045, .08], [0, .39, 0], 0x6d3c24);
    for (const x of [-.13, .13]) this.box(root, [.055, .34, .035], [x, .09, -.14], 0x6d3c24);
    return this.finish('backpack', root);
  }
  pig() {
    const cached = this.models.get('pig'); if (cached) return cached.clone();
    const root = new THREE.Group();
    this.box(root, [.38, .3, .56], [0, .3, 0], 0xffa9bd);
    this.box(root, [.3, .26, .23], [0, .34, .3], 0xffbfd0);
    this.box(root, [.2, .12, .08], [0, .3, .445], 0xf582a5);
    for (const x of [-.11, .11]) {
      const ear = this.box(root, [.08, .15, .07], [x, .52, .29], 0xf582a5); ear.rotation.z = -Math.sign(x) * .2;
      this.box(root, [.035, .04, .025], [x, .4, .425], 0x20212a);
      for (const z of [-.17, .17]) this.box(root, [.09, .17, .1], [x, .085, z], 0xf582a5);
    }
    const tail = this.box(root, [.05, .07, .12], [0, .36, -.33], 0xf582a5); tail.rotation.x = -.5;
    return this.finish('pig', root);
  }
}

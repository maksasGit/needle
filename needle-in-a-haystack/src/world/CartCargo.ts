import * as THREE from 'three';
import { config } from '../config/balance';

/** Sold units remain exact; their visual representation is one fixed-cost mound. */
export class CartCargo {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private sold = 0;
  get count() { return this.sold; }
  constructor() {
    const { segments, rings, radius } = config.cartCargo;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const color = new THREE.Color();
    for (let ring = 0; ring <= rings; ring++) {
      const angle = ring / rings * Math.PI / 2;
      for (let i = 0; i <= segments; i++) {
        const turn = i / segments * Math.PI * 2;
        positions.push(Math.sin(angle) * Math.cos(turn) * radius, Math.cos(angle), Math.sin(angle) * Math.sin(turn) * radius);
        color.setHex((i + ring) % 4 === 0 ? 0xffd83d : (i + ring) % 3 === 0 ? 0xe8a324 : 0xf6bd35);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let ring = 0; ring < rings; ring++) for (let i = 0; i < segments; i++) {
      const a = ring * (segments + 1) + i, b = a + segments + 1;
      if (ring > 0) indices.push(a, a + 1, b + 1);
      indices.push(a, b + 1, b);
    }
    const centre = positions.length / 3; positions.push(0, 0, 0); colors.push(color.r, color.g, color.b);
    for (let i = 0; i < segments; i++) {
      const a = rings * (segments + 1) + i; indices.push(centre, a, a + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    this.mesh.position.y = config.presentation.cartFloor;
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.userData.target = 'cart';
    const raycast = this.mesh.raycast.bind(this.mesh);
    this.mesh.raycast = (raycaster, hits) => { if (this.sold > 0) raycast(raycaster, hits); };
    this.group.add(this.mesh); this.restore(0);
  }
  deposit(amount: number) { this.restore(this.sold + amount); }
  restore(count: number) {
    this.sold = Math.max(0, Math.min(config.totalHay, Number.isFinite(count) ? Math.floor(count) : 0));
    this.mesh.visible = this.sold > 0;
    const fill = Math.sqrt(this.sold / config.totalHay);
    const size = config.cartCargo.minFootprint + (1 - config.cartCargo.minFootprint) * fill;
    this.mesh.scale.set(size, config.cartCargo.minHeight + config.cartCargo.maxHeight * fill, size);
  }
}

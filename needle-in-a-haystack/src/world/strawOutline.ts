import * as THREE from 'three';

/** A small solid stroke along the twelve edges of the selected stalk. */
export function createStrawOutline(straw: THREE.BufferGeometry, radius: number) {
  const edges = new THREE.EdgesGeometry(straw);
  const points = edges.getAttribute('position');
  const positions: number[] = [];
  const start = new THREE.Vector3(), end = new THREE.Vector3(), delta = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), quaternion = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  for (let i = 0; i < points.count; i += 2) {
    start.fromBufferAttribute(points, i); end.fromBufferAttribute(points, i + 1); delta.subVectors(end, start);
    const segment = new THREE.CylinderGeometry(radius, radius, delta.length(), 4, 1, false).toNonIndexed();
    quaternion.setFromUnitVectors(up, delta.normalize());
    matrix.compose(start.add(end).multiplyScalar(0.5), quaternion, new THREE.Vector3(1, 1, 1));
    segment.applyMatrix4(matrix);
    positions.push(...segment.getAttribute('position').array); segment.dispose();
  }
  edges.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

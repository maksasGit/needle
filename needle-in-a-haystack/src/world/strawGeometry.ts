import { BoxGeometry } from 'three';
import { config } from '../config/balance';

export function createStrawGeometry() {
  const s = config.hayVisual;
  const geometry = new BoxGeometry(s.stalkWidth, s.stalkWidth * 0.75, s.stalkLength);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const taper = positions.getZ(i) > 0 ? 0.55 : 1;
    positions.setX(i, positions.getX(i) * taper);
    positions.setY(i, positions.getY(i) * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

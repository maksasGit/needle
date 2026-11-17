import * as THREE from 'three';
import { barnLocalItems as barnItems, barnLocalWalls as barnWalls, barnLayout } from '../config/progression';
import type { BarnTarget } from '../config/progression';
import type { EconomySystem } from '../systems/EconomySystem';
import { t } from '../ui/i18n';
import { ToolAssets } from './ToolAssets';

/** Authored barn backdrop, accessible outdoor displays and shared price-sign atlas. */
export class Barn {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private lastState = '';
  private displays = new Map<BarnTarget, THREE.Object3D>();
  private fallback: THREE.Object3D[] = [];
  object(target: BarnTarget) { return this.displays.get(target); }
  constructor(assets: ToolAssets) {
    for (const wall of barnWalls) {
      const mesh = assets.box(this.group, [wall.halfX * 2, 2.6, wall.halfZ * 2], [wall.x, 1.25, wall.z], 0xef5341);
      mesh.userData.target = 'ground'; this.pickables.push(mesh);
    }
    assets.box(this.group, [5.4, .1, 3.1], [1.8, -.04, -4.7], 0xb86b38);
    for (const x of [-.78, 4.38]) assets.box(this.group, [.2, 2.75, .2], [x, 1.3, -3.2], 0xfff2cd);
    for (const side of [-1, 1]) {
      const roof = assets.box(this.group, [5.75, .18, 1.9], [1.8, 2.95, -4.7 + side * .72], 0x237fce);
      roof.rotation.x = side * .35;
    }
    assets.box(this.group, [5.3, .17, .18], [1.8, 2.6, -3.18], 0xfff2cd);
    this.fallback = this.group.children.slice();
    // Independent rack keeps tools accessible in front of a closed GLB shell.
    for (const x of [-.65, 4.25]) assets.box(this.group, [.12, 2.4, .12], [x, 1.2, -2.65], 0x6d3c24);
    assets.box(this.group, [5.05, .85, .12], [1.8, 1.4, -2.65], 0xb86b38);
    this.canvas.width = 1024; this.canvas.height = 256;
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, alphaTest: .5 });
    const targetMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const toolTarget = new THREE.BoxGeometry(.65, 1.4, .45);
    const pigTarget = new THREE.BoxGeometry(.8, .8, .9);
    for (const [i, target] of (Object.keys(barnItems) as BarnTarget[]).entries()) {
      const item = barnItems[target];
      const display = item.tool ? assets.tool(item.tool) : target === 'backpack' ? assets.backpack() : assets.pig();
      display.position.set(item.x, target === 'pig' ? 0 : 1.02, item.z + .08);
      this.group.add(display);
      this.displays.set(target, display);
      const hitbox = new THREE.Mesh(target === 'pig' ? pigTarget : toolTarget, targetMaterial);
      hitbox.position.set(item.x, target === 'pig' ? .4 : 1.25, item.z + .08);
      hitbox.userData.target = target; this.group.add(hitbox); this.pickables.push(hitbox);
      display.traverse(object => { if (object instanceof THREE.Mesh) { object.userData.target = target; this.pickables.push(object); } });
      const geometry = new THREE.PlaneGeometry(.85, .42), uv = geometry.getAttribute('uv');
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (i % 4 + uv.getX(v)) / 4, 1 - (Math.floor(i / 4) + 1 - uv.getY(v)) / 2);
      const sign = new THREE.Mesh(geometry, material);
      sign.position.set(item.x, target === 'pig' ? 1.15 : 2.12, item.z + .12);
      sign.userData.target = target; this.group.add(sign); this.pickables.push(sign);
      if (target !== 'pig') assets.box(this.group, [.09, .09, .12], [item.x, 1.72, item.z + .025], 0x6d3c24);
    }
    for (const x of [4.55, 5.45]) assets.box(this.group, [.07, .6, .07], [x, .25, -4.45], 0xfff2cd);
    assets.box(this.group, [.96, .07, .07], [5, .45, -4.45], 0xfff2cd);
    for (const child of this.group.children) {
      child.position.x -= barnLayout.localX; child.position.z -= barnLayout.localZ;
    }
    this.group.position.set(barnLayout.x, 0, barnLayout.z);
    this.group.rotation.y = barnLayout.yaw;
  }
  applyModel(model: THREE.Object3D) {
    for (const object of this.fallback) object.visible = false;
    this.group.add(model);
  }
  update(economy: EconomySystem) {
    const state = `${economy.levels.tools}/${economy.levels.capacity}/${economy.activeTool}/${economy.pigCount}/${t('shop')}`;
    if (state === this.lastState) return;
    this.lastState = state;
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, .5, 0, 0); ctx.clearRect(0, 0, 1024, 512);
    (Object.keys(barnItems) as BarnTarget[]).forEach((target, i) => {
      const x = i % 4 * 256, y = Math.floor(i / 4) * 256, offer = economy.barnOffer(target);
      ctx.fillStyle = offer.owned ? '#b4f49b' : offer.locked ? '#d9deeb' : '#fff0bd'; ctx.fillRect(x + 5, y + 18, 246, 220);
      ctx.strokeStyle = '#20212a'; ctx.lineWidth = 8; ctx.strokeRect(x + 5, y + 18, 246, 220);
      ctx.fillStyle = '#20212a'; ctx.textAlign = 'center'; ctx.font = 'bold 27px sans-serif';
      ctx.fillText(offer.name, x + 128, y + 93, 226);
      ctx.font = 'bold 37px sans-serif';
      ctx.fillText(offer.owned ? t('owned') : offer.price === null ? t('maxShort') : `${offer.price} ${t('coinShort')}`, x + 128, y + 158, 226);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(offer.locked ? t('previousTool') : offer.owned ? t('equip') : offer.price === null ? t('maxShort') : t('buy'), x + 128, y + 207, 226);
    });
    this.texture.needsUpdate = true;
  }
}

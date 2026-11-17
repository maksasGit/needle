import * as THREE from 'three';
import { chestBalance } from '../config/chests';
import type { ActiveChest } from '../systems/ChestEvent';
import { t } from './i18n';

/** One overlay, sampled at 10 Hz; no timer per chest or DOM allocations in frame. */
export class ChestTimer {
  private node = document.createElement('div');
  private label = document.createElement('span');
  private bar = document.createElement('div');
  private fill = document.createElement('i');
  private point = new THREE.Vector3();
  private age = Infinity;
  private stamp = '';
  constructor() {
    this.node.className = 'chest-timer'; this.bar.className = 'chest-timer-bar'; this.bar.setAttribute('role', 'progressbar');
    this.bar.setAttribute('aria-valuemin', '0'); this.bar.setAttribute('aria-valuemax', String(chestBalance.lifetime));
    this.bar.append(this.fill); this.node.append(this.label, this.bar); this.hide(); document.querySelector('#app')!.append(this.node);
  }
  update(dt: number, active: Readonly<ActiveChest> | undefined, camera: THREE.Camera, width: number, height: number) {
    if (!active) { this.hide(); return; }
    this.age += dt; if (this.age < .1) return; this.age = 0;
    const [x,z] = chestBalance.positions[active.position]; this.point.set(x, 1.25, z).project(camera);
    const screenX = (this.point.x * .5 + .5) * width, screenY = (-this.point.y * .5 + .5) * height;
    if (this.point.z < -1 || this.point.z > 1 || screenX < 45 || screenX > width - 45 || screenY < 12 || screenY > height - 24) { this.hide(); return; }
    const stamp = `${active.id}/${t('chest')}`;
    if (stamp !== this.stamp) { this.stamp = stamp; this.label.textContent = `+${chestBalance.rewards[active.stage]}`; this.bar.setAttribute('aria-label', t('chestTime')); }
    this.node.hidden = false; this.node.style.left = `${screenX}px`; this.node.style.top = `${screenY}px`;
    this.fill.style.transform = `scaleX(${active.remaining / chestBalance.lifetime})`;
    this.bar.setAttribute('aria-valuenow', String(Math.ceil(active.remaining)));
  }
  get visible(){return !this.node.hidden;}
  hide() { this.node.hidden = true; }
  dispose() { this.node.remove(); }
}

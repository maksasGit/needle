import { Raycaster, Vector2 } from 'three';
import type { Camera, Object3D, Vector3 } from 'three';
import type { Target } from '../world/World';
import { VirtualJoystick } from './VirtualJoystick';
export class InputManager {
  private controller = new AbortController();
  private observer?: MutationObserver;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private vector = new Vector2();
  private results: import('three').Intersection[] = [];
  private pick(x: number, y: number) {
    this.results.length = 0;
    this.raycaster.setFromCamera(this.pointer.set(x, y), this.camera);
    this.raycaster.intersectObjects(this.pickables, false, this.results);
    const exact = this.results[0];
    if (exact && exact.object.userData.target !== 'ground') return exact;
    // A small targeting tolerance helps touch users select thin straws.
    for (const [dx, dy] of [[-0.006,0],[0.006,0],[0,-0.006],[0,0.006]]) {
      this.results.length = 0;
      this.raycaster.setFromCamera(this.pointer.set(x + dx, y + dy), this.camera);
      this.raycaster.intersectObjects(this.pickables, false, this.results);
      if (this.results[0]?.object.userData.target === 'hay') return this.results[0];
    }
    return exact;
  }
  private listen<K extends keyof (HTMLElementEventMap & DocumentEventMap & WindowEventMap)>(target: EventTarget, event: K, fn: (e: (HTMLElementEventMap & DocumentEventMap & WindowEventMap)[K]) => void) {
    target.addEventListener(event, fn as EventListener, { signal: this.controller.signal });
  }
  private keys = new Set<string>();
  private joystick: VirtualJoystick;
  private aimAge = Infinity;
  private down?: { x: number; y: number; lastX: number; lastY: number; id: number; dragged: boolean };
  constructor(canvas: HTMLCanvasElement, private camera: Camera, private pickables: Object3D[], onCommand: (target: Target, point: Vector3, instanceId?: number) => void, onLook: (dx: number, dy: number) => void, private onAim: (instanceId?: number, target?: Target) => void, private isBlocked: () => boolean = () => !!document.querySelector('dialog[open]'), onJump: () => void = () => {}) {
    const blocked = this.isBlocked;
    const cast = (x: number, y: number) => {
      if (blocked()) return;
      const hit = this.pick(x, y);
      if (hit && hit.object.userData.target !== 'ground') onCommand(hit.object.userData.target as Target, hit.point, hit.instanceId);
    };
    this.listen(canvas, 'pointerdown', e => {
      if (this.down || e.button !== 0 || blocked()) return;
      canvas.focus({ preventScroll: true });
      this.down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, id: e.pointerId, dragged: false };
      canvas.setPointerCapture(e.pointerId);
    });
    this.listen(canvas, 'pointermove', e => {
      const d = this.down;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.dragged = true;
      if (d.dragged && !blocked()) onLook(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX; d.lastY = e.clientY;
    });
    this.listen(canvas, 'pointercancel', () => { this.down = undefined; });
    this.listen(canvas, 'lostpointercapture', () => { this.down = undefined; });
    this.listen(canvas, 'pointerup', e => {
      const d = this.down; this.down = undefined;
      if (!d || d.id !== e.pointerId || d.dragged) return;
      const rect = canvas.getBoundingClientRect();
      cast((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    });
    this.listen(canvas, 'contextmenu', e => e.preventDefault());
    this.listen(window, 'keydown', e => {
      if (blocked() || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.code)) { e.preventDefault(); this.keys.add(e.code); }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) onJump(); }
      if (e.code === 'KeyE' && !e.repeat) cast(0, 0);
    });
    this.listen(window, 'keyup', e => this.keys.delete(e.code));
    this.listen(window, 'blur', () => this.reset());
    this.listen(document, 'visibilitychange', () => this.reset());
    this.listen(document.querySelector<HTMLButtonElement>('#interact')!, 'click', () => cast(0, 0));
    this.listen(document.querySelector<HTMLButtonElement>('#jump')!, 'click', () => { if (!blocked()) onJump(); });
    this.joystick = new VirtualJoystick(document.querySelector<HTMLElement>('#joystick')!, blocked);
    this.observer = new MutationObserver(() => { if (blocked()) this.reset(); });
    this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  updateAim(dt: number, blocked: boolean) {
    if (blocked) { this.onAim(); this.aimAge = Infinity; return; }
    this.aimAge += dt;
    if (this.aimAge < 1 / 20) return;
    this.aimAge = 0;
    const hit = this.pick(0, 0);
    this.onAim(hit?.object.userData.target === 'hay' ? hit.instanceId : undefined, hit?.object.userData.target as Target | undefined);
  }
  reset() { this.keys.clear(); this.joystick?.reset(); this.down = undefined; }
  dispose() { this.controller.abort(); this.observer?.disconnect(); this.reset(); this.joystick.dispose(); this.onAim(); }
  movement(): Vector2 {
    const has = (...keys: string[]) => keys.some(key => this.keys.has(key));
    const stick = this.joystick.movement();
    return this.vector.set(stick.x + Number(has('KeyD','ArrowRight')) - Number(has('KeyA','ArrowLeft')), stick.y + Number(has('KeyW','ArrowUp')) - Number(has('KeyS','ArrowDown'))).clampLength(0, 1);
  }
}


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
  private held = false;
  private holdOwner?: number | "key";
  private holdX = 0;
  private holdY = 0;
  private holdAge = 0;
  private heldButtonClick = false;
  private heldCommand?: () => void;
  private down?: { x: number; y: number; lastX: number; lastY: number; id: number; dragged: boolean };
  constructor(canvas: HTMLCanvasElement, private camera: Camera, private pickables: Object3D[], onCommand: (target: Target, point: Vector3, instanceId?: number,source?:'pointer'|'keyboard'|'action'|'hold-start'|'hold-repeat') => void, onLook: (dx: number, dy: number) => void, private onAim: (instanceId?: number, target?: Target) => void, private isBlocked: () => boolean = () => !!document.querySelector('dialog[open]'), onJump: () => void = () => {}, private continuous: () => boolean = () => false, onInput:(kind:'touch'|'mouse'|'keyboard'|'action'|'joystick'|'look')=>void=()=>{}) {
    const blocked = this.isBlocked;
    const cast = (x: number, y: number,source:'pointer'|'keyboard'|'action'='pointer') => {
      if (blocked()) return;
      const hit = this.pick(x, y);
      if (hit && hit.object.userData.target !== 'ground') onCommand(hit.object.userData.target as Target, hit.point, hit.instanceId,source);
    };
    const beginHold = (x: number, y: number, owner: number | "key") => {
      if (blocked() || !this.continuous() || this.held) return false;
      const hit = this.pick(x, y);
      if (hit?.object.userData.target !== 'hay') return false;
      this.held = true; this.holdOwner = owner; this.holdX = x; this.holdY = y; this.holdAge = 0;
      onCommand('hay', hit.point, hit.instanceId,'hold-start'); return true;
    };
    this.heldCommand = () => {
      const hit = this.pick(this.holdX, this.holdY);
      if (hit?.object.userData.target === 'hay') onCommand('hay', hit.point, hit.instanceId,'hold-repeat');
    };
    this.listen(canvas, 'pointerdown', e => {
      if (this.down || e.button !== 0 || blocked()) return;
      onInput(e.pointerType==='touch'?'touch':'mouse');
      canvas.focus({ preventScroll: true });
      this.down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, id: e.pointerId, dragged: false };
      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      beginHold((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1, e.pointerId);
    });
    this.listen(canvas, 'pointermove', e => {
      const d = this.down;
      if (!d || d.id !== e.pointerId) return;
      if (!d.dragged && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8){d.dragged=true;onInput('look');}
      if (d.dragged && !blocked()) onLook(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX; d.lastY = e.clientY;
    });
    this.listen(canvas, 'pointercancel', e => { this.down = undefined; if (this.holdOwner === e.pointerId) this.held = false; });
    this.listen(canvas, 'lostpointercapture', e => { this.down = undefined; if (this.holdOwner === e.pointerId) this.held = false; });
    this.listen(canvas, 'pointerup', e => {
      const d = this.down; this.down = undefined;
      if (this.holdOwner === e.pointerId) { this.held = false; this.holdOwner = undefined; return; }
      if (!d || d.id !== e.pointerId || d.dragged) return;
      const rect = canvas.getBoundingClientRect();
      cast((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    });
    this.listen(canvas, 'contextmenu', e => e.preventDefault());
    this.listen(window, 'keydown', e => {
      if (blocked() || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if(!e.repeat&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','KeyE'].includes(e.code))onInput('keyboard');
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.code)) { e.preventDefault(); this.keys.add(e.code); }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) onJump(); }
      if (e.code === 'KeyE' && !e.repeat && !beginHold(0, 0, "key")) cast(0, 0,'keyboard');
    });
    this.listen(window, 'keyup', e => { this.keys.delete(e.code); if (e.code === 'KeyE' && this.holdOwner === 'key') this.held = false; });
    this.listen(window, 'blur', () => this.reset());
    this.listen(document, 'visibilitychange', () => this.reset());
    const interact = document.querySelector<HTMLButtonElement>('#interact')!;
    this.listen(interact, 'contextmenu', e => e.preventDefault());
    this.listen(interact, 'pointerdown', e => {
      if (e.button !== 0) return;
      if(!blocked())onInput('action');
      this.heldButtonClick = beginHold(0, 0, e.pointerId);
      if (this.heldButtonClick) interact.setPointerCapture(e.pointerId);
    });
    this.listen(interact, 'pointerup', e => { if (this.holdOwner === e.pointerId) this.held = false; });
    this.listen(interact, 'pointercancel', e => { if (this.holdOwner === e.pointerId) this.held = false; this.heldButtonClick = false; });
    this.listen(interact, 'lostpointercapture', e => { if (this.holdOwner === e.pointerId) this.held = false; });
    this.listen(interact, 'click', () => { if (!this.heldButtonClick) cast(0, 0,'action'); this.heldButtonClick = false; });
    this.listen(document.querySelector<HTMLButtonElement>('#jump')!, 'click', () => { if (!blocked()) onJump(); });
    this.joystick = new VirtualJoystick(document.querySelector<HTMLElement>('#joystick')!, blocked,()=>onInput('joystick'));
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
  holdingCollection() { return this.held && this.continuous() && !this.isBlocked(); }
  updateHeld(dt: number, ready: boolean) {
    if (!this.holdingCollection()) return;
    this.holdAge += dt;
    if (ready && this.holdAge >= .06) { this.holdAge = 0; this.heldCommand?.(); }
  }
  reset() { this.keys.clear(); this.joystick?.reset(); this.down = undefined; this.held = false; this.holdOwner = undefined; this.heldButtonClick = false; }
  dispose() { this.controller.abort(); this.observer?.disconnect(); this.reset(); this.joystick.dispose(); this.onAim(); }
  movement(): Vector2 {
    const has = (...keys: string[]) => keys.some(key => this.keys.has(key));
    const stick = this.joystick.movement();
    return this.vector.set(stick.x + Number(has('KeyD','ArrowRight')) - Number(has('KeyA','ArrowLeft')), stick.y + Number(has('KeyW','ArrowUp')) - Number(has('KeyS','ArrowDown'))).clampLength(0, 1);
  }
}


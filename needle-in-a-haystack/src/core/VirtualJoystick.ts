import { Vector2 } from 'three';
import { config } from '../config/balance';

export class VirtualJoystick {
  private controller = new AbortController();
  private observer: ResizeObserver;
  private pointerId?: number;
  private value = new Vector2();
  private knob: HTMLElement;
  constructor(private element: HTMLElement, private blocked: () => boolean) {
    this.knob = element.querySelector<HTMLElement>('.joystick-knob')!;
    const signal = this.controller.signal;
    element.addEventListener('pointerdown', event => {
      if (this.pointerId !== undefined || event.button !== 0 || this.blocked()) return;
      event.preventDefault(); this.pointerId = event.pointerId;
      element.setPointerCapture(event.pointerId); element.dataset.active = 'true';
      this.move(event.clientX, event.clientY);
    }, { signal });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointerId) return;
      if (this.blocked()) { this.reset(); return; }
      event.preventDefault(); this.move(event.clientX, event.clientY);
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) element.addEventListener(type, event => {
      if (event.pointerId === this.pointerId) this.reset();
    }, { signal });
    element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.observer = new ResizeObserver(() => this.reset()); this.observer.observe(element);
  }
  private move(x: number, y: number) {
    const rect = this.element.getBoundingClientRect();
    const radius = Math.max(1, (Math.min(rect.width, rect.height) - this.knob.offsetWidth) / 2 - 4);
    const dx = (x - rect.left - rect.width / 2) / radius, dy = (y - rect.top - rect.height / 2) / radius;
    const distance = Math.hypot(dx, dy), length = Math.min(1, distance);
    const strength = Math.max(0, (length - config.input.joystickDeadZone) / (1 - config.input.joystickDeadZone));
    if (distance > 0) this.value.set(dx / distance * strength, -dy / distance * strength);
    else this.value.set(0, 0);
    const scale = distance > 1 ? 1 / distance : 1;
    this.knob.style.transform = `translate(${dx * scale * radius}px, ${dy * scale * radius}px)`;
  }
  movement() { return this.value; }
  reset() {
    const pointer = this.pointerId; this.pointerId = undefined;
    this.value.set(0, 0); this.knob.style.transform = 'translate(0px, 0px)'; this.element.dataset.active = 'false';
    if (pointer !== undefined && this.element.hasPointerCapture(pointer)) this.element.releasePointerCapture(pointer);
  }
  dispose() { this.reset(); this.controller.abort(); this.observer.disconnect(); }
}

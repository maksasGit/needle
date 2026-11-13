import { config } from '../config/balance';

/** Feet height and ballistic jumping, independent of camera and rendering. */
export class Locomotion {
  height = 0;
  velocity = 0;
  grounded = true;
  jump() {
    if (!this.grounded) return false;
    this.velocity = config.locomotion.jumpSpeed; this.grounded = false;
    return true;
  }
  canStep(surface: number) { return surface <= this.height + config.locomotion.stepHeight; }
  update(dt: number, surface: number) {
    // Small fixed upper bound keeps landings stable at low frame rates.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (this.grounded && surface >= this.height - 0.06 && this.canStep(surface)) {
        this.height = surface; this.velocity = 0;
      } else {
        this.grounded = false;
        this.height += this.velocity * step - config.locomotion.gravity * step * step / 2;
        this.velocity -= config.locomotion.gravity * step;
        if (this.height <= surface && this.velocity <= 0) {
          this.height = surface; this.velocity = 0; this.grounded = true;
        }
      }
    }
  }
}

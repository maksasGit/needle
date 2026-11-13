import { PerspectiveCamera, Vector2 } from 'three';
import { config } from '../config/balance';
export class CameraController {
  readonly camera = new PerspectiveCamera(config.firstPerson.fov, 1, 0.05, 80);
  yaw = 0;
  pitch: number = config.firstPerson.startPitch;
  constructor() {
    this.camera.rotation.order = 'YXZ';
    this.yaw = Math.atan2(config.hay.x, 3.3 - config.hay.z) * -1;
  }
  look(dx: number, dy: number) {
    this.yaw -= dx * config.firstPerson.lookSensitivity;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * config.firstPerson.lookSensitivity));
  }
  follow(position: Vector2, feetHeight = 0) {
    this.camera.position.set(position.x, feetHeight + config.firstPerson.eyeHeight, position.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }
  resize(width: number, height: number) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}

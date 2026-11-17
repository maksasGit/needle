import * as THREE from 'three';
import { config } from '../config/balance';
import { pigBalance, barnWalls, barnWorld } from '../config/progression';
import { MovementSystem } from '../systems/MovementSystem';
import { ToolAssets } from './ToolAssets';

type Pig = { model: THREE.Group; point: THREE.Vector2; target: THREE.Vector2; age: number; eating: boolean; cooldown: number };
export class PigHerd {
  readonly group = new THREE.Group();
  private pigs: Pig[] = [];
  private navigation = new MovementSystem([config.cart, ...barnWalls]);
  private candidate = new THREE.Vector2();
  private delta = new THREE.Vector2();
  private seed = 12345;
  constructor(private assets: ToolAssets) {}
  private random() { this.seed = Math.imul(this.seed, 1664525) + 1013904223 | 0; return (this.seed >>> 0) / 4294967296; }
  private wander(pig: Pig) {
    pig.eating = false; pig.age = 0;
    for (let i = 0; i < 12; i++) {
      this.candidate.set((this.random() - .5) * (config.worldHalfSize * 2 - 2), (this.random() - .5) * (config.worldHalfSize * 2 - 2));
      if (this.navigation.walkable(this.candidate) && Math.hypot(this.candidate.x - config.hay.x, this.candidate.y - config.hay.z) > config.hay.radius + .4) {
        pig.target.copy(this.candidate); return;
      }
    }
    pig.target.copy(pig.point);
  }
  update(dt: number, count: number, surface: (x: number, z: number) => number, feedingPoint: (point: THREE.Vector2) => THREE.Vector3 | undefined, onEat: (index: number, point: THREE.Vector3, mouth: THREE.Vector3) => void, intervalMultiplier = 1, measure?: (mode: 'wander' | 'approach' | 'waiting', dt: number,index:number) => void) {
    while (this.pigs.length < count && this.pigs.length < 3) {
      const index = this.pigs.length, model = this.assets.pig();
      model.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
      const spawn = barnWorld(4.9 - index * .55, -2.1);
      const point = new THREE.Vector2(spawn.x, spawn.z);
      const pig = { model, point, target: point.clone(), age: 0, eating: false, cooldown: pigBalance.intervals[index] };
      this.group.add(model); this.pigs.push(pig); this.wander(pig);
    }
    for (let index = 0; index < this.pigs.length; index++) {
      const pig = this.pigs[index]; pig.age += dt; pig.cooldown = Math.max(0, pig.cooldown - dt / intervalMultiplier);
      if (!pig.eating && pig.age > 3) {
        const target = feedingPoint(pig.point);
        if (target) { pig.target.set(target.x, target.z); pig.eating = true; pig.age = 0; }
      }
      this.delta.copy(pig.target).sub(pig.point);
      const distance = this.delta.length();
      measure?.(!pig.eating ? 'wander' : distance > .55 ? 'approach' : 'waiting', dt,index);
      if (distance > .06) {
        this.delta.multiplyScalar(Math.min(distance, pigBalance.speed * dt) / distance);
        this.candidate.set(pig.point.x + this.delta.x, pig.point.y);
        if (this.navigation.clear(pig.point, this.candidate)) pig.point.x = this.candidate.x;
        this.candidate.set(pig.point.x, pig.point.y + this.delta.y);
        if (this.navigation.clear(pig.point, this.candidate)) pig.point.y = this.candidate.y;
        pig.model.rotation.y = Math.atan2(this.delta.x, this.delta.y);
      }
      pig.model.position.set(pig.point.x, surface(pig.point.x, pig.point.y), pig.point.y);
      pig.model.rotation.z = distance > .06 ? Math.sin(pig.age * 8) * .035 : 0;
      if (pig.eating && distance < .55 && pig.cooldown === 0) {
        const target = feedingPoint(pig.point);
        if (target && Math.hypot(target.x - pig.point.x, target.z - pig.point.y) < .7) onEat(index, target, pig.model.position.clone().add(new THREE.Vector3(0, .35, 0)));
        pig.cooldown = pigBalance.intervals[index]; this.wander(pig);
      } else if ((!pig.eating && distance < .1 && pig.age > 1) || pig.age > 40) this.wander(pig);
    }
  }
}

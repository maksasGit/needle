import { Vector2 } from 'three';
import { config } from '../config/balance';

export type Obstacle = { x: number; z: number; radius: number } | { x: number; z: number; halfX: number; halfZ: number; yaw?: number };

// A small eight-neighbour navigation grid. Inflated obstacles leave space for the body.
export class MovementSystem {
  readonly limit = config.worldHalfSize - config.playerRadius;
  private step = config.gridStep;
  private size = Math.floor(this.limit * 2 / this.step) + 1;
  private sample = new Vector2();
  constructor(readonly obstacles: readonly Obstacle[]) {}

  walkable(p: Vector2): boolean {
    return Math.abs(p.x) <= this.limit && Math.abs(p.y) <= this.limit &&
      this.obstacles.every(o => 'radius' in o
        ? Math.hypot(p.x - o.x, p.y - o.z) > o.radius + config.playerRadius
        : this.outsideWall(p, o));
  }
  private outsideWall(p: Vector2, wall: { x: number; z: number; halfX: number; halfZ: number; yaw?: number }) {
    const c = Math.cos(wall.yaw ?? 0), s = Math.sin(wall.yaw ?? 0);
    const dx = p.x - wall.x, dz = p.y - wall.z;
    const x = c * dx - s * dz, z = s * dx + c * dz;
    return Math.hypot(Math.max(0, Math.abs(x) - wall.halfX), Math.max(0, Math.abs(z) - wall.halfZ)) > config.playerRadius;
  }

  clear(a: Vector2, b: Vector2): boolean {
    const distance = a.distanceTo(b);
    const count = Math.max(1, Math.ceil(distance / 0.06));
    for (let i = 0; i <= count; i++) {
      if (!this.walkable(this.sample.copy(a).lerp(b, i / count))) return false;
    }
    return true;
  }

  path(start: Vector2, requested: Vector2): Vector2[] {
    const points: Vector2[] = [];
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      points.push(new Vector2(-this.limit + x * this.step, -this.limit + y * this.step));
    }
    const nearest = (p: Vector2, visibleFrom?: Vector2) => {
      let best = -1, distance = Infinity;
      points.forEach((v, i) => {
        const d = v.distanceToSquared(p);
        if (d < distance && this.walkable(v) && (!visibleFrom || this.clear(visibleFrom, v))) {
          best = i; distance = d;
        }
      });
      return best;
    };
    const first = nearest(start, start), last = nearest(requested);
    if (first < 0 || last < 0) return [];
    const target = this.walkable(requested) ? requested : points[last];
    if (this.clear(start, target)) return [target.clone()];
    const open = new Set([first]);
    const cost = new Map([[first, 0]]), previous = new Map<number, number>();
    while (open.size) {
      let current = -1, score = Infinity;
      for (const id of open) {
        const f = cost.get(id)! + points[id].distanceTo(points[last]);
        if (f < score) { score = f; current = id; }
      }
      if (current === last) {
        const route = [points[last]];
        while (previous.has(current)) { current = previous.get(current)!; route.unshift(points[current]); }
        if (this.clear(route[route.length - 1], target)) route.push(target.clone());
        const smooth: Vector2[] = [];
        let anchor = start;
        while (route.length) {
          let farthest = route.length - 1;
          while (farthest > 0 && !this.clear(anchor, route[farthest])) farthest--;
          anchor = route[farthest]; smooth.push(anchor); route.splice(0, farthest + 1);
        }
        return smooth;
      }
      open.delete(current);
      const cx = current % this.size, cy = Math.floor(current / this.size);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || cx + dx < 0 || cx + dx >= this.size || cy + dy < 0 || cy + dy >= this.size) continue;
        const next = (cy + dy) * this.size + cx + dx;
        if (!this.clear(points[current], points[next])) continue;
        const g = cost.get(current)! + points[current].distanceTo(points[next]);
        if (g < (cost.get(next) ?? Infinity)) { cost.set(next, g); previous.set(next, current); open.add(next); }
      }
    }
    return [];
  }

  approach(start: Vector2, obstacle: Extract<Obstacle, { radius: number }>): Vector2[] {
    let best: Vector2[] = [], shortest = Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const r = obstacle.radius + config.playerRadius + config.interactionGap;
      const target = new Vector2(obstacle.x + Math.cos(angle) * r, obstacle.z + Math.sin(angle) * r);
      const route = this.path(start, target);
      if (!route.length || route[route.length - 1].distanceTo(target) > 0.1) continue;
      let length = 0, p = start;
      for (const v of route) { length += p.distanceTo(v); p = v; }
      if (length < shortest) { shortest = length; best = route; }
    }
    return best;
  }
}

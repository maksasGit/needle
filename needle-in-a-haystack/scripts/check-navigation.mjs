import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { Vector2 } from 'three';

const result = await build({ configFile: false, logLevel: 'silent', build: { ssr: 'src/systems/MovementSystem.ts', write: false, minify: false } });
const source = result.output[0].code.replace(/from ["']three["']/g, `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { MovementSystem } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const obstacles = [{ x: -1.6, z: -0.8, radius: 1.65 }, { x: 2.7, z: 0.6, radius: 1.35 }];
const movement = new MovementSystem(obstacles);
function verify(start, route) {
  assert.ok(route.length, 'Expected reachable route');
  for (const point of route) {
    assert.ok(movement.walkable(point), 'Waypoint inside world and outside obstacles');
    assert.ok(movement.clear(start, point), 'Entire segment clears obstacles');
    start = point;
  }
}
const start = new Vector2(0, 3.3);
for (const target of [new Vector2(-4, -4), new Vector2(5, -4), new Vector2(20, 20), new Vector2(-1.6, -0.8)]) verify(start, movement.path(start, target));
for (const obstacle of obstacles) {
  for (const origin of [start, new Vector2(-5, -4), new Vector2(5, -4)]) {
    const route = movement.approach(origin, obstacle); verify(origin, route);
    const distance = route.at(-1).distanceTo(new Vector2(obstacle.x, obstacle.z));
    assert.ok(Math.abs(distance - obstacle.radius - 0.28 - 0.25) < 0.001);
  }
}
const route = movement.path(start, new Vector2(-5, -4));
let position = start;
for (const point of route) {
  const mid = position.clone().lerp(point, 0.5);
  verify(mid, movement.path(mid, new Vector2(5, 4)));
  position = point;
}
console.log('Navigation checks passed: bounds, obstacle clearance, approach distance, command changes.');

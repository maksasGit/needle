import { diamondIndex } from '../config/meta';
import * as THREE from 'three';
import { config } from '../config/balance';
import { createStrawGeometry } from './strawGeometry';
import { decodeHay } from '../systems/SaveSystem';
import { createStrawOutline } from './strawOutline';
import { strawRarity } from '../config/rarity';

export function quantizedAngle(value: number) {
  return Math.max(-3141, Math.min(3141, Math.round(Math.atan2(Math.sin(value), Math.cos(value)) * 1000)));
}

type Piece = { id: number; position: THREE.Vector3; target: THREE.Vector3; rotation: THREE.Euler; velocity: number; slot: number; column: number; color: THREE.Color };
type Column = { x: number; z: number; phase: number; bias: number; pieces: Piece[]; neighbours: number[] };

/** Granular approximation: stable column supports + a bounded local avalanche. */
export class Haystack {
  readonly group = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  private columns: Column[] = [];
  private pieces: Piece[] = [];
  private byId = new Map<number, Piece>();
  private highlightMesh: THREE.Mesh;
  private outlineBack: THREE.Mesh;
  private highlighted?: Piece;
  private active = new Set<Piece>();
  private dummy = new THREE.Object3D();
  private flights: { position: THREE.Vector3; end: THREE.Vector3; age: number; rotation: THREE.Euler }[] = [];
  private flying: THREE.InstancedMesh;
  private randomSeed = 42;
  private initialized = false;
  private snapshotCache?: string;
  private snapshotBuffer = new Int16Array(config.totalHay * 8);
  private rotationEncoding = new Int16Array(config.totalHay * 3);
  private rotationReady = new Uint8Array(config.totalHay);
  private binaryBuffer?: Uint16Array;
  private binaryDecoder?: TextDecoder;
  private shadowProxy: THREE.Mesh;
  private shadowHeight = 1;
  private supportHeight = config.hayVisual.layerHeight * config.hayVisual.contactScale;
  get count() { return this.pieces.length; }
  get activeCount() { return this.active.size; }
  feedingPoint(point: THREE.Vector2) {
    let nearest: Piece | undefined, best = Infinity;
    const x = point.x - this.group.position.x, z = point.y - this.group.position.z;
    for (const column of this.columns) {
      const top = column.pieces.at(-1); if (!top) continue;
      const score = (top.position.x - x) ** 2 + (top.position.z - z) ** 2;
      if (score < best) { nearest = top; best = score; }
    }
    return nearest?.position.clone().add(this.group.position);
  }
  surfaceHeight(x: number, z: number) {
    x -= this.group.position.x; z -= this.group.position.z;
    if (Math.hypot(x, z) > config.hay.radius + config.playerRadius) return 0;
    let height = 0;
    // A continuous support envelope over column tops bridges tiny strand gaps.
    // O(columns), never a raycast against all 20,000 instances.
    for (const column of this.columns) {
      const top = column.pieces.at(-1);
      if (!top) continue;
      const distance = Math.hypot(x - column.x, z - column.z);
      height = Math.max(height, top.position.y + config.hayVisual.stalkWidth / 2 -
        Math.max(0, distance - config.hayVisual.spacing * 0.6) * config.locomotion.surfaceSlope);
    }
    return height;
  }
  constructor() {
    const settings = config.hayVisual;
    const geometry = createStrawGeometry();
    const material = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geometry, material, config.totalHay);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.target = 'hay';
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    // A bounded mound casts the ground shadow, avoiding a second pass over 20k straws.
    this.shadowProxy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    this.shadowProxy.castShadow = true;
    this.group.add(this.shadowProxy);
    // A fixed bound avoids recalculating a bounding sphere for every moving stalk.
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 3);
    this.flying = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffd83d, roughness: 1 }), settings.maxFlights);
    this.flying.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flying.frustumCulled = false; this.flying.count = 0;
    this.group.position.set(config.hay.x, 0, config.hay.z);
    this.group.add(this.mesh, this.flying);
    // Only the selected stalk gets an edge overlay. It stays readable across
    // overlapping straws without filling the stalk or postprocessing the scene.
    this.outlineBack = new THREE.Mesh(createStrawOutline(geometry, 0.0075), new THREE.MeshBasicMaterial({ color: 0x07111e, depthTest: false, depthWrite: false, toneMapped: false }));
    this.outlineBack.renderOrder = 10;
    this.outlineBack.visible = false;
    this.highlightMesh = new THREE.Mesh(createStrawOutline(geometry, 0.0045), new THREE.MeshBasicMaterial({ color: 0xb7fff1, depthTest: false, depthWrite: false, toneMapped: false }));
    this.highlightMesh.renderOrder = 11;
    this.highlightMesh.visible = false;
    this.group.add(this.outlineBack, this.highlightMesh);
    for (let z = -settings.rings; z <= settings.rings; z++) for (let x = -settings.rings; x <= settings.rings; x++) {
      const px = (x + (Math.abs(z) % 2) * 0.5) * settings.spacing;
      const pz = z * settings.spacing * 0.866;
      if (Math.hypot(px, pz) <= settings.radius) {
        const phase = this.random() * this.supportHeight;
        this.columns.push({ x: px, z: pz, phase, bias: phase + (px * px + pz * pz) * settings.slope, pieces: [], neighbours: [] });
      }
    }
    this.columns.forEach((column, i) => this.columns.forEach((other, j) => {
      if (i !== j && Math.hypot(column.x - other.x, column.z - other.z) < settings.spacing * 1.12) column.neighbours.push(j);
    }));
    // Fill the lowest weighted column first to form a dense rounded mound.
    for (let i = 0; i < config.totalHay; i++) {
      let selected = 0, score = Infinity;
      this.columns.forEach((c, index) => {
        const value = c.bias + c.pieces.length * this.supportHeight;
        if (value < score) { score = value; selected = index; }
      });
      const c = this.columns[selected];
      const target = this.target(c, c.pieces.length);
      const piece: Piece = { id: i, position: target.clone(), target, rotation: new THREE.Euler((this.random() - 0.5) * 1.4, this.random() * Math.PI * 2, (this.random() - 0.5) * 1.2), velocity: 0, slot: i, column: selected, color: new THREE.Color().setHSL(0.085 + this.random() * 0.035, 0.85 + this.random() * 0.15, 0.46 + this.random() * 0.16) };
      const rarity = strawRarity(piece.id);
      if (rarity.bonus) piece.color.setHex(rarity.color);
      c.pieces.push(piece); this.pieces.push(piece); this.byId.set(piece.id, piece); this.write(piece);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.initialized = true;
    for (const column of this.columns) this.shadowHeight = Math.max(this.shadowHeight, column.pieces.at(-1)?.target.y ?? 0);
    this.updateShadow();
    this.installRaycast();
  }
  private installRaycast() {
    const probe = new THREE.Mesh(this.mesh.geometry, this.mesh.material);
    const localRay = new THREE.Ray(), inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4();
    const bounds = new THREE.Box3(), sphere = new THREE.Sphere();
    const hits: THREE.Intersection[] = [];
    this.mesh.geometry.computeBoundingSphere();
    const radius = this.mesh.geometry.boundingSphere!.radius;
    this.mesh.raycast = (raycaster, intersects) => {
      inverse.copy(this.mesh.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(inverse);
      const test = (piece: Piece) => {
        sphere.center.copy(piece.position); sphere.radius = radius;
        if (!localRay.intersectsSphere(sphere)) return;
        this.mesh.getMatrixAt(piece.slot, matrix);
        probe.matrixWorld.multiplyMatrices(this.mesh.matrixWorld, matrix);
        probe.raycast(raycaster, hits);
        for (const hit of hits) { hit.instanceId = piece.slot; hit.object = this.mesh; intersects.push(hit); }
        hits.length = 0;
      };
      const s = config.hayVisual, margin = radius + s.horizontalJitter;
      // Reject whole columns before testing individual stalks. Moving stalks
      // are tested separately, since they can still be outside their new column.
      for (const column of this.columns) {
        if (!column.pieces.length) continue;
        bounds.min.set(column.x - margin, -radius, column.z - margin);
        const top = column.pieces.at(-1)!.target.y;
        bounds.max.set(column.x + margin, Math.max(top, s.floor + column.phase + column.pieces.length * this.supportHeight) + radius + s.verticalJitter, column.z + margin);
        if (!localRay.intersectsBox(bounds)) continue;
        for (const piece of column.pieces) if (!this.active.has(piece)) test(piece);
      }
      for (const piece of this.active) test(piece);
    };
  }
  private random() { this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0; return this.randomSeed / 4294967296; }
  private target(c: Column, layer: number) {
    const s = config.hayVisual;
    // Each column has its own phase; no shared horizontal planes through the pile.
    return new THREE.Vector3(c.x + (this.random() - 0.5) * s.horizontalJitter,
      s.floor + c.phase + layer * this.supportHeight + (this.random() - 0.5) * s.verticalJitter * s.contactScale,
      c.z + (this.random() - 0.5) * s.horizontalJitter);
  }
  private write(piece: Piece) {
    // Cache quantized rotations; settling invalidates only the bounded set of moving pieces.
    if (!this.rotationReady[piece.id]) {
      const offset = piece.id * 3;
      this.rotationEncoding[offset] = quantizedAngle(piece.rotation.x); this.rotationEncoding[offset + 1] = quantizedAngle(piece.rotation.y); this.rotationEncoding[offset + 2] = quantizedAngle(piece.rotation.z);
      this.rotationReady[piece.id] = 1;
    }
    this.dummy.position.copy(piece.position); this.dummy.rotation.copy(piece.rotation); this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
    this.mesh.setMatrixAt(piece.slot, this.dummy.matrix); this.mesh.setColorAt(piece.slot, piece.color);
    if (this.initialized) this.mesh.instanceMatrix.addUpdateRange(piece.slot * 16, 16);
  }
  snapshot(): string {
    if (this.snapshotCache !== undefined) return this.snapshotCache;
    const data = this.snapshotBuffer;
    for (let i = 0; i < this.count; i++) {
      const p = this.pieces[i], offset = i * 8;
      data[offset] = p.id; data[offset + 1] = p.column;
      data[offset + 2] = Math.round(p.target.x * 1000); data[offset + 3] = Math.round(p.target.y * 1000); data[offset + 4] = Math.round(p.target.z * 1000);
      const angles = p.id * 3;
      data[offset + 5] = this.rotationEncoding[angles]; data[offset + 6] = this.rotationEncoding[angles + 1]; data[offset + 7] = this.rotationEncoding[angles + 2];
    }
    const bytes = new Uint8Array(data.buffer, 0, this.count * 16);
    const native = (bytes as Uint8Array & {toBase64?:()=>string}).toBase64;
    if (typeof native === 'function') return this.snapshotCache = native.call(bytes);
    // Each code unit is 0…255. UTF-16 decoding avoids large JS argument spreads;
    // unlike a latin1 decoder it preserves bytes 0x80…0x9f for btoa.
    this.binaryBuffer ??= new Uint16Array(config.totalHay * 16);
    this.binaryDecoder ??= new TextDecoder('utf-16le');
    for (let i = 0; i < bytes.length; i++) this.binaryBuffer[i] = bytes[i];
    const binary = this.binaryDecoder.decode(new Uint8Array(this.binaryBuffer.buffer, 0, bytes.length * 2));
    return this.snapshotCache = btoa(binary);
  }
  private updateShadow() {
    const scale = Math.cbrt(this.count / config.totalHay);
    this.shadowProxy.visible = this.count > 0;
    this.shadowProxy.scale.set(config.hayVisual.radius * scale, this.shadowHeight * scale, config.hayVisual.radius * scale);
  }
  restore(encoded: string, sourceContactScale: number = config.hayVisual.contactScale, sourceTotal: number = config.totalHay, sourceProfile: number = config.hayVisual.profileVersion) {
    this.snapshotCache = undefined;
    this.rotationReady.fill(0);
    if (!Number.isFinite(sourceContactScale) || sourceContactScale < 0.25 || sourceContactScale > 1) throw new Error('Invalid hay contact scale');
    if (!Number.isSafeInteger(sourceTotal) || sourceTotal < 1 || sourceTotal > config.totalHay) throw new Error('Invalid source hay total');
    if (!Number.isInteger(sourceProfile) || sourceProfile < 0 || sourceProfile > config.hayVisual.profileVersion) throw new Error('Invalid hay profile');
    const data = decodeHay(encoded), original = new Map(this.byId);
    for (let i = 0; i < data.length; i += 8) if (data[i + 1] >= this.columns.length) throw new Error('Invalid hay column');
    this.pieces = []; this.byId.clear(); this.active.clear(); this.flights.length = 0; this.highlight();
    for (const column of this.columns) column.pieces.length = 0;
    for (let i = 0; i < data.length; i += 8) {
      const piece = original.get(data[i])!;
      if (!piece) throw new Error('Unknown straw');
      piece.slot = this.pieces.length;
      if (sourceProfile !== config.hayVisual.profileVersion) {
        // Repack only surviving stable ids onto the new profile. This changes
        // layout, never inventory, earned coins or already harvested identities.
        const column = this.columns[piece.column];
        piece.target.y = config.hayVisual.floor + column.phase + column.pieces.length * this.supportHeight;
      } else {
        piece.column = data[i + 1];
        piece.target.set(data[i + 2] / 1000, data[i + 3] / 1000, data[i + 4] / 1000);
      }
      if (sourceProfile === config.hayVisual.profileVersion && sourceContactScale !== config.hayVisual.contactScale) {
        const floor = config.hayVisual.floor;
        piece.target.y = floor + (piece.target.y - floor) * config.hayVisual.contactScale / sourceContactScale;
      }
      piece.position.copy(piece.target); piece.rotation.set(data[i + 5] / 1000, data[i + 6] / 1000, data[i + 7] / 1000); piece.velocity = 0;
      this.pieces.push(piece); this.byId.set(piece.id, piece); this.columns[piece.column].pieces.push(piece); this.write(piece);
    }
    for (const column of this.columns) column.pieces.sort((a, b) => a.target.y - b.target.y);
    // Extend an unfinished older run without bringing back already collected ids.
    for (let id = sourceTotal; id < config.totalHay; id++) {
      const piece = original.get(id)!;
      const column = this.columns[piece.column];
      piece.slot = this.pieces.length;
      piece.target.y = column.pieces.length ? column.pieces.at(-1)!.target.y + this.supportHeight : config.hayVisual.floor + column.phase;
      piece.position.copy(piece.target); piece.velocity = 0;
      column.pieces.push(piece); this.pieces.push(piece); this.byId.set(id, piece); this.write(piece);
    }
    this.mesh.count = this.count; this.flying.count = 0;
    this.updateShadow();
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  idAt(slot?: number): number | undefined { return slot === undefined ? undefined : this.pieces[slot]?.id; }
  highlight(id?: number) {
    this.highlighted = id === undefined ? undefined : this.byId.get(id);
    this.updateHighlight();
  }
  private updateHighlight() {
    this.outlineBack.visible = this.highlightMesh.visible = !!this.highlighted;
    if (this.highlighted) {
      this.highlightMesh.position.copy(this.highlighted.position);
      this.highlightMesh.rotation.copy(this.highlighted.rotation);
      this.outlineBack.position.copy(this.highlighted.position);
      this.outlineBack.rotation.copy(this.highlighted.rotation);
    }
  }
  strawPosition(id: number, out: THREE.Vector3) { const straw=this.byId.get(id); if(!straw)return false; out.copy(straw.position).add(this.group.position); return true; }
  remove(amount: number, worldPoint: THREE.Vector3, receiver: THREE.Vector3, selectedId?: number, discoveryMultiplier = 1) {
    if (amount > 0) this.snapshotCache = undefined;
    const diamonds: number[] = [];
    let bonus = 0, rareCount = 0, highest = strawRarity();
    const local = worldPoint.clone().sub(this.group.position);
    const end = receiver.clone().sub(this.group.position); end.y = receiver.y || 0.8;
    const affected = new Set<number>();
    for (let n = 0; n < amount && this.count; n++) {
      let selected = -1, distance = Infinity;
      this.columns.forEach((c, i) => {
        const top = c.pieces.at(-1);
        if (!top) return;
        const d = top.position.distanceToSquared(local);
        if (d < distance) { distance = d; selected = i; }
      });
      // Keep a stable identity across dense instance-slot swaps and settling.
      const removed = (n === 0 && selectedId !== undefined ? this.byId.get(selectedId) : undefined) ?? this.columns[selected].pieces.at(-1)!;
      const gem = diamondIndex(removed.id); if (gem >= 0) diamonds.push(gem);
      const rarity = strawRarity(removed.id);
      if (rarity.bonus) { bonus += Math.ceil(rarity.bonus * discoveryMultiplier); rareCount++; if (rarity.bonus > highest.bonus) highest = rarity; }
      selected = removed.column;
      const column = this.columns[selected];
      const index = column.pieces.indexOf(removed);
      column.pieces.splice(index, 1);
      for (const supported of column.pieces.slice(index)) {
        supported.target.y -= this.supportHeight;
        supported.velocity = 0;
        if (this.active.size < config.hayVisual.maxActive) this.active.add(supported);
        else if (!this.active.has(supported)) { supported.position.copy(supported.target); this.write(supported); }
      }
      this.byId.delete(removed.id);
      if (this.highlighted === removed) this.highlight();
      affected.add(selected); this.active.delete(removed);
      if (this.flights.length < config.hayVisual.maxFlights) this.flights.push({ position: removed.position.clone(), end: end.clone(), age: 0, rotation: removed.rotation.clone() });
      const last = this.pieces.pop()!;
      if (last !== removed) { last.slot = removed.slot; this.pieces[removed.slot] = last; this.write(last); }
    }
    // Move a limited number of surface stalks into the new gaps. Only those
    // stalks receive gravity/rolling updates; the rest of the pile sleeps.
    const queue = [...affected];
    let transfers = 0;
    for (let q = 0; q < queue.length && transfers < config.hayVisual.maxTransfers; q++) {
      const lowIndex = queue[q], low = this.columns[lowIndex];
      for (const highIndex of low.neighbours) {
        const high = this.columns[highIndex];
        if (high.pieces.length - low.pieces.length <= config.hayVisual.stableLayers || this.active.size >= config.hayVisual.maxActive) continue;
        const piece = high.pieces.pop()!;
        piece.column = lowIndex; piece.target.copy(this.target(low, low.pieces.length)); piece.velocity = 0;
        low.pieces.push(piece); this.active.add(piece); queue.push(highIndex);
        if (++transfers >= config.hayVisual.maxTransfers) break;
      }
    }
    this.mesh.count = this.count;
    this.updateShadow();
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return { bonus, rareCount, highest, diamonds };
  }
  update(dt: number) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    const settings = config.hayVisual;
    let changed = false;
    for (const piece of this.active) {
      piece.velocity += settings.gravity * dt;
      piece.position.y = Math.max(piece.target.y, piece.position.y - piece.velocity * dt);
      if (piece.position.y === piece.target.y) piece.velocity = 0;
      const blend = 1 - Math.exp(-settings.rollSpeed * dt);
      const rollDistance = Math.hypot(piece.target.x - piece.position.x, piece.target.z - piece.position.z) * blend;
      piece.position.x += (piece.target.x - piece.position.x) * blend;
      piece.position.z += (piece.target.z - piece.position.z) * blend;
      piece.rotation.x += rollDistance / settings.stalkLength + piece.velocity * dt * 0.5;
      this.rotationReady[piece.id] = 0;
      if (piece.position.distanceToSquared(piece.target) < 0.00004) { piece.position.copy(piece.target); this.active.delete(piece); }
      this.write(piece); changed = true;
    }
    if (changed) { this.snapshotCache = undefined; this.mesh.instanceMatrix.needsUpdate = true; }
    const hadFlights = this.flights.length > 0;
    let live = 0;
    for (const flight of this.flights) { flight.age += dt; if (flight.age < settings.flightSeconds) this.flights[live++] = flight; }
    this.flights.length = live;
    this.flights.forEach((flight, i) => {
      const t = flight.age / settings.flightSeconds;
      this.dummy.position.copy(flight.position).lerp(flight.end, t);
      this.dummy.position.y += Math.sin(t * Math.PI) * 0.3;
      this.dummy.rotation.copy(flight.rotation); this.dummy.rotateY(t * 3);
      this.dummy.scale.setScalar(1 - t * 0.85); this.dummy.updateMatrix(); this.flying.setMatrixAt(i, this.dummy.matrix);
    });
    this.flying.count = this.flights.length;
    if (hadFlights) this.flying.instanceMatrix.needsUpdate = true;
    this.updateHighlight();
  }
  settleImmediately() {
    for (const piece of this.active) { piece.position.copy(piece.target); piece.velocity = 0; this.write(piece); }
    if (this.active.size) this.mesh.instanceMatrix.needsUpdate = true;
    this.active.clear(); this.flights.length = 0; this.flying.count = 0; this.updateHighlight();
  }
}



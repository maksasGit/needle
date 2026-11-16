import * as THREE from 'three';
import { config, upgrades } from '../config/balance';
import { createStrawGeometry } from '../world/strawGeometry';
import { ToolAssets } from '../world/ToolAssets';
import { disposeTree } from '../core/dispose';

/** Small camera-local scene: hands/tools stay readable without clipping into the pile. */
export class FirstPersonView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(config.firstPerson.fov, 1, 0.02, 5);
  private root = new THREE.Group();
  private left = new THREE.Group();
  private right = new THREE.Group();
  private tool = new THREE.Group();
  private heads: THREE.Group[] = [];
  private assets: ToolAssets;
  private carry = new THREE.Group();
  private straws: THREE.InstancedMesh;
  private level = -1;
  private feedback = 0;
  private amount = 0;
  private dummy = new THREE.Object3D();
  reducedMotion = false;
  get count() { return this.straws.count; }
  get toolLevel() { return this.level; }
  constructor(assets = new ToolAssets()) {
    this.assets = assets;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b28a, 1.8));
    const light = new THREE.DirectionalLight(0xfff3ce, 2.3); light.position.set(-2, 3, 1); this.scene.add(light);
    this.scene.add(this.root);
    this.root.add(this.left, this.right, this.tool, this.carry);
    for (const hand of [this.left, this.right]) {
      this.box(hand, [0.13, 0.23, 0.13], [0, -0.13, 0.03], 0x278bdf);
      this.box(hand, [0.135, 0.16, 0.12], [0, 0.055, 0], 0xffcf8b);
    }
    const max = config.capacity + upgrades.capacity.step * upgrades.capacity.maxLevel;
    this.straws = new THREE.InstancedMesh(createStrawGeometry(), new THREE.MeshStandardMaterial({ color: 0xffd83d, roughness: 1 }), max);
    this.straws.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.straws.frustumCulled = false;
    this.straws.count = 0; this.carry.add(this.straws);
    this.setInventory(0, 0); this.update(0, 0, config.collectionSeconds);
  }
  private box(parent: THREE.Object3D, size: [number, number, number], p: [number, number, number], color: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
    mesh.position.set(...p); parent.add(mesh); return mesh;
  }
  setInventory(amount: number, toolLevel: number) {
    if (amount > this.amount) this.feedback = config.presentation.pickupFeedback;
    if (amount < this.amount) this.feedback = 0;
    const changed = this.level !== toolLevel;
    if (toolLevel > 0 && !this.heads[toolLevel - 1]) {
      const model = this.assets.tool(toolLevel); this.heads[toolLevel - 1] = model; this.tool.add(model);
    }
    this.amount = amount; this.straws.count = amount; this.level = toolLevel;
    this.tool.visible = toolLevel > 0;
    this.left.visible = this.right.visible = toolLevel === 0;
    this.heads.forEach((head, i) => { head.visible = i === toolLevel - 1; });
    this.carry.position.set(toolLevel === 4 ? .2 : toolLevel ? 0.12 : 0, toolLevel ? -0.08 : -0.24, toolLevel === 4 ? -1 : toolLevel ? -0.82 : -0.55);
    for (let i = 0; i < amount; i++) {
      const col = i % 8, row = Math.floor(i / 8) % 5, layer = Math.floor(i / 40);
      this.dummy.position.set((col - 3.5) * 0.022, layer * 0.022, (row - 2) * 0.035);
      this.dummy.rotation.set(Math.sin(i) * 0.12, Math.PI / 2 + Math.sin(i * 1.7) * 0.16, Math.cos(i) * 0.1);
      this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.straws.setMatrixAt(i, this.dummy.matrix);
    }
    if (amount > 0 || changed) this.straws.instanceMatrix.needsUpdate = true;
  }
  releasePoint(camera: THREE.Camera) {
    this.root.updateMatrixWorld(true);
    const point = this.carry.getWorldPosition(new THREE.Vector3());
    return camera.localToWorld(point);
  }
  update(dt: number, collectionRemaining: number, collectionDuration: number) {
    this.feedback = Math.max(0, this.feedback - dt);
    const t = collectionRemaining > 0 ? 1 - collectionRemaining / collectionDuration : 0;
    const reach = !this.reducedMotion && collectionRemaining > 0 ? Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) : 0;
    const pickup = Math.sin(this.feedback / config.presentation.pickupFeedback * Math.PI);
    this.root.position.set(0, -reach * 0.025 + pickup * 0.035, -reach * (this.level === 4 ? .04 : .18));
    this.root.rotation.x = -reach * (this.level === 4 ? .02 : .12);
    if (this.reducedMotion) { this.root.position.set(0, 0, 0); this.root.rotation.x = 0; }
    this.left.position.set(-0.15, -0.29, -0.55); this.left.rotation.set(-0.85, 0, -0.25);
    this.right.position.set(this.level ? 0.22 : 0.16, -0.32, -0.51); this.right.rotation.set(-0.7 - reach * 0.4, 0, 0.25);
    this.tool.position.set(0.2, -0.35, -0.58); this.tool.rotation.set(-0.85 - reach * (this.level === 4 ? .04 : .35), 0, -0.18);
    if (!this.reducedMotion) {
      if (this.level === 1) { this.tool.position.z -= reach * .1; this.tool.rotation.z += reach * .22; }
      else if (this.level === 2) { this.tool.position.y += reach * .07; this.tool.rotation.x -= reach * .12; }
      else if (this.level === 3) { this.tool.position.x -= Math.sin(t * Math.PI * 2) * reach * .09; this.tool.rotation.z -= reach * .18; }
      else if (this.level === 4) { this.tool.position.z -= reach * .04; this.tool.rotation.z += pickup * .025; }
      else { this.left.position.x += reach * .035; this.right.position.x -= reach * .035; }
    }
    this.left.visible = this.right.visible = this.level === 0;
  }
  render(renderer: THREE.WebGLRenderer, worldCamera: THREE.PerspectiveCamera) {
    this.camera.aspect = worldCamera.aspect;
    this.camera.fov = worldCamera.fov;
    this.camera.updateProjectionMatrix();
    // Keep the model inside narrow portrait screens without changing world FOV.
    const scale = Math.min(1, Math.max(0.55, worldCamera.aspect));
    this.root.scale.set(scale, scale, 1);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false; renderer.clearDepth();
    renderer.render(this.scene, this.camera); renderer.autoClear = autoClear;
  }
  dispose() { disposeTree(this.scene); }
}

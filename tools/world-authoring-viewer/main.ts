import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SPAWNS, WORLD_CONNECTIONS } from '../../src/config';
import { WORLD_LAYOUTS } from '../../src/data/world';
import { AREA4_SPEC } from '../../src/data/world/area4';
import { AREA4_FOREST_SPEC } from '../../src/data/world/area4Forest';
import { validateWorldLayouts } from '../../src/data/world/validateWorld';
import { compileWorldCollision } from '../../src/domain/world/WorldCollisionCompiler';
import type { WorldCollisionShape } from '../../src/domain/world/WorldCollision';
import { WorldAssetLibrary } from '../../src/rendering/environment/WorldAssetLibrary';
import { WorldBuilder } from '../../src/rendering/environment/WorldBuilder';
import { createWorldMaterials } from '../../src/rendering/environment/WorldMaterials';
import { DevelopmentWorldAssetResolver, ProductionWorldAssetResolver } from '../../src/rendering/environment/WorldVisualAssetCatalog';

declare global {
  interface Window {
    __WORLD_AUTHORING_READY__?: boolean;
    __WORLD_AUTHORING_CAMERA__?: (preset: string) => void;
    __WORLD_AUTHORING_GATES__?: (open: boolean) => void;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b8cf);
scene.fog = new THREE.Fog(0x93b8cf, 300, 500);
scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x526044, 2.3));
const sun = new THREE.DirectionalLight(0xfff2d4, 2.7);
sun.position.set(-50, 90, 35);
sun.castShadow = true;
scene.add(sun);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
const world = new THREE.Group();
world.name = 'Infuse_Evergrowth_Assembled_Debug_World';
scene.add(world);
const colliderRoot = new THREE.Group();
colliderRoot.name = 'COLLISION_HELPERS_NON_AUTHORITATIVE';
scene.add(colliderRoot);
const spawnRoot = new THREE.Group();
spawnRoot.name = 'SPAWN_HELPERS';
scene.add(spawnRoot);
const clearanceRoot = new THREE.Group();
clearanceRoot.name = 'GATE_CLEARANCE_HELPERS';
scene.add(clearanceRoot);
const selectionHelper = new THREE.BoxHelper(undefined, 0xffeb54);
selectionHelper.visible = false;
scene.add(selectionHelper);

const status = document.querySelector<HTMLElement>('#status')!;
const chunks = document.querySelector<HTMLElement>('#chunks')!;
const stats = document.querySelector<HTMLElement>('#stats')!;
const warnings = document.querySelector<HTMLElement>('#warnings')!;
const selection = document.querySelector<HTMLElement>('#selection')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy')!;
const search = document.querySelector<HTMLInputElement>('#search')!;
const names = document.querySelector<HTMLDataListElement>('#placement-names')!;
const resolverSelect = document.querySelector<HTMLSelectElement>('#resolver')!;
let selected: THREE.Object3D | null = null;
let loadingGeneration = 0;

const compiledCollision = compileWorldCollision(WORLD_LAYOUTS);

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_');
}

function createColliderHelper(shape: WorldCollisionShape): THREE.Object3D {
  const material = new THREE.MeshBasicMaterial({ color: shape.activation ? 0xff7a45 : 0x35e3ff, transparent: true, opacity: 0.35, depthWrite: false });
  const mesh = shape.kind === 'circle'
    ? new THREE.Mesh(new THREE.CylinderGeometry(shape.radius, shape.radius, 0.14, 24), material)
    : new THREE.Mesh(new THREE.BoxGeometry(shape.width, 0.14, shape.depth), material);
  mesh.name = `COLLIDER_${sanitizeName(shape.id)}`;
  mesh.position.set(shape.x, 0.18, shape.z);
  if (shape.kind === 'rectangle') mesh.rotation.y = shape.rotation;
  mesh.userData = { collisionId: shape.id, collisionSource: shape.sourcePlacementName, sourceChunkId: shape.sourceChunkId, activation: shape.activation };
  return mesh;
}

function buildDiagnostics(): void {
  colliderRoot.clear();
  colliderRoot.add(...compiledCollision.all.map(createColliderHelper));
  colliderRoot.visible = false;
  spawnRoot.clear();
  const spawnGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12);
  for (const spawn of SPAWNS) {
    const marker = new THREE.Mesh(spawnGeometry, new THREE.MeshBasicMaterial({ color: spawn.isBoss ? 0xff3864 : 0xffdf54 }));
    marker.name = `SPAWN_${spawn.id}`;
    marker.position.set(spawn.x, 0.28, spawn.z);
    spawnRoot.add(marker);
  }
  spawnRoot.visible = false;
  // These rings reserve floor space only; they do not instantiate enemies.
  for (const layout of WORLD_LAYOUTS) {
    if (layout.kind !== 'area' || !('encounterSpots' in layout)) continue;
    for (const spot of layout.encounterSpots) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(spot.radius - .08, spot.radius, 48), new THREE.MeshBasicMaterial({ color: 0x7be4d1, side: THREE.DoubleSide }));
      marker.name = spot.id;
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(layout.origin[0] + spot.center[0], .16, layout.origin[2] + spot.center[1]);
      marker.userData = { encounterName: spot.name, reservedRadius: spot.radius, sourceChunkId: layout.id };
      spawnRoot.add(marker);
    }
  }
  clearanceRoot.clear();
  for (const connection of WORLD_CONNECTIONS) {
    const alongX = connection.axis === 'z';
    const helper = new THREE.Mesh(new THREE.BoxGeometry(alongX ? connection.width : 4, 0.08, alongX ? 4 : connection.width), new THREE.MeshBasicMaterial({ color: 0x72ff77, transparent: true, opacity: 0.35, depthWrite: false }));
    helper.name = `CLEARANCE_${connection.id}`;
    helper.position.set(connection.x, 0.3, connection.z);
    clearanceRoot.add(helper);
  }
  clearanceRoot.visible = false;
}

function worldObjectByName(name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  world.traverse((object) => { if (!found && object.name.toLowerCase() === name.trim().toLowerCase()) found = object; });
  return found;
}

function selectObject(object: THREE.Object3D | null): void {
  selected = object;
  selectionHelper.visible = Boolean(object);
  copyButton.disabled = !object;
  if (!object) {
    selection.textContent = 'Click a prop or search by stable name.';
    return;
  }
  selectionHelper.setFromObject(object);
  selectionHelper.visible = true;
  const worldPosition = object.getWorldPosition(new THREE.Vector3());
  selection.textContent = [
    `name: ${object.name}`,
    `prop: ${String(object.userData.propKey ?? '—')}`,
    `asset: ${String(object.userData.assetKey ?? '—')}`,
    `chunk: ${String(object.userData.chunkId ?? '—')}`,
    `local position: ${object.position.toArray().map((value) => value.toFixed(2)).join(', ')}`,
    `world position: ${worldPosition.toArray().map((value) => value.toFixed(2)).join(', ')}`,
    `rotation Y: ${object.rotation.y.toFixed(4)} rad / ${THREE.MathUtils.radToDeg(object.rotation.y).toFixed(1)}°`,
    `render scale: ${object.scale.x.toFixed(3)}`,
    `colliders: ${compiledCollision.all.filter((shape) => shape.sourcePlacementName === object.name && shape.sourceChunkId === object.userData.chunkId).length}`,
  ].join('\n');
}

function framePreset(preset: string): void {
  const layout = WORLD_LAYOUTS.find((candidate) => candidate.id === preset);
  if (preset === 'top') {
    controls.target.set(36, 0, 0);
    camera.position.set(36, 250, 0.1);
  } else if (preset === 'greenhaven') {
    controls.target.set(-2, 0, -2);
    camera.position.set(29, 77, 86);
  } else if (preset === 'highwood') {
    controls.target.set(34, 0, -61);
    camera.position.set(45, 102, 28);
  } else if (preset === 'highwood:portrait') {
    controls.target.set(18, 0, -60);
    camera.position.set(27, 23, -36);
  } else if (preset === 'fallen-keep') {
    controls.target.set(72, 0, -1);
    camera.position.set(99, 83, 80);
  } else if (preset === 'fallen-keep:portrait') {
    controls.target.set(73, 0, -13);
    camera.position.set(80, 24, 14);
  } else if (preset === 'area4') {
    controls.target.set(36, 0, 50);
    camera.position.set(48, 105, 151);
  } else if (preset === 'area4:forest') {
    controls.target.set(-12, 1.4, 67);
    camera.position.set(-4, 15, 83);
  } else if (preset === 'area4:grove-west' || preset === 'area4:grove-east') {
    const grove = preset === 'area4:grove-west' ? AREA4_FOREST_SPEC.groves.west : AREA4_FOREST_SPEC.groves.east;
    const x = AREA4_SPEC.origin[0] + grove.center[0], z = AREA4_SPEC.origin[2] + grove.center[1];
    controls.target.set(x, 1.8, z);
    camera.position.set(x + 12, 23, z + 24);
  } else if (preset === 'area4:rift') {
    controls.target.set(36, -2, 36);
    camera.position.set(48, 51, 102);
  } else if (preset === 'area4:rift-depth') {
    controls.target.set(18, -5, 35);
    camera.position.set(24, 8, 50);
  } else if (preset === 'area4:lava') {
    const pool = AREA4_SPEC.lavaPools[0];
    const x = AREA4_SPEC.origin[0] + pool.center[0], z = AREA4_SPEC.origin[2] + pool.center[1];
    controls.target.set(x, 0, z);
    camera.position.set(x + 5, 9, z + 9);
  } else if (preset === 'area4:throne') {
    const layout = WORLD_LAYOUTS.find((chunk) => chunk.id === 'area:A04')!;
    const throne = layout.props.find((prop) => prop.name === 'A04_Ancient_Throne')!;
    const x = layout.origin[0] + throne.position[0], z = layout.origin[2] + throne.position[2];
    const distance = Math.max(1, 0.7 / camera.aspect);
    controls.target.set(x, AREA4_SPEC.throne.height * 0.42, z);
    camera.position.set(x + 7 * distance, 3 + 6 * distance, z - 12 * distance);
  } else if (preset === 'area4:portrait') {
    controls.target.set(36, 1, 75);
    camera.position.set(44, 20, 56);
  } else if (preset === 'gate:A01-A04' || preset === 'gate:A03-A04') {
    const layout = WORLD_LAYOUTS.find((chunk) => chunk.id === `transition:${preset.slice(5)}`)!;
    const gate = layout.props.find((prop) => prop.name === 'A01_A04_LandGate' || prop.name === 'A03_SouthGate')!;
    const x = layout.origin[0] + gate.position[0], z = layout.origin[2] + gate.position[2];
    controls.target.set(x, 1.8, z + 3);
    camera.position.set(x - 10, 11, z - 18);
  } else if (preset === 'bridge:A01-A04' || preset === 'bridge:A03-A04') {
    const bridge = WORLD_CONNECTIONS.find((connection) => connection.id === (preset === 'bridge:A01-A04' ? 'area1-area4' : 'area3-area4'))!;
    controls.target.set(bridge.x, 0, bridge.z);
    camera.position.set(bridge.x + 12, 22, bridge.z + 20);
  } else if (preset === 'bridge:A01-A02') {
    const bridge = WORLD_CONNECTIONS.find((connection) => connection.id === 'area1-area2')!;
    const portraitDistance = Math.max(1, 0.8 / camera.aspect);
    controls.target.set(bridge.x, 1.8, bridge.z);
    camera.position.set(bridge.x - 13 * portraitDistance, 1.8 + 14.2 * portraitDistance, bridge.z + 18 * portraitDistance);
  } else if (layout) {
    controls.target.set(layout.origin[0], 0, layout.origin[2]);
    const distance = Math.max(layout.visualSize.width, layout.visualSize.depth) * 0.72;
    const direction = layout.id === 'area:A02'
      ? new THREE.Vector3(-0.25, 0.82, -0.7)
      : new THREE.Vector3(0.68, 0.82, 0.68);
    camera.position.set(
      layout.origin[0] + distance * direction.x,
      distance * direction.y,
      layout.origin[2] + distance * direction.z,
    );
  } else {
    controls.target.set(36, 0, 10);
    camera.position.set(54, 190, 170);
  }
  camera.lookAt(controls.target);
  controls.update();
}

async function loadWorld(): Promise<void> {
  const generation = ++loadingGeneration;
  window.__WORLD_AUTHORING_READY__ = false;
  status.className = '';
  status.textContent = 'Building typed layouts…';
  selectObject(null);
  world.clear();
  chunks.innerHTML = '';
  names.innerHTML = '';
  warnings.innerHTML = '';
  try {
    const resolver = resolverSelect.value === 'development' ? new DevelopmentWorldAssetResolver() : new ProductionWorldAssetResolver();
    const assets = new WorldAssetLibrary(resolver);
    const materials = await createWorldMaterials(assets);
    const builder = new WorldBuilder(assets, materials);
    const views = await Promise.all(WORLD_LAYOUTS.map(async (layout) => builder.build(layout, 'inspection')));
    if (generation !== loadingGeneration) return;
    window.__WORLD_AUTHORING_GATES__ = (open) => {
      for (const view of views) if (view.layout.kind === 'transition') view.setOpen(open);
    };
    for (const view of views) {
      world.add(view.root);
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" checked> ${view.layout.id} — ${view.layout.name}`;
      label.querySelector('input')!.addEventListener('change', (event) => { view.root.visible = (event.target as HTMLInputElement).checked; });
      chunks.append(label);
    }
    const placementNames: string[] = [];
    world.traverse((object) => { if (object.userData.editableProp) placementNames.push(object.name); });
    for (const name of placementNames.sort()) {
      const option = document.createElement('option');
      option.value = name;
      names.append(option);
    }
    buildDiagnostics();
    const issues = validateWorldLayouts(WORLD_LAYOUTS);
    for (const issue of issues) {
      const item = document.createElement('li');
      item.className = issue.severity;
      item.textContent = issue.message;
      warnings.append(item);
    }
    if (issues.length === 0) warnings.innerHTML = '<li class="ok">Typed layout validation passed.</li>';
    let triangles = 0;
    let meshes = 0;
    world.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes += 1;
      const geometry = object.geometry;
      triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3;
    });
    stats.textContent = `${WORLD_LAYOUTS.length} chunks · ${placementNames.length} props · ${compiledCollision.all.length} colliders · ${meshes} meshes · ${Math.round(triangles).toLocaleString()} triangles`;
    status.textContent = `Ready — ${resolverSelect.value} resolver`;
    framePreset('world');
    window.__WORLD_AUTHORING_READY__ = true;
  } catch (error) {
    status.className = 'error';
    status.textContent = error instanceof Error ? error.message : String(error);
    console.error(error);
  }
}

async function exportDebugGlb(): Promise<void> {
  status.textContent = 'Exporting debug GLB…';
  const debugRoot = new THREE.Group();
  debugRoot.name = 'Infuse_Evergrowth_Assembled_Debug_World';
  debugRoot.userData = { units: 'meters', authority: 'inspection-only', source: 'typed WorldLayout + WorldCollisionCompiler' };
  debugRoot.add(world.clone(true), colliderRoot.clone(true), spawnRoot.clone(true), clearanceRoot.clone(true));
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    new GLTFExporter().parse(debugRoot, (value) => {
      if (value instanceof ArrayBuffer) resolve(value);
      else reject(new Error('Expected binary GLB export.'));
    }, reject, { binary: true, onlyVisible: false });
  });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([result], { type: 'model/gltf-binary' }));
  anchor.download = 'assembled-world-debug.glb';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  status.textContent = 'Debug GLB exported.';
}

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (event) => {
  pointer.set(event.clientX / canvas.clientWidth * 2 - 1, -(event.clientY / canvas.clientHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(world, true)[0]?.object;
  let candidate: THREE.Object3D | null = hit ?? null;
  while (candidate && !candidate.userData.editableProp) candidate = candidate.parent;
  selectObject(candidate);
});

search.addEventListener('change', () => {
  const object = worldObjectByName(search.value);
  selectObject(object ?? null);
  if (object) {
    const position = object.getWorldPosition(new THREE.Vector3());
    controls.target.copy(position);
    camera.position.copy(position).add(new THREE.Vector3(14, 12, 14));
  }
});
copyButton.addEventListener('click', () => { if (selected) void navigator.clipboard.writeText(selected.name); });
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => button.addEventListener('click', () => framePreset(button.dataset.camera ?? 'world')));
document.querySelector('#reload')!.addEventListener('click', () => void loadWorld());
document.querySelector('#export')!.addEventListener('click', () => void exportDebugGlb());
resolverSelect.addEventListener('change', () => void loadWorld());
document.querySelector<HTMLInputElement>('#colliders')!.addEventListener('change', (event) => { colliderRoot.visible = (event.target as HTMLInputElement).checked; });
document.querySelector<HTMLInputElement>('#spawns')!.addEventListener('change', (event) => { spawnRoot.visible = (event.target as HTMLInputElement).checked; });
document.querySelector<HTMLInputElement>('#clearances')!.addEventListener('change', (event) => { clearanceRoot.visible = (event.target as HTMLInputElement).checked; });
document.querySelector<HTMLInputElement>('#scatter')!.addEventListener('change', (event) => world.traverse((object) => { if (object.name.endsWith('_Scatter')) object.visible = (event.target as HTMLInputElement).checked; }));

function resize(): void {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
window.__WORLD_AUTHORING_CAMERA__ = framePreset;
renderer.setAnimationLoop(() => {
  controls.update();
  if (selected) selectionHelper.setFromObject(selected);
  renderer.render(scene, camera);
});
void loadWorld();

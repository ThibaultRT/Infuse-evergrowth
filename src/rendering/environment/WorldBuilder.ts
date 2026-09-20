import * as THREE from 'three';
import { WORLD_PROP_CATALOG, worldPropAssetKeys, type WorldPropDefinition } from '../../data/world/WorldPropCatalog';
import { expandWorldScatter, type AnyWorldLayout, type TransitionWorldLayout, type WorldPropPlacement } from '../../data/world/WorldLayout';
import { WorldAssetLibrary } from './WorldAssetLibrary';
import { createWorldRoad, createWorldSurface, createWorldTerrain, worldTerrainHeight } from './WorldGeometry';
import type { WorldMaterialSet } from './WorldMaterials';
import { compileWorldCollision } from '../../domain/world/WorldCollisionCompiler';
import { walkSurfaceHeight } from '../../domain/world/WorldWalkSurface';
import { createWalkSurfaceView } from './WorldWalkSurfaceView';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BlockoutMaterial, WorldBlockoutPart } from '../../data/world/area4';
import { createArea4Ground, createLavaBasin, createArea4LavaLake, createRiftBanks } from './Area4TerrainView';

export type WorldBuildMode = 'runtime' | 'inspection';

export class WorldChunkView {
  readonly root = new THREE.Group();
  private readonly lockedGateVisuals: THREE.Object3D[] = [];
  private readonly gateLeaves: { object: THREE.Object3D; closed: THREE.Quaternion; openAngle: number }[] = [];

  constructor(readonly layout: AnyWorldLayout) {
    this.root.name = layout.id.replace(':', '_');
    this.root.position.set(...layout.origin);
    this.root.userData = { chunkId: layout.id, chunkKind: layout.kind, editable: true, units: 'meters' };
  }

  addLockedGateVisual(object: THREE.Object3D): void {
    this.lockedGateVisuals.push(object);
    this.root.add(object);
  }

  setOpen(open: boolean): void {
    for (const object of this.lockedGateVisuals) object.visible = !open;
    for (const leaf of this.gateLeaves) {
      leaf.object.quaternion.copy(leaf.closed);
      if (open) leaf.object.rotateY(leaf.openAngle);
    }
  }

  addGateLeaf(object: THREE.Object3D, openAngle: number): void {
    this.gateLeaves.push({ object, closed: object.quaternion.clone(), openAngle });
  }

  update(_dt: number): void {}

  dispose(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.worldOwnedGeometry) object.geometry.dispose();
    });
    this.root.clear();
  }
}

export class WorldBuilder {
  constructor(
    private readonly assets: WorldAssetLibrary,
    private readonly materials: WorldMaterialSet,
  ) {}

  async prefetch(layout: AnyWorldLayout): Promise<void> {
    const placements = [...layout.props, ...layout.scatters.flatMap(expandWorldScatter)];
    await this.assets.preload(placements.flatMap((placement) => worldPropAssetKeys(placement.prop)));
  }

  async build(layout: AnyWorldLayout, mode: WorldBuildMode = 'runtime'): Promise<WorldChunkView> {
    await this.prefetch(layout);
    const view = new WorldChunkView(layout);
    const terrain = new THREE.Group();
    terrain.name = `${layout.id.replace(':', '_')}_TerrainAndRoads`;
    if (layout.kind === 'area' && layout.areaId === 4) {
      terrain.add(createArea4Ground(layout, this.materials.area4.ground));
    } else {
      // Rift transitions contain banks and a black closure, with no terrain mesh.
      if (layout.terrain !== 'rift') terrain.add(createWorldTerrain(layout, this.materials.terrain[layout.terrain]));
      for (const road of layout.roads) terrain.add(createWorldRoad(layout, road, this.materials));
    }
    if (layout.riftBanks) terrain.add(createRiftBanks(layout.riftBanks, layout.origin[0], this.materials.area4));
    for (const surface of layout.surfaces ?? []) terrain.add(createWorldSurface(surface, this.materials));
    view.root.add(terrain);

    const landmarks = new THREE.Group();
    landmarks.name = `${layout.id.replace(':', '_')}_Props`;
    const authored = await Promise.all(layout.props.map(async (placement) => this.createPlacement(layout, placement, mode)));
    if (authored.length) landmarks.add(...authored);
    view.root.add(landmarks);

    const scatter = new THREE.Group();
    scatter.name = `${layout.id.replace(':', '_')}_Scatter`;
    const scattered = await Promise.all(layout.scatters.flatMap(expandWorldScatter).map(async (placement) => this.createPlacement(layout, placement, mode)));
    if (scattered.length) scatter.add(...scattered);
    view.root.add(scatter);

    if (layout.kind === 'transition') {
      let hingedGate = false;
      for (const placement of layout.props) {
        const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
        const object = view.root.getObjectByName(placement.name);
        for (const leaf of definition.gate?.leaves ?? []) {
          const node = object?.getObjectByName(leaf.node);
          if (node) { view.addGateLeaf(node, leaf.openAngle); hingedGate = true; }
        }
      }
      if (!hingedGate) this.addLockedGateVisual(view, layout);
    }
    return view;
  }

  private async createPlacement(layout: AnyWorldLayout, placement: WorldPropPlacement, mode: WorldBuildMode, local = false): Promise<THREE.Object3D> {
    const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
    let model = definition.procedural
      ? (definition.procedural === 'lava-basin' ? createLavaBasin(this.materials.area4) : createArea4LavaLake(this.materials.area4))
      : definition.blockout ? this.createBlockout(definition.blockout) : await this.assets.instantiate(definition.asset, placement.name);
    const failed = Boolean(model.userData.worldAssetFallback);
    if (failed && definition.fallbackBlockout) {
      if (model instanceof THREE.Mesh) {
        model.geometry.dispose();
        for (const material of Array.isArray(model.material) ? model.material : [model.material]) material.dispose();
      }
      model = this.createBlockout(definition.fallbackBlockout);
      model.userData.worldAssetFallback = definition.asset;
    }
    const object = definition.walkSurface ? new THREE.Group() : model;
    object.name = placement.name;
    if (definition.walkSurface) {
      model.name = `${placement.name}_Model`;
      if (!failed || definition.fallbackBlockout) object.add(model);
      else if (model instanceof THREE.Mesh) {
        model.geometry.dispose();
        for (const material of Array.isArray(model.material) ? model.material : [model.material]) material.dispose();
      }
      const fallbackParts = definition.blockout ?? definition.fallbackBlockout;
      const deckMaterial = fallbackParts ? this.materials.blockout[fallbackParts[0].material] : this.materials.timber;
      object.add(createWalkSurfaceView(definition.walkSurface, deckMaterial, failed || Boolean(definition.blockout)));
    }
    const [x, requestedY, z] = placement.position;
    if (definition.visualChildren?.length) object.add(...await Promise.all(definition.visualChildren.map((child) => this.createPlacement(layout, { ...child, name: `${placement.name}/${child.name}` }, mode, true))));
    object.position.set(x, local || definition.walkSurface || definition.absoluteElevation ? requestedY : Math.max(requestedY, worldTerrainHeight(layout, x, z) + 0.025), z);
    object.rotation.y = placement.rotation ?? 0;
    object.scale.multiplyScalar(placement.scale ?? 1);
    object.userData = {
      ...object.userData,
      chunkId: layout.id,
      propKey: placement.prop,
      assetKey: definition.asset,
      editableProp: !local,
      cameraOccluder: definition.cameraOccluder === true,
      inspectionMode: mode === 'inspection',
    };
    return object;
  }

  private createBlockout(parts: readonly WorldBlockoutPart[]): THREE.Group {
    const root = new THREE.Group();
    const batches = new Map<BlockoutMaterial, THREE.BufferGeometry[]>();
    for (const part of parts) {
      const geometry = part.kind === 'cylinder'
        ? new THREE.CylinderGeometry(part.size[0] / 2, part.size[0] / 2, part.size[1], 8)
        : new THREE.BoxGeometry(...part.size);
      geometry.rotateY(part.rotation ?? 0);
      geometry.translate(...part.position);
      const batch = batches.get(part.material) ?? [];
      batch.push(geometry);
      batches.set(part.material, batch);
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      for (const geometry of geometries) geometry.dispose();
      const mesh = new THREE.Mesh(merged, this.materials.blockout[material]);
      mesh.castShadow = material !== 'lava';
      mesh.receiveShadow = true;
      mesh.userData.worldOwnedGeometry = true;
      root.add(mesh);
    }
    return root;
  }

  private addLockedGateVisual(view: WorldChunkView, layout: TransitionWorldLayout): void {
    const volume = compileWorldCollision([layout]).all.find((candidate) => candidate.activation?.connectionId === layout.connectionId);
    if (!volume || volume.kind !== 'rectangle') return;
    const barrier = new THREE.Group();
    barrier.name = `${layout.connectionId}_LockedBarrierVisual`;
    const railGeometry = new THREE.BoxGeometry(volume.width, 0.22, Math.max(0.18, volume.depth));
    for (const y of [0.8, 1.55]) {
      const rail = new THREE.Mesh(railGeometry, this.materials.lockedGate);
      rail.position.y = y;
      rail.castShadow = true;
      rail.userData.worldOwnedGeometry = true;
      barrier.add(rail);
    }
    const placement = layout.props.find((candidate) => candidate.name === volume.sourcePlacementName);
    const definition: WorldPropDefinition | undefined = placement ? WORLD_PROP_CATALOG[placement.prop] : undefined;
    const floor = definition?.gate?.floorHeight ?? (definition?.walkSurface && definition.gate ? walkSurfaceHeight(definition.walkSurface, ...definition.gate.barrier.center) ?? 0 : 0);
    barrier.position.set(volume.x - layout.origin[0], floor * (placement?.scale ?? 1) + (placement?.position[1] ?? 0), volume.z - layout.origin[2]);
    barrier.rotation.y = volume.rotation ?? 0;
    view.addLockedGateVisual(barrier);
  }
}

import * as THREE from 'three';
import { WORLD_PROP_CATALOG } from '../../data/world/WorldPropCatalog';
import { expandWorldScatter, type AnyWorldLayout, type TransitionWorldLayout, type WorldPropPlacement } from '../../data/world/WorldLayout';
import { WorldAssetLibrary } from './WorldAssetLibrary';
import { createWorldRoad, createWorldSurface, createWorldTerrain, worldTerrainHeight } from './WorldGeometry';
import type { WorldMaterialSet } from './WorldMaterials';

export type WorldBuildMode = 'runtime' | 'inspection';

export class WorldChunkView {
  readonly root = new THREE.Group();
  private readonly lockedGateVisuals: THREE.Object3D[] = [];

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
    await this.assets.preload(placements.map((placement) => WORLD_PROP_CATALOG[placement.prop].asset));
  }

  async build(layout: AnyWorldLayout, mode: WorldBuildMode = 'runtime'): Promise<WorldChunkView> {
    await this.prefetch(layout);
    const view = new WorldChunkView(layout);
    const terrain = new THREE.Group();
    terrain.name = `${layout.id.replace(':', '_')}_TerrainAndRoads`;
    terrain.add(createWorldTerrain(layout, this.materials.terrain[layout.terrain]));
    for (const road of layout.roads) terrain.add(createWorldRoad(layout, road, this.materials));
    for (const surface of layout.surfaces ?? []) terrain.add(createWorldSurface(surface, this.materials));
    view.root.add(terrain);

    const landmarks = new THREE.Group();
    landmarks.name = `${layout.id.replace(':', '_')}_Props`;
    const authored = await Promise.all(layout.props.map(async (placement) => this.createPlacement(layout, placement, mode)));
    landmarks.add(...authored);
    view.root.add(landmarks);

    const scatter = new THREE.Group();
    scatter.name = `${layout.id.replace(':', '_')}_Scatter`;
    const scattered = await Promise.all(layout.scatters.flatMap(expandWorldScatter).map(async (placement) => this.createPlacement(layout, placement, mode)));
    scatter.add(...scattered);
    view.root.add(scatter);

    if (layout.kind === 'transition') this.addLockedGateVisual(view, layout);
    return view;
  }

  private async createPlacement(layout: AnyWorldLayout, placement: WorldPropPlacement, mode: WorldBuildMode): Promise<THREE.Object3D> {
    const definition = WORLD_PROP_CATALOG[placement.prop];
    const object = await this.assets.instantiate(definition.asset, placement.name);
    const [x, requestedY, z] = placement.position;
    object.position.set(x, Math.max(requestedY, worldTerrainHeight(layout, x, z) + 0.025), z);
    object.rotation.y = placement.rotation ?? 0;
    object.scale.multiplyScalar(placement.scale ?? 1);
    object.userData = {
      ...object.userData,
      chunkId: layout.id,
      propKey: placement.prop,
      assetKey: definition.asset,
      editableProp: true,
      cameraOccluder: definition.cameraOccluder === true,
      inspectionMode: mode === 'inspection',
    };
    return object;
  }

  private addLockedGateVisual(view: WorldChunkView, layout: TransitionWorldLayout): void {
    const volume = layout.collision.find((candidate) => candidate.activation?.connectionId === layout.connectionId);
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
    barrier.position.set(volume.center[0], 0, volume.center[1]);
    barrier.rotation.y = volume.rotation ?? 0;
    view.addLockedGateVisual(barrier);
  }
}

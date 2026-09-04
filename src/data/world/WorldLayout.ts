import type { CollisionActivation, CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldVec2, WorldVec3 } from '../../domain/world/WorldPlacement';
import type { WorldPropKey } from './WorldPropCatalog';

export type WorldBounds = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
export type WorldSize = { readonly width: number; readonly depth: number };
export type TerrainProfile = 'meadow' | 'forest' | 'cobble' | 'transition-meadow' | 'transition-fortress';
export type RoadMaterial = 'trail' | 'cobble' | 'water';

export type WorldPropPlacement = {
  readonly name: string;
  readonly prop: WorldPropKey;
  readonly position: WorldVec3;
  readonly rotation?: number;
  readonly scale?: number;
  readonly collision?: 'prop-default' | 'none';
};

export type WorldScatterPlacement = {
  readonly prefix: string;
  readonly props: readonly WorldPropKey[];
  readonly count: number;
  readonly bounds: WorldBounds;
  readonly seed: number;
  readonly scale: readonly [number, number];
  readonly exclusions?: readonly { readonly center: WorldVec2; readonly radius: number }[];
  readonly collision?: 'none' | 'prop-default';
};

export type WorldRoadPlacement = {
  readonly name: string;
  readonly points: readonly WorldVec2[];
  readonly width: number;
  readonly material: RoadMaterial;
};

export type WorldSurfacePlacement = {
  readonly name: string;
  readonly kind: 'water' | 'cliff';
  readonly center: WorldVec2;
  readonly size: WorldSize;
  readonly rotation?: number;
  readonly elevation?: number;
};

export type ExplicitCollisionVolume = CollisionProxy & {
  readonly id: string;
  readonly activation?: CollisionActivation;
};

type WorldLayoutBase = {
  readonly id: string;
  readonly name: string;
  readonly origin: WorldVec3;
  readonly visualSize: WorldSize;
  readonly terrain: TerrainProfile;
  readonly roads: readonly WorldRoadPlacement[];
  readonly surfaces?: readonly WorldSurfacePlacement[];
  readonly props: readonly WorldPropPlacement[];
  readonly scatters: readonly WorldScatterPlacement[];
  readonly collision: readonly ExplicitCollisionVolume[];
};

export type AreaWorldLayout = WorldLayoutBase & {
  readonly kind: 'area';
  readonly areaId: number;
  readonly playableSize: WorldSize;
};

export type TransitionWorldLayout = WorldLayoutBase & {
  readonly kind: 'transition';
  readonly connectionId: string;
  readonly areaIds: readonly [number, number];
  readonly axis: 'x' | 'z';
  readonly crossingCenter: number;
  readonly crossingWidth: number;
  readonly barrierDepth?: number;
};

export type AnyWorldLayout = AreaWorldLayout | TransitionWorldLayout;

export type WallRunSpec = {
  readonly prefix: string;
  readonly prop: WorldPropKey;
  readonly from: WorldVec2;
  readonly to: WorldVec2;
  readonly spacing: number;
  readonly elevation?: number;
  readonly scale?: number;
  readonly gaps?: readonly { readonly center: WorldVec2; readonly radius: number }[];
  readonly brokenEvery?: number;
  readonly brokenProp?: WorldPropKey;
  readonly rotationOffset?: number;
  readonly omitIndices?: readonly number[];
};

export function createWallRun(spec: WallRunSpec): WorldPropPlacement[] {
  const dx = spec.to[0] - spec.from[0];
  const dz = spec.to[1] - spec.from[1];
  const distance = Math.hypot(dx, dz);
  const count = Math.max(1, Math.floor(distance / spec.spacing));
  const rotation = Math.atan2(dz, dx) + (spec.rotationOffset ?? 0);
  const placements: WorldPropPlacement[] = [];
  for (let index = 0; index <= count; index += 1) {
    const authoredIndex = index + 1;
    if (spec.omitIndices?.includes(authoredIndex)) continue;
    const progress = index / count;
    const x = spec.from[0] + dx * progress;
    const z = spec.from[1] + dz * progress;
    if (spec.gaps?.some(({ center, radius }) => Math.hypot(x - center[0], z - center[1]) < radius)) continue;
    const prop = spec.brokenEvery && spec.brokenProp && index % spec.brokenEvery === spec.brokenEvery - 1 ? spec.brokenProp : spec.prop;
    placements.push({
      name: `${spec.prefix}_${String(authoredIndex).padStart(3, '0')}`,
      prop,
      position: [x, spec.elevation ?? 0, z],
      rotation,
      scale: spec.scale,
    });
  }
  return placements;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function expandWorldScatter(scatter: WorldScatterPlacement): WorldPropPlacement[] {
  const random = seededRandom(scatter.seed);
  const placements: WorldPropPlacement[] = [];
  for (let index = 0; index < scatter.count; index += 1) {
    let x = scatter.bounds.minX;
    let z = scatter.bounds.minZ;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      x = scatter.bounds.minX + (scatter.bounds.maxX - scatter.bounds.minX) * random();
      z = scatter.bounds.minZ + (scatter.bounds.maxZ - scatter.bounds.minZ) * random();
      if (!scatter.exclusions?.some(({ center, radius }) => (x - center[0]) ** 2 + (z - center[1]) ** 2 < radius ** 2)) break;
    }
    const prop = scatter.props[Math.min(scatter.props.length - 1, Math.floor(random() * scatter.props.length))];
    if (!prop) continue;
    placements.push({
      name: `${scatter.prefix}_${String(index + 1).padStart(3, '0')}`,
      prop,
      position: [x, 0.02, z],
      rotation: random() * Math.PI * 2,
      scale: scatter.scale[0] + (scatter.scale[1] - scatter.scale[0]) * random(),
      collision: scatter.collision ?? 'none',
    });
  }
  return placements;
}

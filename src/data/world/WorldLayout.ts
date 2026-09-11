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
  /** Optional local X/Z polygon, used for irregular shorelines. */
  readonly outline?: readonly WorldVec2[];
  readonly rotation?: number;
  readonly elevation?: number;
};

export type WorldTerrainCutout = {
  readonly name: string;
  readonly center: WorldVec2;
  readonly size: WorldSize;
  readonly rotation?: number;
  readonly elevation: number;
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
  readonly terrainCutouts?: readonly WorldTerrainCutout[];
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
  /** Reserved clear ground for future encounters; never creates live spawns. */
  readonly encounterSpots?: readonly WorldEncounterSpot[];
};

export type WorldEncounterSpot = {
  readonly id: string;
  readonly name: string;
  readonly center: WorldVec2;
  readonly radius: number;
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
  /** Physical outer boundaries of the straight span, not module centers. */
  readonly from: WorldVec2;
  readonly to: WorldVec2;
  /** Unscaled length of the prop along its local X axis. */
  readonly moduleLength: number;
  readonly elevation?: number;
  readonly scale?: number;
  readonly alignment?: 'start' | 'center' | 'end';
  readonly startIndex?: number;
  readonly brokenEvery?: number;
  readonly brokenProp?: WorldPropKey;
  readonly rotationOffset?: number;
};

export function createWallRun(spec: WallRunSpec): WorldPropPlacement[] {
  const dx = spec.to[0] - spec.from[0];
  const dz = spec.to[1] - spec.from[1];
  const distance = Math.hypot(dx, dz);
  const moduleLength = spec.moduleLength * (spec.scale ?? 1);
  if (distance <= 0) throw new RangeError(`${spec.prefix} wall run must have distinct endpoints.`);
  if (moduleLength <= 0) throw new RangeError(`${spec.prefix} wall run must have a positive module length and scale.`);
  const count = Math.max(1, Math.ceil(distance / moduleLength));
  const coverage = count * moduleLength;
  const alignmentOffset = spec.alignment === 'start'
    ? 0
    : spec.alignment === 'end'
      ? distance - coverage
      : (distance - coverage) / 2;
  const ux = dx / distance;
  const uz = dz / distance;
  const rotation = Math.atan2(dz, dx) + (spec.rotationOffset ?? 0);
  const placements: WorldPropPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const authoredIndex = (spec.startIndex ?? 1) + index;
    const centerOffset = alignmentOffset + (index + 0.5) * moduleLength;
    const x = spec.from[0] + ux * centerOffset;
    const z = spec.from[1] + uz * centerOffset;
    const prop = spec.brokenEvery && spec.brokenProp && authoredIndex % spec.brokenEvery === 0 ? spec.brokenProp : spec.prop;
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
    // Dense exclusion zones can exhaust the attempts; never place inside them.
    if (scatter.exclusions?.some(({ center, radius }) => (x - center[0]) ** 2 + (z - center[1]) ** 2 < radius ** 2)) continue;
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

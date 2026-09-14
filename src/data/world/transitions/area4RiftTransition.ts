import { AREA4_SPEC } from '../area4';
import { AREA4_LAND_GATE_Z, AREA4_WALL_GATE_Z } from '../area4Bridges';
import type { TransitionWorldLayout } from '../WorldLayout';

/** Like A01/A02, the deck and rift straddle the unchanged area seam. */
export function area4RiftTransition(source: 1 | 3): TransitionWorldLayout {
  const { rift, bridge, crossings } = AREA4_SPEC;
  const sourceX = source === 1 ? 0 : 72;
  const center = source === 1 ? crossings.greenhavenX : crossings.fallenKeepLocalX;
  const prefix = source === 1 ? 'A01_A04' : 'A03_A04';
  // The two transition owners meet at world X=36 without overlapping floors.
  const minX = source === 1 ? -42 : -36;
  const maxX = source === 1 ? 36 : 42;
  const left = center - bridge.width / 2;
  const right = center + bridge.width / 2;
  return {
    kind: 'transition', id: `transition:A0${source}-A04`, connectionId: `area${source}-area4`, areaIds: [source, 4],
    name: source === 1 ? 'Greenhaven–Area 4 Forged Bridge' : 'Fallen Keep–Area 4 Ruined Timber Bridge',
    origin: [sourceX, 0, rift.seamZ], visualSize: { width: 84, depth: rift.depth }, terrain: 'rift',
    axis: 'z', crossingCenter: center, crossingWidth: bridge.width, barrierDepth: rift.depth,
    terrainCutouts: [{ name: `${prefix}_BelowBanks`, center: [0, 0], size: { width: 84, depth: rift.depth }, elevation: rift.floorY - 0.1 }],
    roads: [],
    surfaces: [{ name: `${prefix}_Abyss`, kind: 'abyss', center: [(minX + maxX) / 2, 0], size: { width: maxX - minX, depth: rift.depth }, elevation: rift.floorY }],
    props: [
      { name: `${prefix}_Bridge`, prop: source === 1 ? 'crossing.area4SkeletalBridge' : 'crossing.area4TimberBridge', position: [center, 0, 0] },
      { name: source === 1 ? 'A01_A04_LandGate' : 'A03_SouthGate', prop: source === 1 ? 'crossing.area4BoneGate' : 'ruin.area4SouthGate', position: [center, 0, source === 1 ? AREA4_LAND_GATE_Z : AREA4_WALL_GATE_Z] },
    ],
    scatters: [],
    collision: [
      { id: `${prefix}_Rift_West`, kind: 'rectangle', center: [(minX + left) / 2, 0], width: left - minX, depth: rift.depth },
      { id: `${prefix}_Rift_East`, kind: 'rectangle', center: [(right + maxX) / 2, 0], width: maxX - right, depth: rift.depth },
    ],
  };
}

export const A01_A04_TRANSITION = area4RiftTransition(1);
export const A03_A04_TRANSITION = area4RiftTransition(3);

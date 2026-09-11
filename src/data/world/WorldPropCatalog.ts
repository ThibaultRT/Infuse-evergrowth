import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldAssetKey } from './WorldAssetKeys';
import type { WorldWalkSurface } from '../../domain/world/WorldWalkSurface';
import { WOODLAND_BRIDGE_COLLISION, WOODLAND_BRIDGE_GATE, WOODLAND_BRIDGE_WALK_SURFACE } from './woodlandBridge';
import { GREENHAVEN_COLLISION } from './greenhaven';
import { HIGHWOOD_COLLISION } from './highwood';
import { FALLEN_KEEP_CORNER_COLLISION, FALLEN_KEEP_GATE_COLLISION, FALLEN_KEEP_WALL_COLLISION, fallenKeepShellCollision } from './fallenKeep';

export type WorldPropDefinition = {
  readonly asset: WorldAssetKey;
  readonly collision: readonly CollisionProxy[];
  readonly cameraOccluder?: boolean;
  readonly absoluteElevation?: boolean;
  readonly walkSurface?: WorldWalkSurface;
  readonly gate?: { readonly barrier: CollisionProxy; readonly leaves: readonly { readonly node: string; readonly openAngle: number }[] };
};

const rectangle = (width: number, depth: number, center: readonly [number, number] = [0, 0], rotation?: number): CollisionProxy => ({ kind: 'rectangle', center, width, depth, ...(rotation === undefined ? {} : { rotation }) });
const circle = (radius: number, center: readonly [number, number] = [0, 0]): CollisionProxy => ({ kind: 'circle', center, radius });
const prop = (asset: WorldAssetKey, collision: readonly CollisionProxy[] = []): WorldPropDefinition => ({ asset, collision });
const occludingProp = (asset: WorldAssetKey, collision: readonly CollisionProxy[] = []): WorldPropDefinition => ({ asset, collision, cameraOccluder: true });

export const WORLD_PROP_CATALOG = {
  'terrain.fallenKeep': { asset: 'terrain.fallenKeep', collision: [], absoluteElevation: true },
  'ruin.curtainA': occludingProp('ruin.curtainA', FALLEN_KEEP_WALL_COLLISION),
  'ruin.curtainB': occludingProp('ruin.curtainB', FALLEN_KEEP_WALL_COLLISION),
  'ruin.cornerTower': occludingProp('ruin.cornerTower', FALLEN_KEEP_CORNER_COLLISION),
  'ruin.gate': occludingProp('ruin.gate', FALLEN_KEEP_GATE_COLLISION),
  'ruin.cottage': occludingProp('ruin.cottage', fallenKeepShellCollision('cottage')),
  'ruin.barracks': occludingProp('ruin.barracks', fallenKeepShellCollision('barracks')),
  'ruin.chapel': occludingProp('ruin.chapel', fallenKeepShellCollision('chapel')),
  'ruin.keepHall': occludingProp('ruin.keepHall', fallenKeepShellCollision('hall')),
  'ruin.siegeDebris': prop('ruin.siegeDebris', [rectangle(3.4, 3.4)]),
  'terrain.highwood': { asset: 'terrain.highwood', collision: HIGHWOOD_COLLISION, absoluteElevation: true },
  'nature.highwoodBareA': occludingProp('nature.highwoodBareA', [circle(0.55)]),
  'nature.highwoodBareB': occludingProp('nature.highwoodBareB', [circle(0.55)]),
  'nature.highwoodBareC': occludingProp('nature.highwoodBareC', [circle(0.55)]),
  'nature.highwoodPineA': occludingProp('nature.highwoodPineA', [circle(0.45)]),
  'nature.highwoodPineB': occludingProp('nature.highwoodPineB', [circle(0.45)]),
  'wilds.timberWatchtower': occludingProp('wilds.timberWatchtower', [rectangle(2.9, 3.1)]),
  'terrain.greenhaven': { asset: 'terrain.greenhaven', collision: GREENHAVEN_COLLISION, absoluteElevation: true },
  'village.rusticFence': prop('village.rusticFence', [rectangle(5.4, 0.22)]),
  'village.rusticFenceGate': prop('village.rusticFenceGate', [rectangle(1.5, 0.22, [-1.9, 0]), rectangle(1.5, 0.22, [1.9, 0])]),
  'village.warmHomeA': occludingProp('village.warmHomeA', [rectangle(4.2, 3.7)]),
  'village.warmHomeB': occludingProp('village.warmHomeB', [rectangle(4.2, 3.7)]),
  'nature.greenhavenPineA': occludingProp('nature.greenhavenPineA', [circle(0.45)]),
  'nature.greenhavenPineB': occludingProp('nature.greenhavenPineB', [circle(0.45)]),
  'nature.greenhavenBoulder': prop('nature.greenhavenBoulder', [circle(0.9)]),
  'crossing.greenhavenFutureBridge': { asset: 'crossing.greenhavenFutureBridge', collision: [], absoluteElevation: true },
  'village.homeBlueA': occludingProp('village.homeBlueA', [rectangle(4.2, 3.7)]),
  'village.homeBlueB': occludingProp('village.homeBlueB', [rectangle(4.2, 3.7)]),
  'village.tavernBlue': occludingProp('village.tavernBlue', [rectangle(5.4, 4.2)]),
  'village.blacksmithBlue': occludingProp('village.blacksmithBlue', [rectangle(5.2, 4.1)]),
  'village.marketBlue': occludingProp('village.marketBlue', [rectangle(5.0, 3.8)]),
  'village.wellBlue': prop('village.wellBlue', [circle(1.15)]),
  'village.towerBlueA': occludingProp('village.towerBlueA', [circle(1.7)]),
  'village.towerBlueB': occludingProp('village.towerBlueB', [circle(1.7)]),
  'wilds.watermillGreen': occludingProp('wilds.watermillGreen', [rectangle(6.4, 4.8, [0.4, 0])]),
  'wilds.towerGreenA': occludingProp('wilds.towerGreenA', [circle(1.7)]),
  'wilds.towerGreenB': occludingProp('wilds.towerGreenB', [circle(1.7)]),
  'wilds.mineGreen': occludingProp('wilds.mineGreen', [rectangle(5.4, 4.2)]),
  'keep.homeRedA': occludingProp('keep.homeRedA', [rectangle(4.2, 3.7)]),
  'keep.homeRedB': occludingProp('keep.homeRedB', [rectangle(4.2, 3.7)]),
  'keep.barracksRed': occludingProp('keep.barracksRed', [rectangle(6.1, 4.5)]),
  'keep.towerRedA': occludingProp('keep.towerRedA', [circle(1.8)]),
  'keep.towerRedB': occludingProp('keep.towerRedB', [circle(1.8)]),
  'keep.castleRed': occludingProp('keep.castleRed', [rectangle(8.4, 7.1)]),
  'ruin.destroyed': occludingProp('ruin.destroyed', [rectangle(5.4, 4.7)]),
  'ruin.scaffolding': occludingProp('ruin.scaffolding', [rectangle(4.2, 2.8)]),
  'crossing.bridgeA': prop('crossing.bridgeA'),
  'crossing.bridgeB': prop('crossing.bridgeB'),
  'crossing.woodlandBridge': { asset: 'crossing.woodlandBridge', collision: WOODLAND_BRIDGE_COLLISION, walkSurface: WOODLAND_BRIDGE_WALK_SURFACE, gate: WOODLAND_BRIDGE_GATE },
  // These lengths follow the visible GLB bounds after the catalog's 7x base scale.
  // The gate proxies cover its solid side wings while preserving the open arch.
  'fortress.wall': prop('fortress.wall', [rectangle(14, 0.9)]),
  'fortress.gate': prop('fortress.gate', [rectangle(5.275, 1.1, [-4.3625, 0]), rectangle(5.275, 1.1, [4.3625, 0])]),
  // The normalized outside-corner pivot is asymmetric. These two local proxies
  // follow its long arms and rotate with every placement.
  'fortress.corner': prop('fortress.corner', [
    rectangle(0.9, 9.8, [-5.825, 0.297], Math.PI / 3),
    rectangle(14.84, 0.9, [0.855, -1.475], Math.PI / 3),
  ]),
  'village.woodFence': prop('village.woodFence', [rectangle(5.4, 0.45)]),
  'village.woodFenceGate': prop('village.woodFenceGate', [rectangle(1.5, 0.45, [-1.9, 0]), rectangle(1.5, 0.45, [1.9, 0])]),
  'prop.barrel': prop('prop.barrel', [circle(0.48)]),
  'prop.crate': prop('prop.crate', [rectangle(1.0, 1.0)]),
  'prop.crateOpen': prop('prop.crateOpen', [rectangle(1.0, 1.0)]),
  'prop.lumber': prop('prop.lumber', [rectangle(1.8, 0.9)]),
  'prop.stonePile': prop('prop.stonePile', [circle(1.1)]),
  'prop.tent': prop('prop.tent', [rectangle(3.6, 3.0)]),
  'prop.wheelbarrow': prop('prop.wheelbarrow', [rectangle(1.5, 0.8)]),
  'wilds.hillTreesA': occludingProp('wilds.hillTreesA', [circle(3.4)]),
  'wilds.hillTreesB': occludingProp('wilds.hillTreesB', [circle(3.4)]),
  'wilds.mountainTreesA': occludingProp('wilds.mountainTreesA', [circle(4.6)]),
  'wilds.mountainTreesB': occludingProp('wilds.mountainTreesB', [circle(4.6)]),
  'wilds.waterLily': prop('wilds.waterLily'),
  'wilds.waterPlant': prop('wilds.waterPlant'),
  'nature.treeCommon1': prop('nature.treeCommon1', [circle(0.75)]),
  'nature.treeCommon3': prop('nature.treeCommon3', [circle(0.75)]),
  'nature.rockMedium1': prop('nature.rockMedium1', [circle(0.7)]),
  'nature.rockMedium2': prop('nature.rockMedium2', [circle(0.7)]),
  'nature.flowerGroup': prop('nature.flowerGroup'),
  'nature.flowerBush': prop('nature.flowerBush'),
  'nature.grassTuft': prop('nature.grassTuft'),
  'nature.pineA': prop('nature.pineA', [circle(0.65)]),
  'nature.pineB': prop('nature.pineB', [circle(0.65)]),
  'nature.pineC': prop('nature.pineC', [circle(0.65)]),
  'nature.forestRockA': prop('nature.forestRockA', [circle(0.6)]),
  'nature.forestRockB': prop('nature.forestRockB', [circle(0.6)]),
  'nature.forestRockC': prop('nature.forestRockC', [circle(0.6)]),
  'nature.forestBushA': prop('nature.forestBushA'),
  'nature.forestBushB': prop('nature.forestBushB'),
  'nature.forestBushC': prop('nature.forestBushC'),
  'ruin.dungeonWallBroken': prop('ruin.dungeonWallBroken', [rectangle(3.7, 0.75)]),
  'ruin.dungeonWallCracked': prop('ruin.dungeonWallCracked', [rectangle(3.7, 0.75)]),
  'ruin.dungeonCorner': prop('ruin.dungeonCorner', [rectangle(1.1, 1.1)]),
  'ruin.rubbleHalf': prop('ruin.rubbleHalf', [circle(0.9)]),
  'ruin.rubbleLarge': prop('ruin.rubbleLarge', [circle(1.3)]),
  'landmark.fountain': occludingProp('landmark.fountain', [circle(1.65)]),
} as const satisfies Record<string, WorldPropDefinition>;

export type WorldPropKey = keyof typeof WORLD_PROP_CATALOG;

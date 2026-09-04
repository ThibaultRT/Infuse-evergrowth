import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldAssetKey } from './WorldAssetKeys';

export type WorldPropDefinition = {
  readonly asset: WorldAssetKey;
  readonly collision: readonly CollisionProxy[];
  readonly cameraOccluder?: boolean;
};

const rectangle = (width: number, depth: number, center: readonly [number, number] = [0, 0]): CollisionProxy => ({ kind: 'rectangle', center, width, depth });
const circle = (radius: number, center: readonly [number, number] = [0, 0]): CollisionProxy => ({ kind: 'circle', center, radius });
const prop = (asset: WorldAssetKey, collision: readonly CollisionProxy[] = []): WorldPropDefinition => ({ asset, collision });
const occludingProp = (asset: WorldAssetKey, collision: readonly CollisionProxy[] = []): WorldPropDefinition => ({ asset, collision, cameraOccluder: true });

export const WORLD_PROP_CATALOG = {
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
  'fortress.wall': prop('fortress.wall', [rectangle(5.8, 0.9)]),
  'fortress.wallBroken': prop('fortress.wall', [rectangle(5.8, 0.9)]),
  'fortress.gate': prop('fortress.gate', [rectangle(1.25, 1.1, [-2.35, 0]), rectangle(1.25, 1.1, [2.35, 0])]),
  'fortress.corner': prop('fortress.corner', [rectangle(2.0, 2.0)]),
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
  'landmark.fountain': prop('landmark.fountain', [circle(1.65)]),
} as const satisfies Record<string, WorldPropDefinition>;

export type WorldPropKey = keyof typeof WORLD_PROP_CATALOG;

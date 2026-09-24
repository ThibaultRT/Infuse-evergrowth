import firstLayer from './layer-01.json';
import secondLayer from './layer-02.json';
import thirdLayer from './layer-03.json';
import { SOUL_BONUS_NODES } from './bonus-nodes';
import { soulCost, weightedLayerMaximum, type SoulLayer, type SoulNode } from '../../domain/soul-catcher';

export type SoulLayerMetadata = { layer: number; name: string; unlockXp: number | null; authored: boolean };
const authored = [firstLayer, secondLayer, thirdLayer] as SoulLayer[];
const maximumWithBonuses = (layer: SoulLayer): number => weightedLayerMaximum({ ...layer, nodes: [...layer.nodes, ...SOUL_BONUS_NODES.filter((bonus) => bonus.layer === layer.layer).map((bonus) => bonus.node)] });
const layerTwoTarget = Math.round(maximumWithBonuses(authored[1]) * 0.8 / 1000) * 1000;
const layerThreeTarget = Math.round(maximumWithBonuses(authored[2]) * 0.8 / 1000) * 1000;
export const SOUL_LAYER_REGISTRY: SoulLayerMetadata[] = Array.from({ length: 10 }, (_, index) => {
  const layer = index + 1;
  const thresholds = [0, 84292, layerTwoTarget, layerThreeTarget, 2500000, 6000000, 14000000, 30000000, 60000000, 110000000];
  return { layer, name: authored[index]?.name ?? `Layer ${layer}`, unlockXp: layer === 1 ? 0 : thresholds[index], authored: Boolean(authored[index]) };
});
export const SOUL_LAYERS = authored;
export const SOUL_NODES: SoulNode[] = [...SOUL_LAYERS.flatMap((layer) => layer.nodes), ...SOUL_BONUS_NODES.map((bonus) => bonus.node)];
export const SOUL_NODE_BY_ID = new Map(SOUL_NODES.map((node) => [node.id, node]));
export const SOUL_NODE_LAYER = new Map([...SOUL_LAYERS.flatMap((layer) => layer.nodes.map((node) => [node.id, layer.layer] as const)), ...SOUL_BONUS_NODES.map((bonus) => [bonus.node.id, bonus.layer] as const)]);
export const soulLayer = (layer: number): SoulLayer | undefined => SOUL_LAYERS.find((entry) => entry.layer === layer);
export const soulNodes = (layer: number): SoulNode[] => [...(soulLayer(layer)?.nodes ?? []), ...SOUL_BONUS_NODES.filter((bonus) => bonus.layer === layer).map((bonus) => bonus.node)];
export const soulEdges = (layer: number): [string, string][] => [...(soulLayer(layer)?.nodes.flatMap((node) => node.neighbors.map((neighbor) => [node.id, neighbor] as [string, string])) ?? []), ...SOUL_BONUS_NODES.filter((bonus) => bonus.layer === layer).map((bonus) => [bonus.prerequisite, bonus.node.id] as [string, string])];
const ids = new Set(SOUL_NODES.map((node) => node.id));
const firstMinion = authored[0].nodes.find((node) => node.id === 'SC-MINION-01');
const radialDistance = (a: SoulNode, b: SoulNode): number => {
  const radiansA = a.position.angleDeg * Math.PI / 180, radiansB = b.position.angleDeg * Math.PI / 180;
  return Math.hypot(Math.cos(radiansA) * a.position.radius - Math.cos(radiansB) * b.position.radius,
    Math.sin(radiansA) * a.position.radius - Math.sin(radiansB) * b.position.radius);
};
function validCost(node: SoulNode): boolean {
  const { cost } = node;
  if (!Number.isSafeInteger(cost.base) || cost.base <= 0 || !Number.isSafeInteger(node.maxLevel) || node.maxLevel <= 0) return false;
  if (cost.formula === 'ceil(base * multiplier ** (level - 1))') {
    if (!Number.isFinite(cost.multiplier) || cost.multiplier <= 1) return false;
  } else if (cost.formula !== 'base + perLevel * (level - 1)' || !Number.isSafeInteger(cost.perLevel) || cost.perLevel < 0) return false;
  return Number.isSafeInteger(soulCost(node, node.maxLevel));
}
if (ids.size !== SOUL_NODES.length || !firstMinion || firstMinion.reward.effects[0]?.type !== 'unlockMinionSlot'
  || firstMinion.reward.effects[0].slotId !== 1 || SOUL_BONUS_NODES.length !== 2
  || SOUL_BONUS_NODES.some(({ layer, prerequisite, node }) => {
    const expected = layer === 2 ? { id: 'SC-MINION-02', prerequisite: 'SC-31', soulType: 'rare', cost: 40, slotId: 2 }
      : { id: 'SC-MINION-03', prerequisite: 'SC-65', soulType: 'epic', cost: 20, slotId: 3 };
    const effect = node.reward.effects[0];
    return node.id !== expected.id || prerequisite !== expected.prerequisite || node.cost.soulType !== expected.soulType
      || node.cost.base !== expected.cost || effect?.type !== 'unlockMinionSlot' || effect.slotId !== expected.slotId;
  })
  || SOUL_LAYERS.some((layer) => layer.nodes.filter((node) => node.number !== undefined).length !== 30
  || layer.nodes.some((node) => node.reward.effects.length !== 1 || !validCost(node)
    || node.neighbors.some((id) => !layer.nodes.some((candidate) => candidate.id === id))))
  || SOUL_BONUS_NODES.some(({ layer, prerequisite, node }) => !soulLayer(layer)?.nodes.some((candidate) => candidate.id === prerequisite)
    || node.number !== undefined || node.neighbors.length !== 0 || node.maxLevel !== 1 || !validCost(node)
    || node.cost.formula !== 'base + perLevel * (level - 1)' || node.cost.perLevel !== 0
    || node.reward.effects.length !== 1 || node.reward.effects[0].type !== 'unlockMinionSlot'
    || !Number.isFinite(node.position.angleDeg) || !Number.isFinite(node.position.radius) || node.position.radius <= 0
    || soulNodes(layer).some((candidate) => candidate.id !== node.id && radialDistance(node, candidate) < 0.65))) {
  throw new Error('Invalid Soul Catcher layer data');
}

import firstLayer from './layer-01.json';
import secondLayer from './layer-02.json';
import { weightedLayerMaximum, type SoulLayer, type SoulNode } from '../../domain/soul-catcher';

export type SoulLayerMetadata = { layer: number; name: string; unlockXp: number | null; authored: boolean };
const authored = [firstLayer, secondLayer] as SoulLayer[];
const layerTwoTarget = Math.round(weightedLayerMaximum(authored[1]) * 0.8 / 1000) * 1000;
export const SOUL_LAYER_REGISTRY: SoulLayerMetadata[] = Array.from({ length: 10 }, (_, index) => {
  const layer = index + 1;
  const thresholds = [0, 84292, layerTwoTarget, 1000000, 2500000, 6000000, 14000000, 30000000, 60000000, 110000000];
  return { layer, name: authored[index]?.name ?? `Layer ${layer}`, unlockXp: layer === 1 ? 0 : thresholds[index], authored: Boolean(authored[index]) };
});
export const SOUL_LAYERS = authored;
export const SOUL_NODES: SoulNode[] = SOUL_LAYERS.flatMap((layer) => layer.nodes);
export const SOUL_NODE_BY_ID = new Map(SOUL_NODES.map((node) => [node.id, node]));
export const soulLayer = (layer: number): SoulLayer | undefined => SOUL_LAYERS.find((entry) => entry.layer === layer);
export const soulEdges = (layer: number): [string, string][] => soulLayer(layer)?.nodes.flatMap((node) => node.neighbors.map((neighbor) => [node.id, neighbor] as [string, string])) ?? [];
const ids = new Set(SOUL_NODES.map((node) => node.id));
if (ids.size !== SOUL_NODES.length || SOUL_LAYERS.some((layer) => layer.nodes.length !== 30 || layer.nodes.some((node) => node.reward.effects.length !== 1 || node.neighbors.some((id) => !layer.nodes.some((candidate) => candidate.id === id))))) throw new Error('Invalid Soul Catcher layer data');

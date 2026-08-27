import firstLayer from './layer-01.json';
import type { SoulLayer, SoulNode } from '../../domain/soul-catcher';

export const SOUL_LAYERS = [firstLayer] as SoulLayer[];
export const SOUL_NODES: SoulNode[] = SOUL_LAYERS.flatMap((layer) => layer.nodes);
export const SOUL_NODE_BY_ID = new Map(SOUL_NODES.map((node) => [node.id, node]));
export const SOUL_EDGES: [string, string][] = SOUL_NODES.flatMap((node) => node.neighbors.map((neighbor) => [node.id, neighbor]));
const ids = new Set(SOUL_NODES.map((node) => node.id));
if (ids.size !== 30 || SOUL_NODES.some((node) => node.reward.effects.length !== 1 || node.neighbors.some((id) => !ids.has(id)))) throw new Error('Invalid Soul Catcher node data');

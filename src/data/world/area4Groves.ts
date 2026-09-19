import spec from './area4-forest.json';
import { expandWorldScatter, type WorldPropPlacement } from './WorldLayout';

const { groves, props } = spec;
// Branches can overhang the blocked disk, so other scenery reserves that space too.
export const AREA4_GROVE_VISUAL_RADIUS = groves.radius + (Math.max(props.trunkA.visualRadius, props.trunkB.visualRadius) - props.trunkA.radius) * groves.treeScale[1];

export const AREA4_GROVE_PLACEMENTS: readonly WorldPropPlacement[] = [
  { name: groves.west.name, prop: 'nature.charredGroveWest', position: [groves.west.center[0], 0, groves.west.center[1]], rotation: groves.west.rotation },
  { name: groves.east.name, prop: 'nature.charredGroveEast', position: [groves.east.center[0], 0, groves.east.center[1]], rotation: groves.east.rotation },
];

/** Local visual trees; the parent prop owns the complete circular collision. */
export function createArea4GroveTrees(seed: number): (WorldPropPlacement & { readonly collision: 'none' })[] {
  const samples = expandWorldScatter({
    prefix: 'Tree', props: ['nature.charredTrunkA', 'nature.charredTrunkB'],
    count: groves.trees, seed, bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
    scale: [groves.treeScale[0], groves.treeScale[1]], collision: 'none',
  });
  const trunkRadius = Math.max(props.trunkA.radius, props.trunkB.radius);
  const reach = groves.radius - trunkRadius * groves.treeScale[1];
  return samples.map((tree, index) => {
    // Stratified disk coverage avoids an empty centre or a chance pile of trunks.
    const radius = reach * Math.sqrt((index + .5) / samples.length);
    const angle = index * Math.PI * (3 - Math.sqrt(5)) + (tree.position[0] - .5) * .35;
    return { ...tree, position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius], collision: 'none' };
  });
}

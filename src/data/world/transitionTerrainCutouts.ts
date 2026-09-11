import type { WorldVec3 } from '../../domain/world/WorldPlacement';
import type { TransitionWorldLayout, WorldTerrainCutout, WorldScatterPlacement } from './WorldLayout';
import { WORLD_PROP_CATALOG, type WorldPropDefinition } from './WorldPropCatalog';

/** Lower overlapping area aprons under the transition's water and landings. */
export function transitionTerrainCutouts(transition: TransitionWorldLayout, areaOrigin: WorldVec3): WorldTerrainCutout[] {
  const dx = transition.origin[0] - areaOrigin[0];
  const dz = transition.origin[2] - areaOrigin[2];
  const cutouts: WorldTerrainCutout[] = (transition.surfaces ?? []).filter((surface) => surface.kind === 'water').map((surface) => ({
    name: `${surface.name}_Riverbed`, center: [dx + surface.center[0], dz + surface.center[1]],
    size: { width: surface.size.width, depth: surface.size.depth + 1 }, rotation: surface.rotation, elevation: (surface.elevation ?? 0.05) - 0.2,
  }));
  for (const placement of transition.props) {
    const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
    if (!definition.walkSurface) continue;
    const { width, profile } = definition.walkSurface;
    const scale = placement.scale ?? 1;
    const centerZ = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const rotation = placement.rotation ?? 0;
    cutouts.push({
      name: `${placement.name}_Landings`,
      center: [dx + placement.position[0] + Math.sin(rotation) * centerZ * scale, dz + placement.position[2] + Math.cos(rotation) * centerZ * scale],
      size: { width: (width + 2) * scale, depth: (profile[profile.length - 1][0] - profile[0][0] + 4) * scale },
      rotation, elevation: placement.position[1],
    });
  }
  return cutouts;
}

export function clearTransitionApproaches(scatters: readonly WorldScatterPlacement[], transition: TransitionWorldLayout, areaOrigin: WorldVec3): WorldScatterPlacement[] {
  const exclusions = transition.props.flatMap((placement) => {
    const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
    if (!definition.walkSurface) return [];
    const { profile, width } = definition.walkSurface;
    return [{
      center: [transition.origin[0] + placement.position[0] - areaOrigin[0], transition.origin[2] + placement.position[2] - areaOrigin[2]] as const,
      radius: (Math.max(...profile.map(([z]) => Math.abs(z))) + width) * (placement.scale ?? 1),
    }];
  });
  return scatters.map((scatter) => ({ ...scatter, exclusions: [...(scatter.exclusions ?? []), ...exclusions] }));
}

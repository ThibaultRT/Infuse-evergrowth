import type { AnyWorldLayout } from '../../data/world/WorldLayout';
import { WORLD_PROP_CATALOG, type WorldPropDefinition } from '../../data/world/WorldPropCatalog';
import { composeWorldTransform } from './WorldPlacement';
import type { PlacedWorldWalkSurface } from './WorldWalkSurface';

export function compileWorldWalkSurfaces(layouts: readonly AnyWorldLayout[]): Readonly<Record<number, readonly PlacedWorldWalkSurface[]>> {
  const byAreaId: Record<number, PlacedWorldWalkSurface[]> = {};
  for (const layout of layouts) {
    const surfaces = layout.props.flatMap((placement): PlacedWorldWalkSurface[] => {
      const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
      return definition.walkSurface ? [{ ...definition.walkSurface, transform: composeWorldTransform({ position: layout.origin }, placement) }] : [];
    });
    for (const id of layout.kind === 'area' ? [layout.areaId] : layout.areaIds) (byAreaId[id] ??= []).push(...surfaces);
  }
  return byAreaId;
}

import { WORLD_ASSET_DEFINITIONS } from './WorldAssetKeys';
import { WORLD_PROP_CATALOG, type WorldPropDefinition } from './WorldPropCatalog';
import { expandWorldScatter, type AnyWorldLayout } from './WorldLayout';

export type WorldValidationIssue = { readonly severity: 'error' | 'warning'; readonly message: string };

export function validateWorldLayouts(layouts: readonly AnyWorldLayout[]): WorldValidationIssue[] {
  const issues: WorldValidationIssue[] = [];
  const chunkIds = new Set<string>();
  const placementNames = new Set<string>();
  for (const layout of layouts) {
    if (chunkIds.has(layout.id)) issues.push({ severity: 'error', message: `Duplicate chunk id: ${layout.id}` });
    chunkIds.add(layout.id);
    if (layout.visualSize.width <= 0 || layout.visualSize.depth <= 0) issues.push({ severity: 'error', message: `${layout.id} has invalid visual dimensions.` });
    if (layout.kind === 'area' && (layout.playableSize.width <= 0 || layout.playableSize.depth <= 0)) issues.push({ severity: 'error', message: `${layout.id} has invalid playable dimensions.` });
    for (const cutout of layout.terrainCutouts ?? []) {
      if (cutout.size.width <= 0 || cutout.size.depth <= 0) issues.push({ severity: 'error', message: `${layout.id}/${cutout.name} has invalid terrain-cutout dimensions.` });
    }
    const placements = [...layout.props, ...layout.scatters.flatMap(expandWorldScatter)];
    for (const placement of placements) {
      const qualified = `${layout.id}/${placement.name}`;
      if (placementNames.has(qualified)) issues.push({ severity: 'error', message: `Duplicate placement name: ${qualified}` });
      placementNames.add(qualified);
      const definition: WorldPropDefinition = WORLD_PROP_CATALOG[placement.prop];
      if (!definition) { issues.push({ severity: 'error', message: `${qualified} uses unknown prop ${placement.prop}.` }); continue; }
      if (!WORLD_ASSET_DEFINITIONS[definition.asset]) issues.push({ severity: 'error', message: `${qualified} uses unresolvable asset ${definition.asset}.` });
      if ((placement.scale ?? 1) <= 0) issues.push({ severity: 'error', message: `${qualified} has a non-positive scale.` });
      if (definition.walkSurface) {
        const { width, profile } = definition.walkSurface;
        if (!(width > 0) || !Number.isFinite(width) || profile.length < 2 || profile.some(([z, y], index) => !Number.isFinite(z) || !Number.isFinite(y) || (index > 0 && z <= profile[index - 1][0]))) {
          issues.push({ severity: 'error', message: `${qualified} has an invalid walkable floor profile.` });
        }
      }
    }
    for (const volume of layout.collision) {
      const valid = volume.kind === 'circle' ? volume.radius > 0 : volume.width > 0 && volume.depth > 0;
      if (!valid) issues.push({ severity: 'error', message: `${layout.id}/${volume.id} has invalid collision dimensions.` });
    }
    for (const scatter of layout.scatters) {
      if (scatter.collision === 'prop-default' && scatter.count > 32) issues.push({ severity: 'warning', message: `${layout.id}/${scatter.prefix} creates ${scatter.count} scatter colliders.` });
    }
  }
  return issues;
}

export function assertValidWorldLayouts(layouts: readonly AnyWorldLayout[]): void {
  const errors = validateWorldLayouts(layouts).filter((issue) => issue.severity === 'error');
  if (errors.length > 0) throw new Error(`Invalid world layouts:\n${errors.map((issue) => issue.message).join('\n')}`);
}

import { WORLD_ASSET_DEFINITIONS } from './WorldAssetKeys';
import { WORLD_PROP_CATALOG, worldPropAssetKeys, type WorldPropDefinition } from './WorldPropCatalog';
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
    const terrainRegionNames = new Set<string>();
    for (const region of layout.terrainRegions ?? []) {
      if (terrainRegionNames.has(region.name)) issues.push({ severity: 'error', message: `${layout.id} has duplicate terrain region ${region.name}.` });
      terrainRegionNames.add(region.name);
      if (region.size.width <= 0 || region.size.depth <= 0) issues.push({ severity: 'error', message: `${layout.id}/${region.name} has invalid terrain-region dimensions.` });
      const profile = region.terrain ?? layout.terrain;
      if (region.layer === 'underlay' && !['meadow', 'forest', 'cobble'].includes(profile)) {
        issues.push({ severity: 'error', message: `${layout.id}/${region.name} uses unsupported ${profile} underlay terrain.` });
      }
      const insideVisualBounds = Math.abs(region.center[0]) + region.size.width / 2 <= layout.visualSize.width / 2 + 1e-6
        && Math.abs(region.center[1]) + region.size.depth / 2 <= layout.visualSize.depth / 2 + 1e-6;
      if (!insideVisualBounds) issues.push({ severity: 'error', message: `${layout.id}/${region.name} exceeds the chunk's visual bounds.` });
    }
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
      try {
        for (const asset of worldPropAssetKeys(placement.prop)) if (!WORLD_ASSET_DEFINITIONS[asset]) issues.push({ severity: 'error', message: `${qualified} uses unresolvable asset ${asset}.` });
      } catch (error) {
        issues.push({ severity: 'error', message: `${qualified}: ${error instanceof Error ? error.message : String(error)}` });
      }
      for (const part of definition.blockout ?? []) {
        if (part.size.some((size) => !Number.isFinite(size) || size <= 0)) issues.push({ severity: 'error', message: `${qualified} has invalid blockout dimensions.` });
      }
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
      if (scatter.minSpacing !== undefined && (!Number.isFinite(scatter.minSpacing) || scatter.minSpacing < 0)) issues.push({ severity: 'error', message: `${layout.id}/${scatter.prefix} has invalid minimum spacing.` });
      if (scatter.collision === 'prop-default' && scatter.count > 32) issues.push({ severity: 'warning', message: `${layout.id}/${scatter.prefix} creates ${scatter.count} scatter colliders.` });
    }
  }
  return issues;
}

export function assertValidWorldLayouts(layouts: readonly AnyWorldLayout[]): void {
  const errors = validateWorldLayouts(layouts).filter((issue) => issue.severity === 'error');
  if (errors.length > 0) throw new Error(`Invalid world layouts:\n${errors.map((issue) => issue.message).join('\n')}`);
}

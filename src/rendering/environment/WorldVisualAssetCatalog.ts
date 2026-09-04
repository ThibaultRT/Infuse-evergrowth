import { WORLD_ASSET_DEFINITIONS, type WorldAssetDefinition, type WorldAssetKey } from '../../data/world/WorldAssetKeys';

export type ResolvedWorldAsset = WorldAssetDefinition & { readonly key: WorldAssetKey; readonly url: string };

export interface WorldAssetResolver {
  resolve(key: WorldAssetKey): ResolvedWorldAsset;
}

export class ProductionWorldAssetResolver implements WorldAssetResolver {
  resolve(key: WorldAssetKey): ResolvedWorldAsset {
    const definition = WORLD_ASSET_DEFINITIONS[key];
    return { ...definition, key, url: `${import.meta.env.BASE_URL}${definition.runtime}` };
  }
}

export class DevelopmentWorldAssetResolver implements WorldAssetResolver {
  resolve(key: WorldAssetKey): ResolvedWorldAsset {
    const definition = WORLD_ASSET_DEFINITIONS[key];
    return { ...definition, key, url: `/@world-development/${definition.source}` };
  }
}

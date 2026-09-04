import assetDefinitions from './world-assets.json';

export type WorldAssetKey = keyof typeof assetDefinitions;
export type WorldAssetDefinition = {
  readonly kind: 'model' | 'texture';
  readonly source: string;
  readonly runtime: string;
  readonly baseScale?: number;
  readonly castShadow?: boolean;
};

export const WORLD_ASSET_DEFINITIONS = assetDefinitions as Record<WorldAssetKey, WorldAssetDefinition>;

export function worldAssetKeys(): WorldAssetKey[] {
  return Object.keys(WORLD_ASSET_DEFINITIONS) as WorldAssetKey[];
}

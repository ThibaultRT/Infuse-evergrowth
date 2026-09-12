/** Public asset folders are lazy; Vite's hashed bundles/icons at assets/ stay precached. */
export function isRuntimeAsset(path: string): boolean { return /^assets\/[^/]+\//.test(path); }

export const ASSET_CACHE_PREFIX = 'infuse-assets-v2-';
export const ASSET_REVISION_PARAM = '__infuse_revision';

export function assetRevisionKey(url: string, revision: string): string {
  const key = new URL(url);
  key.search = '';
  key.hash = '';
  key.searchParams.set(ASSET_REVISION_PARAM, revision);
  return key.href;
}

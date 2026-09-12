/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { ASSET_CACHE_PREFIX, assetRevisionKey, isRuntimeAsset } from './pwa/assetPolicy';

declare const self: ServiceWorkerGlobalScope;

// Workbox hashes every shipped file, including GLTF sidecars and embedded-model GLBs.
// Only the shell is downloaded at install. Asset bytes are cached as play requests them.
const manifest = self.__WB_MANIFEST.map((entry): PrecacheEntry => typeof entry === 'string' ? { url: entry, revision: null } : entry);
const scope = self.registration.scope;
const assetCacheName = `${ASSET_CACHE_PREFIX}${scope}`;
const assetKeys = new Map(manifest.filter(({ url }) => isRuntimeAsset(url)).map(({ url, revision }) => {
  if (!revision) throw new Error(`Missing offline asset revision: ${url}`);
  const absolute = new URL(url, scope).href;
  return [absolute, assetRevisionKey(absolute, revision)];
}));

precacheAndRoute(manifest.filter(({ url }) => !isRuntimeAsset(url)));
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  allowlist: [new RegExp(`^${new URL(scope).pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:index\\.html)?$`)],
}));

registerRoute(({ url }) => url.origin === self.location.origin && assetKeys.has(`${url.origin}${url.pathname}`), async ({ request, url, event }) => {
  const key = assetKeys.get(`${url.origin}${url.pathname}`)!;
  // Storage denial/quota must never prevent an otherwise successful network load.
  let cache: Cache | undefined;
  try {
    cache = await caches.open(assetCacheName);
    const cached = await cache.match(key);
    if (cached) return cached;
  } catch (error) { console.warn('Offline asset storage is unavailable.', error); }
  // Revision in both cache and network URL avoids stale HTTP/CDN cache entries.
  const response = await fetch(new Request(key, request), { cache: 'reload' });
  if (cache && response.status === 200 && !response.headers.get('content-type')?.includes('text/html')) {
    event.waitUntil(cache.put(key, response.clone()).catch((error: unknown) => console.warn('Could not retain an asset for offline play.', error)));
  }
  return response;
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const validKeys = new Set(assetKeys.values()), cache = await caches.open(assetCacheName);
      await Promise.all((await cache.keys()).filter((request) => !validKeys.has(request.url)).map((request) => cache.delete(request)));
      // Retire only this app's entries in the old, unscoped mutable caches.
      for (const name of ['quaternius-assets-v1', 'world-assets-v1']) {
        if (!(await caches.keys()).includes(name)) continue;
        const legacy = await caches.open(name);
        await Promise.all((await legacy.keys()).filter((request) => request.url.startsWith(scope)).map((request) => legacy.delete(request)));
        if (!(await legacy.keys()).length) await caches.delete(name);
      }
    } catch (error) { console.warn('Offline cache cleanup could not finish.', error); }
  })());
});
void self.skipWaiting();
clientsClaim();

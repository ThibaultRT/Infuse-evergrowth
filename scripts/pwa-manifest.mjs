/** Workbox injects this JSON array after minifying the worker. Fail closed if its format changes. */
export function readWorkerManifest(source) {
  const json = source.match(/\[\{"revision":.*?\}\]/s)?.[0];
  if (!json) throw new Error('Missing injected service-worker revision manifest.');
  const entries = JSON.parse(json);
  if (!entries.some(({ url }) => url === 'index.html')) throw new Error('Offline manifest is missing the app shell.');
  return { entries, json };
}

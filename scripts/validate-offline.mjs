import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readWorkerManifest } from './pwa-manifest.mjs';
import { availableDebugPort, closeBrowser } from './world-authoring/browser-lifecycle.mjs';

// Test the built worker and game. Alternate releases are HTTP overlays; dist and saves
// in the user's browser are never edited. Uses the existing Chromium/CDP smoke approach.
const root = process.cwd(), dist = path.join(root, 'dist'), base = '/Infuse-evergrowth/';
const source = await readFile(path.join(dist, 'sw.js'), 'utf8');
const { entries, json } = readWorkerManifest(source);
const publicEntries = entries.filter(({ url }) => /^assets\/[^/]+\//.test(url));
const probe = 'assets/models/offline-probe.gltf', retired = 'assets/world/offline-retired.bin', rejected = 'assets/kaykit/offline-rejected.bin';
const digest = (body) => createHash('md5').update(body).digest('hex');
let release = 1, offline = false, rejectAsset = true;
const probeBody = () => JSON.stringify({ asset: { version: '2.0' }, extras: { release } });
const fixtures = () => [
  { url: probe, revision: digest(probeBody()) },
  { url: rejected, revision: digest('valid asset') },
  ...(release === 1 ? [{ url: retired, revision: digest('retired asset') }] : []),
];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  if (offline) { request.socket.destroy(); return; }
  const url = new URL(request.url, 'http://localhost');
  const name = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
  if (!url.pathname.startsWith(base) || name.split('/').includes('..')) { response.writeHead(404).end(); return; }
  try {
    // Deliberate version-check failure proves registration and caching are independent.
    if (name === 'version.json') { response.writeHead(503).end(); return; }
    let body;
    if (name === 'sw.js') body = source.replace(json, JSON.stringify([...entries, ...fixtures()]));
    else if (name === probe) body = probeBody();
    else if (name === retired && release === 1) body = 'retired asset';
    else if (name === rejected) {
      if (rejectAsset) { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>hosting error</html>'); return; }
      body = 'valid asset';
    } else body = await readFile(path.join(dist, name));
    // Long-lived HTTP headers deliberately exercise content-revision cache busting.
    response.writeHead(200, { 'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream', 'Cache-Control': name === 'sw.js' ? 'no-store' : 'public, max-age=31536000' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const gameUrl = `http://127.0.0.1:${server.address().port}${base}`;
const cacheName = `infuse-assets-v2-${gameUrl}`;
const browserExecutable = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
if (!browserExecutable) throw new Error('Edge or Chrome is required for the offline smoke test.');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'infuse-offline-smoke-'));
const captures = path.join(root, 'authoring/generated/captures');
await mkdir(captures, { recursive: true });
let browserProcess, client, socket;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class CdpClient {
  nextId = 1; pending = new Map(); errors = []; loads = 0;
  constructor(socket) {
    this.socket = socket;
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data), pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === 'Page.loadEventFired') this.loads++;
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 60000);
      timer.unref(); this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}
async function evaluate(expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}
async function until(expression, label, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return; }
    catch (error) { if (!/context.*destroyed|Cannot find context|target navigated/i.test(String(error))) throw error; }
    await wait(200);
  }
  throw new Error(`Timed out: ${label}`);
}
const ready = `document.querySelector('#canvas-host canvas') && !document.getElementById('loading-screen') && localStorage.getItem('infuse-evergrowth-save-v18')`;
async function reload() {
  const loads = client.loads;
  // A DevTools hard reload bypasses service workers; exercise an ordinary PWA reload.
  await client.send('Page.reload');
  for (let i = 0; i < 200 && client.loads === loads; i++) await wait(100);
  assert.ok(client.loads > loads, 'Reloaded document did not load');
  await until(ready, 'game ready after reload');
  await until('Boolean(navigator.serviceWorker.controller)', 'worker control after reload');
}
async function capture(file) {
  await wait(400); // Let panel opacity/transform transitions finish before visual QA.
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(captures, file), Buffer.from(shot.data, 'base64'));
}
const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fetchText = (file) => evaluate(`fetch(${JSON.stringify(gameUrl + file)}).then((response) => response.text())`);
const cacheKeys = () => evaluate(`caches.open(${JSON.stringify(cacheName)}).then(cache => cache.keys()).then(keys => keys.map(key => key.url))`);

try {
  const debugPort = await availableDebugPort();
  browserProcess = spawn(browserExecutable, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temporaryRoot, 'browser-profile')}`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--disable-background-networking', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let browserReady = false;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) { browserReady = true; break; } } catch {} await wait(200); }
  assert.ok(browserReady, 'Chromium did not start');
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  client = new CdpClient(socket);
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await client.send('Page.navigate', { url: gameUrl });
  await until(ready, 'first online boot');
  await until('Boolean(navigator.serviceWorker.controller)', 'first-visit worker control despite failed version check');
  await until(`caches.open(${JSON.stringify(cacheName)}).then(cache => cache.keys()).then(keys => keys.some(key => key.url.includes('Male_Ranger.bin')))`, 'boot model dependency cached');
  assert.ok((await cacheKeys()).length < publicEntries.length, 'First visit must not download every public asset');
  console.log('Passed: first-visit caching with unavailable version endpoint; staged asset loading.');

  await evaluate(`(() => {
    const key = 'infuse-evergrowth-save-v18', state = JSON.parse(localStorage.getItem(key));
    state.unlockedAreas = [1, 2, 3]; state.defeatedBosses = ['area2-rare-01'];
    state.heroHp = 10000; state.stats.maxHp.base = 10000;
    state.inventory.items['sword-common'] = { itemId: 'sword-common', level: 101, ascend: 0 };
    state.soulCatcher.balances.common = 1000000; state.soulCatcher.xp = 84291;
    localStorage.setItem(key, JSON.stringify(state));
  })()`);
  await reload();
  await click('#inventory-button');
  await click('#inventory-bag [data-item-id="sword-common"]');
  await click('#inventory-detail [data-ascend]');
  await until(`document.getElementById('inventory-detail').textContent.includes('Level 2 · Ascend 1')`, 'live Ascend detail');
  await capture('progression-snapshot-ascend.png');
  await click('#inventory-detail [data-equip]');
  await click('#inventory-detail [data-equip-slot="orbit1"]');
  await click('#stats-button');
  await until(`document.getElementById('stats-content').textContent.includes('Orbit 1 · Slash attack')`, 'slot-specific Stats');
  await capture('progression-snapshot-stats.png');
  await click('#soul-catcher-button');
  await click('#soul-nodes [data-soul-node]:not([data-soul-node=""])');
  await click('#soul-detail [data-purchase-soul]');
  await until(`!document.querySelector('[data-soul-layer="2"]').disabled`, 'live Soul layer unlock');
  await capture('progression-snapshot-souls.png');
  await click('#soul-catcher-close');
  console.log('Passed: mobile inventory/Ascend/equip, per-slot Stats, Soul purchase and live layer unlock.');

  assert.match(await fetchText(rejected), /hosting error/);
  assert.ok(!(await cacheKeys()).some((key) => key.includes(rejected)), 'HTML error must not poison asset cache');
  rejectAsset = false;
  assert.equal(await fetchText(rejected), 'valid asset');
  assert.equal(JSON.parse(await fetchText(probe)).extras.release, 1);
  assert.equal(await fetchText(retired), 'retired asset');
  // Exercise every shipped extension/folder, GLTF sidecar, model, and texture.
  for (let i = 0; i < publicEntries.length; i += 8) {
    const urls = publicEntries.slice(i, i + 8).map(({ url }) => gameUrl + url);
    const ok = await evaluate(`Promise.all(${JSON.stringify(urls)}.map(async url => { const response = await fetch(url); await response.arrayBuffer(); return response.ok; }))`);
    assert.ok(ok.every(Boolean), 'A shipped asset failed to load');
  }
  await until(`caches.open(${JSON.stringify(cacheName)}).then(cache => cache.keys()).then(keys => keys.length === ${publicEntries.length + 3})`, 'all asset cache writes complete').catch(async (error) => {
    const keys = await cacheKeys();
    console.error({ expected: publicEntries.length + 3, cached: keys.length, missing: [...publicEntries, ...fixtures()].filter(({ url }) => !keys.some((key) => new URL(key).pathname === base + url)).map(({ url }) => url) });
    throw error;
  });
  offline = true;
  await client.send('Network.clearBrowserCache'); // Offline success must come from Cache Storage.
  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload();
  for (let i = 0; i < publicEntries.length; i += 8) {
    const urls = publicEntries.slice(i, i + 8).map(({ url }) => gameUrl + url);
    const ok = await evaluate(`Promise.all(${JSON.stringify(urls)}.map(async url => { const response = await fetch(url); return response.ok && (await response.arrayBuffer()).byteLength > 0; }))`);
    assert.ok(ok.every(Boolean), 'A warmed asset was unavailable offline');
  }
  await capture('progression-offline-world.png');
  console.log(`Passed: offline production reload and retrieval of all ${publicEntries.length} warmed public assets.`);

  offline = false;
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const unchanged = (await cacheKeys()).filter((key) => !key.includes('offline-'));
  await evaluate(`(async () => {
    const legacy = await caches.open('world-assets-v1');
    await legacy.put(${JSON.stringify(gameUrl + 'assets/world/stale.glb')}, new Response('stale'));
    await legacy.put(location.origin + '/unrelated/assets/keep.glb', new Response('other app'));
    const other = await caches.open('unrelated-app-cache'); await other.put(location.origin + '/keep', new Response('keep'));
  })()`);
  release = 2;
  await evaluate(`(async () => {
    const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    await (await navigator.serviceWorker.getRegistration()).update(); await changed;
  })()`);
  await until(`caches.open(${JSON.stringify(cacheName)}).then(cache => cache.keys()).then(keys => !keys.some(key => key.url.includes(${JSON.stringify(retired)})))`, 'obsolete asset cleanup');
  const afterUpdate = await cacheKeys();
  for (const key of unchanged) assert.ok(afterUpdate.includes(key), `Unchanged asset was discarded: ${key}`);
  assert.ok(!afterUpdate.some((key) => key.includes(probe)), 'Changed bytes must not inherit the old revision');
  const legacyKeys = await evaluate(`caches.open('world-assets-v1').then(cache => cache.keys()).then(keys => keys.map(key => key.url))`);
  assert.equal(legacyKeys.length, 1); assert.ok(legacyKeys[0].includes('/unrelated/'));
  assert.ok((await evaluate('caches.keys()')).includes('unrelated-app-cache'));
  offline = true;
  assert.equal(await evaluate(`fetch(${JSON.stringify(gameUrl + probe)}).then(() => false, () => true)`), true, 'Never serve the previous revision as the updated asset');
  offline = false;
  assert.equal(JSON.parse(await fetchText(probe)).extras.release, 2, 'Updated URL must bypass stale HTTP caching');
  assert.ok((await cacheKeys()).some((key) => key.includes(digest(probeBody()))));
  assert.deepEqual(client.errors, []);
  console.log('Passed: changed-asset refresh, unchanged-asset reuse, obsolete/legacy cleanup, no stale offline fallback, and unrelated-cache isolation.');
} finally {
  await closeBrowser(client, socket, browserProcess);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  // Keep this isolated temporary profile as local debugging evidence; never touch user profiles.
  console.log(`Offline smoke profile: ${temporaryRoot}`);
}

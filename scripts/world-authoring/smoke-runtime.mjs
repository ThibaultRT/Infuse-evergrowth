import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { availableDebugPort, closeBrowser } from './browser-lifecycle.mjs';

const repositoryRoot = process.cwd();
const woodlandBridge = process.argv.includes('--woodland-bridge');
const greenhaven = process.argv.includes('--greenhaven');
const greenhavenShore = process.argv.includes('--greenhaven-shore');
const highwood = process.argv.includes('--highwood');
const fallenKeep = process.argv.includes('--fallen-keep');
const area4 = process.argv.includes('--area4');
const port = 4173;
const gameUrl = `http://127.0.0.1:${port}/Infuse-evergrowth/`;
const outputRoot = path.join(repositoryRoot, 'authoring', 'generated', 'captures');
const browserExecutable = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!browserExecutable) throw new Error('A local Chromium browser (Edge or Chrome) is required for runtime smoke testing.');

await mkdir(outputRoot, { recursive: true });
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'infuse-runtime-smoke-'));
const viteProcess = spawn(process.execPath, [path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: repositoryRoot, stdio: 'ignore', windowsHide: true });
let browserProcess;
let socket;
let client;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  nextId = 1;
  pending = new Map();
  errors = [];
  pageLoads = 0;

  constructor(webSocket) {
    this.socket = webSocket;
    webSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
      if (message.method === 'Page.loadEventFired') this.pageLoads++;
      if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') this.errors.push(message.params.entry.text);
    });
    webSocket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Smoke browser connection closed.'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for smoke browser command: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception?.description;
    throw new Error(exception ?? result.exceptionDetails.text ?? 'Browser evaluation failed.');
  }
  return result.result?.value;
}

async function waitFor(client, expression, description, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, expression)) return;
    } catch (error) {
      // Readiness polling can straddle an initial navigation. Never retry writes.
      if (!/context.*destroyed|Inspected target navigated|Cannot find context/i.test(String(error))) throw error;
    }
    await wait(250);
  }
  const rendererStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent ?? 'renderer statistics unavailable'");
  throw new Error(`Timed out waiting for ${description}.\n${rendererStats}`);
}

async function reloadPage(client) {
  const previousLoads = client.pageLoads;
  await client.send('Page.reload');
  const deadline = Date.now() + 90000;
  while (client.pageLoads === previousLoads) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the reloaded document.');
    await wait(100);
  }
}

async function holdKey(client, code, key, milliseconds) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
  await wait(milliseconds);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
  await wait(250);
}

async function capture(client, file) {
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(outputRoot, file), Buffer.from(screenshot.data, 'base64'));
  if (fallenKeep || area4) console.log(`Captured ${file}`);
}

async function waitForArea(client, areaId) {
  await waitFor(client, `document.getElementById('renderer-stats')?.textContent.includes('area ${areaId}')`, `Area ${areaId} entry`, 20000);
  await waitFor(client, `document.getElementById('renderer-stats')?.textContent.includes('loading none')`, `Area ${areaId} visual residency`, 30000);
}

async function heroPosition(client) {
  await wait(600);
  const stats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent");
  const match = /area (\d+) · hero (-?[\d.]+), (-?[\d.]+)/.exec(stats ?? '');
  if (!match) throw new Error(`Missing hero diagnostics: ${stats}`);
  return { area: Number(match[1]), x: Number(match[2]), z: Number(match[3]) };
}

async function moveAxis(client, axis, destination) {
  for (let attempt = 0; attempt < 35; attempt++) {
    const position = await heroPosition(client);
    const delta = destination - position[axis];
    // Diagnostics round to 0.1 m; allow that rounding around the minimum key tap.
    if (Math.abs(delta) <= 0.25) return;
    const key = axis === 'x' ? delta > 0 ? 'ArrowRight' : 'ArrowLeft' : delta > 0 ? 'ArrowDown' : 'ArrowUp';
    await holdKey(client, key, key, Math.max(35, Math.min(800, Math.abs(delta) / 7.6 * 1000)));
  }
  throw new Error(`Could not walk to ${axis}=${destination}: ${JSON.stringify(await heroPosition(client))}`);
}

async function walkTo(client, x, z) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const position = await heroPosition(client);
    const dx = x - position.x, dz = z - position.z;
    if (Math.hypot(dx, dz) < 0.35) return;
    const keys = [
      ...(Math.abs(dx) > 0.2 ? [dx > 0 ? 'ArrowRight' : 'ArrowLeft'] : []),
      ...(Math.abs(dz) > 0.2 ? [dz > 0 ? 'ArrowDown' : 'ArrowUp'] : []),
    ];
    const distance = Math.min(...[Math.abs(dx), Math.abs(dz)].filter((value) => value > 0.2));
    const duration = Math.min(320, Math.max(40, distance * Math.sqrt(keys.length) / 7.6 * 1000));
    for (const key of keys) await client.send('Input.dispatchKeyEvent', { type: 'keyDown', code: key, key });
    await wait(duration);
    for (const key of keys) await client.send('Input.dispatchKeyEvent', { type: 'keyUp', code: key, key });
    await wait(100);
  }
  throw new Error(`Could not follow trail to ${x}, ${z}: ${JSON.stringify(await heroPosition(client))}`);
}

async function approachWoodlandBridge(client) {
  await moveAxis(client, 'x', 6);
  await moveAxis(client, 'z', -22);
  await moveAxis(client, 'x', 10.8);
  await moveAxis(client, 'z', -29);
}

const gameReadyExpression = `Boolean(
  document.getElementById('canvas-host')
  && !document.getElementById('loading-screen')
  && localStorage.getItem('infuse-evergrowth-save-v19')
)`;

try {
  await waitForHttp(gameUrl, 30000);
  const debugPort = await availableDebugPort();
  browserProcess = spawn(browserExecutable, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temporaryRoot, 'browser-profile')}`,
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--disable-background-networking', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30000);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(gameUrl)}`, { method: 'PUT' });
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  client = new CdpClient(socket);
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable')]);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(client, gameReadyExpression, 'initial game boot');

  await evaluate(client, `(() => {
    localStorage.setItem('infuse-rendering-quality-v1', JSON.stringify({ renderScale: 1, frameRateLimit: 60, showStats: true }));
    const key = 'infuse-evergrowth-save-v19';
    const save = JSON.parse(localStorage.getItem(key));
    save.unlockedAreas = ${woodlandBridge ? '[1]' : '[1, 2, 3]'};
    save.heroHp = 100000000;
    save.stats.maxHp.base = 100000000;
    localStorage.setItem(key, JSON.stringify(save));
    return true;
  })()`);
  await reloadPage(client);
  await waitFor(client, gameReadyExpression, 'instrumented game boot');
  await waitForArea(client, 1);
  await capture(client, 'runtime-iphone-12-area-a01.png');

  if (area4) {
    await moveAxis(client, 'x', 7.2);
    // Stop before the closed land gate; its plane at Z=27 is not reachable yet.
    await moveAxis(client, 'z', 26);
    await holdKey(client, 'ArrowDown', 'ArrowDown', 900);
    const locked = await heroPosition(client);
    if (locked.area !== 1 || locked.z >= 30) throw new Error('Area 4 opened before the boss unlock.');
    await capture(client, 'runtime-iphone-12-area4-locked.png');
    // Simulate a returning save whose boss victory predates the new routes.
    await evaluate(client, `(() => {
      const key = 'infuse-evergrowth-save-v19';
      const saved = JSON.parse(localStorage.getItem(key));
      saved.defeatedBosses.push('area3-epic-01');
      localStorage.setItem(key, JSON.stringify(saved));
    })()`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'existing Area 3 victory normalization');
    await waitForArea(client, 1);
    await moveAxis(client, 'x', 7.2);
    await moveAxis(client, 'z', 27);
    await capture(client, 'runtime-iphone-12-area4-forged-north-landing.png');
    await moveAxis(client, 'z', 33);
    await waitForArea(client, 1);
    await capture(client, 'runtime-iphone-12-area4-forged-north-deck.png');
    await moveAxis(client, 'z', 37);
    await waitForArea(client, 4);
    await capture(client, 'runtime-iphone-12-area4-forged-deck.png');
    await moveAxis(client, 'z', 45);
    await capture(client, 'runtime-iphone-12-area4-forged-south-landing.png');
    await moveAxis(client, 'z', 56);
    await moveAxis(client, 'x', 36);
    await moveAxis(client, 'z', 70);
    await capture(client, 'runtime-iphone-12-area4-throne.png');
    await moveAxis(client, 'z', 60);
    const terrainSpec = JSON.parse(await readFile(path.join(repositoryRoot, 'src/data/world/area4-blockout.json'), 'utf8'));
    const lava = terrainSpec.lavaPools[0];
    const lavaX = terrainSpec.origin[0] + lava.center[0], lavaZ = terrainSpec.origin[2] + lava.center[1];
    await moveAxis(client, 'x', lavaX - lava.radius - 1);
    await moveAxis(client, 'z', lavaZ);
    await holdKey(client, 'ArrowRight', 'ArrowRight', 900);
    const stopped = await heroPosition(client);
    // Diagnostics round X/Z to 0.1 m; retain tolerance around the 0.45 m hero radius.
    if (Math.hypot(stopped.x - lavaX, stopped.z - lavaZ) < lava.radius + .35) throw new Error('The hero entered the lava basin.');
    await capture(client, 'runtime-iphone-12-area4-lava.png');
    await moveAxis(client, 'z', 60);
    await moveAxis(client, 'x', 86);
    await moveAxis(client, 'z', 45);
    await capture(client, 'runtime-iphone-12-area4-timber-south-landing.png');
    await moveAxis(client, 'z', 39);
    await capture(client, 'runtime-iphone-12-area4-timber-deck.png');
    await moveAxis(client, 'z', 33);
    await waitForArea(client, 3);
    await capture(client, 'runtime-iphone-12-area4-timber-north-deck.png');
    await moveAxis(client, 'z', 27);
    await capture(client, 'runtime-iphone-12-area4-keep-south-gate.png');
    await moveAxis(client, 'z', 46);
    await waitForArea(client, 4);
    await moveAxis(client, 'x', 7.2);
    await moveAxis(client, 'z', 26);
    await waitForArea(client, 1);
    await moveAxis(client, 'z', 46);
    await waitForArea(client, 4);
    await evaluate(client, `document.getElementById('settings-button').click(); document.querySelector('input[name="render-scale"][value="0.7"]').click(); document.querySelector('input[name="frame-rate"][value="30"]').click(); document.getElementById('settings-close').click();`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'Area 4 saved Reduced/30 FPS boot');
    await waitForArea(client, 4);
    const quality = await evaluate(client, `JSON.parse(localStorage.getItem('infuse-rendering-quality-v1'))`);
    if (quality.renderScale !== .7 || quality.frameRateLimit !== 30) throw new Error('Area 4 quality settings did not persist.');
    if (await evaluate(client, "document.querySelector('#canvas-host canvas').width") !== 273) throw new Error('Area 4 reduced drawing buffer is incorrect.');
    await moveAxis(client, 'x', 86);
    await moveAxis(client, 'z', 39);
    await capture(client, 'runtime-iphone-12-area4-timber-reduced.png');
    await moveAxis(client, 'z', 26);
    await waitForArea(client, 3);
    await moveAxis(client, 'z', 46);
    await waitForArea(client, 4);
    await moveAxis(client, 'x', 7.2);
    await moveAxis(client, 'z', 26);
    await waitForArea(client, 1);
    await moveAxis(client, 'z', 39);
    await waitForArea(client, 4);
    await capture(client, 'runtime-iphone-12-area4-reduced.png');
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.setBlockedURLs', { urls: ['*assets/world/*'] });
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'Area 4 with world assets unavailable');
    await waitForArea(client, 4);
    const before = await heroPosition(client);
    await holdKey(client, 'ArrowRight', 'ArrowRight', 300);
    if ((await heroPosition(client)).x <= before.x) throw new Error('Area 4 asset-free blockout is not playable.');
    await moveAxis(client, 'x', 7.2);
    await moveAxis(client, 'z', 26);
    await waitForArea(client, 1);
    await moveAxis(client, 'z', 39);
    await waitForArea(client, 4);
    await capture(client, 'runtime-iphone-12-area4-fallback.png');
    client.errors = client.errors.filter((message) => !message.includes('ERR_BLOCKED_BY_CLIENT'));
  } else if (fallenKeep) {
    await moveAxis(client, 'x', 6);
    await moveAxis(client, 'z', 3.6);
    await moveAxis(client, 'x', 48);
    await waitForArea(client, 3);
    await capture(client, 'runtime-iphone-12-keep-west-gate.png');
    await moveAxis(client, 'x', 72);
    await capture(client, 'runtime-iphone-12-keep-ash-court.png');
    await moveAxis(client, 'z', 10);
    await moveAxis(client, 'x', 106.2);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 924, height: 453, deviceScaleFactor: 1, mobile: false });
    await evaluate(client, `document.getElementById('camera-distance').value = '15'; document.getElementById('camera-distance').dispatchEvent(new Event('input', { bubbles: true }));`);
    await wait(700);
    await capture(client, 'runtime-area3-east-wall-15.png');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(client, `document.getElementById('camera-distance').value = '25.2'; document.getElementById('camera-distance').dispatchEvent(new Event('input', { bubbles: true }));`);
    await moveAxis(client, 'x', 72);
    await moveAxis(client, 'z', -21);
    await capture(client, 'runtime-iphone-12-keep-chapel.png');
    await moveAxis(client, 'z', -10);
    await moveAxis(client, 'x', 81.2);
    await moveAxis(client, 'z', -31);
    await moveAxis(client, 'x', 79.2);
    await moveAxis(client, 'z', -42);
    await waitForArea(client, 2);
    await capture(client, 'runtime-iphone-12-keep-north-gate.png');
    await moveAxis(client, 'z', -31);
    await waitForArea(client, 3);
    await moveAxis(client, 'x', 81.2);
    await moveAxis(client, 'z', 24);
    await moveAxis(client, 'x', 72);
    await moveAxis(client, 'z', 22);
    await capture(client, 'runtime-iphone-12-keep-barracks.png');
    await moveAxis(client, 'x', 78.5);
    await moveAxis(client, 'z', 28);
    await moveAxis(client, 'x', 80);
    await holdKey(client, 'ArrowDown', 'ArrowDown', 1300);
    if ((await heroPosition(client)).z > 29.1) throw new Error('The ruined south wall is traversable.');
    await capture(client, 'runtime-iphone-12-keep-south-wall.png');
    await evaluate(client, `document.getElementById('settings-button').click(); document.querySelector('input[name="render-scale"][value="0.7"]').click(); document.querySelector('input[name="frame-rate"][value="30"]').click(); document.getElementById('settings-close').click();`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'saved Reduced/30 FPS keep boot');
    await waitForArea(client, 3);
    const quality = await evaluate(client, `JSON.parse(localStorage.getItem('infuse-rendering-quality-v1'))`);
    if (quality.renderScale !== .7 || quality.frameRateLimit !== 30) throw new Error('Keep rendering preferences did not persist.');
    if (await evaluate(client, "document.querySelector('#canvas-host canvas').width") !== 273) throw new Error('Keep reduced drawing buffer is incorrect.');
    await capture(client, 'runtime-iphone-12-keep-reduced.png');
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.setBlockedURLs', { urls: ['*fallen-keep-landscape.glb*'] });
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'keep landscape fallback');
    await waitForArea(client, 3);
    const before = await heroPosition(client);
    await holdKey(client, 'ArrowRight', 'ArrowRight', 300);
    if ((await heroPosition(client)).x <= before.x) throw new Error('Keep fallback is not playable.');
    await capture(client, 'runtime-iphone-12-keep-fallback.png');
    client.errors = client.errors.filter((message) => !message.includes('ERR_BLOCKED_BY_CLIENT'));
  } else if (highwood) {
    await approachWoodlandBridge(client);
    await moveAxis(client, 'z', -45.2);
    await waitForArea(client, 2);
    await capture(client, 'runtime-iphone-12-highwood-arrival.png');
    // Exercise the authored trail with real keyboard input, including its bends.
    for (const [x, z] of [[10.8, -49], [6, -55], [12, -62], [21, -65], [30, -63], [42, -65], [53, -62], [63, -57], [68, -51], [76, -48], [79.2, -42]]) {
      await walkTo(client, x, z);
      if (x === 21) await capture(client, 'runtime-iphone-12-highwood-full.png');
    }
    await capture(client, 'runtime-iphone-12-highwood-keep-approach.png');
    await moveAxis(client, 'z', -30);
    await waitForArea(client, 3);
    await moveAxis(client, 'z', -42);
    await waitForArea(client, 2);
    await evaluate(client, `document.getElementById('settings-button').click(); document.querySelector('input[name="render-scale"][value="0.7"]').click(); document.querySelector('input[name="frame-rate"][value="30"]').click(); document.getElementById('settings-close').click();`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'saved Reduced/30 FPS boot');
    await waitForArea(client, 2);
    const quality = await evaluate(client, `JSON.parse(localStorage.getItem('infuse-rendering-quality-v1'))`);
    if (quality.renderScale !== 0.7 || quality.frameRateLimit !== 30) throw new Error('Rendering preferences did not persist.');
    // Reload restores the saved current area at its spawn, rather than Area 1.
    await walkTo(client, 36, -64);
    const bufferWidth = await evaluate(client, "document.querySelector('#canvas-host canvas').width");
    if (bufferWidth !== 273) throw new Error(`Reduced rendering buffer is ${bufferWidth}, expected 273.`);
    await capture(client, 'runtime-iphone-12-highwood-reduced.png');
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.setBlockedURLs', { urls: ['*highwood-landscape.glb*'] });
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'Highwood landscape failure fallback boot');
    await waitForArea(client, 2);
    await walkTo(client, 36, -64);
    await capture(client, 'runtime-iphone-12-highwood-fallback.png');
    client.errors = client.errors.filter((message) => message.includes('ERR_BLOCKED_BY_CLIENT') === false);
  } else if (greenhavenShore) {
    const fountainStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent");
    if (!fountainStats?.includes('A01_Fountain_Central')) throw new Error('The fountain hides the initial hero without fading.');
    await moveAxis(client, 'x', -30);
    await moveAxis(client, 'z', -16);
    await holdKey(client, 'ArrowUp', 'ArrowUp', 1600);
    await capture(client, 'runtime-iphone-12-greenhaven-shore.png');
    const shoreStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent");
    if (!shoreStats?.includes('A01_Tree_')) throw new Error('Shore pines hide the hero without fading.');
  } else if (greenhaven) {
    await moveAxis(client, 'x', -6);
    await moveAxis(client, 'z', 16);
    await moveAxis(client, 'x', -23);
    await capture(client, 'runtime-iphone-12-greenhaven-cottages.png');
    await moveAxis(client, 'z', 29);
    await moveAxis(client, 'x', 0);
    await moveAxis(client, 'z', 26);
    await moveAxis(client, 'x', 7.2);
    await moveAxis(client, 'z', 27);
    await holdKey(client, 'ArrowDown', 'ArrowDown', 1200);
    if ((await heroPosition(client)).z > 29.5) throw new Error('The south rift bridge opened before the boss unlock.');
    await capture(client, 'runtime-iphone-12-greenhaven-south.png');
    await moveAxis(client, 'z', 26);
    await moveAxis(client, 'x', 0);
    await moveAxis(client, 'z', 29);
    await moveAxis(client, 'x', -30);
    await moveAxis(client, 'z', -16);
    await holdKey(client, 'ArrowUp', 'ArrowUp', 1600);
    const shore = await heroPosition(client);
    if (Math.hypot(shore.x + 26, shore.z + 35) < 15.4) throw new Error('The northwest lake is traversable.');
    await capture(client, 'runtime-iphone-12-greenhaven-shore.png');
    await moveAxis(client, 'z', -5.5);
    await moveAxis(client, 'x', 0);
    await moveAxis(client, 'z', 0);
    await capture(client, 'runtime-iphone-12-greenhaven-full.png');
    await evaluate(client, `document.getElementById('settings-button').click(); document.querySelector('input[name="render-scale"][value="0.7"]').click(); document.querySelector('input[name="frame-rate"][value="30"]').click(); document.getElementById('settings-close').click();`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'saved Reduced/30 FPS boot');
    await waitForArea(client, 1);
    const quality = await evaluate(client, `JSON.parse(localStorage.getItem('infuse-rendering-quality-v1'))`);
    if (quality.renderScale !== 0.7 || quality.frameRateLimit !== 30) throw new Error('Rendering preferences did not persist.');
    await capture(client, 'runtime-iphone-12-greenhaven-reduced.png');
    const bufferWidth = await evaluate(client, "document.querySelector('#canvas-host canvas').width");
    if (bufferWidth !== 273) throw new Error(`Reduced rendering buffer is ${bufferWidth}, expected 273.`);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.setBlockedURLs', { urls: ['*greenhaven-landscape.glb*'] });
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'landscape failure fallback boot');
    await waitForArea(client, 1);
    await moveAxis(client, 'x', 3);
    await capture(client, 'runtime-iphone-12-greenhaven-fallback.png');
    client.errors = client.errors.filter((message) => message.includes('ERR_BLOCKED_BY_CLIENT') === false);
  } else if (woodlandBridge) {
    await approachWoodlandBridge(client);
    await holdKey(client, 'ArrowUp', 'ArrowUp', 1800);
    const stopped = await heroPosition(client);
    if (stopped.area !== 1 || stopped.z < -30.2) throw new Error(`Closed bridge was traversable: ${JSON.stringify(stopped)}`);
    await capture(client, 'runtime-iphone-12-woodland-closed.png');
    await evaluate(client, `(() => {
      const key = 'infuse-evergrowth-save-v19';
      const save = JSON.parse(localStorage.getItem(key));
      save.unlockedAreas = [1, 2, 3];
      localStorage.setItem(key, JSON.stringify(save));
    })()`);
    await reloadPage(client);
    await waitFor(client, gameReadyExpression, 'unlocked bridge boot');
    await waitForArea(client, 1);
    await approachWoodlandBridge(client);
    await moveAxis(client, 'z', -33);
    await capture(client, 'runtime-iphone-12-woodland-open.png');
    await moveAxis(client, 'z', -37);
    await waitForArea(client, 2);
    await capture(client, 'runtime-iphone-12-woodland-deck.png');
    await moveAxis(client, 'z', -45.2);
    await capture(client, 'runtime-iphone-12-woodland-north-landing.png');
    await moveAxis(client, 'z', -26.8);
    await waitForArea(client, 1);
    await capture(client, 'runtime-iphone-12-woodland-return.png');
  } else {
  await holdKey(client, 'ArrowRight', 'ArrowRight', 1000);
  await holdKey(client, 'ArrowDown', 'ArrowDown', 470);
  await holdKey(client, 'ArrowRight', 'ArrowRight', 5400);
  await waitForArea(client, 3);
  await capture(client, 'runtime-iphone-12-area-a03-west-gate.png');

  await holdKey(client, 'ArrowLeft', 'ArrowLeft', 4700);
  await holdKey(client, 'ArrowUp', 'ArrowUp', 1800);
  await holdKey(client, 'ArrowLeft', 'ArrowLeft', 1000);
  await holdKey(client, 'ArrowUp', 'ArrowUp', 3500);
  await holdKey(client, 'ArrowRight', 'ArrowRight', 1000);
  await holdKey(client, 'ArrowUp', 'ArrowUp', 1600);
  await waitForArea(client, 2);
  await capture(client, 'runtime-iphone-12-area-a02-south-gate.png');
  }

  const rendererStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent");
  if (client.errors.length > 0) throw new Error(`Browser errors:\n${client.errors.join('\n')}`);
  console.log(`Runtime smoke passed: ${area4 ? 'Area 4 locked/unlocked bridges, both directions, existing boss victory, throne, saved Reduced/30 FPS and missing world assets' : fallenKeep ? 'Fallen Keep gates, aligned east wall at distance 15, chapel/barracks interiors, south wall, persisted Reduced/30 FPS, terrain fallback' : highwood ? 'Highwood trail, both crossings, persisted Reduced/30 FPS, missing landscape fallback' : greenhavenShore ? 'fountain and pine occlusion fade' : greenhaven ? 'village loop, closed south gate, impassable lake, Full/Reduced, persisted 30 FPS, missing landscape fallback' : woodlandBridge ? 'woodland bridge closed, open, A01 → A02 → A01' : 'Areas 1 → 3 → 1 → 2'}.\n${rendererStats}`);
} finally {
  await closeBrowser(client, socket, browserProcess, viteProcess);
  await wait(300);
  await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 12, retryDelay: 500 });
}

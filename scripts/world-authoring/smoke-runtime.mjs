import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
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
      if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') this.errors.push(message.params.entry.text);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
    if (await evaluate(client, expression)) return;
    await wait(250);
  }
  const rendererStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent ?? 'renderer statistics unavailable'");
  throw new Error(`Timed out waiting for ${description}.\n${rendererStats}`);
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
}

async function waitForArea(client, areaId) {
  await waitFor(client, `document.getElementById('renderer-stats')?.textContent.includes('area ${areaId}')`, `Area ${areaId} entry`, 20000);
  await waitFor(client, `document.getElementById('renderer-stats')?.textContent.includes('loading none')`, `Area ${areaId} visual residency`, 30000);
}

const gameReadyExpression = `Boolean(
  document.getElementById('canvas-host')
  && !document.getElementById('loading-screen')
  && localStorage.getItem('infuse-evergrowth-save-v18')
)`;

try {
  await waitForHttp(gameUrl, 30000);
  const debugPort = 9336;
  browserProcess = spawn(browserExecutable, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temporaryRoot, 'browser-profile')}`,
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--disable-background-networking', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30000);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(gameUrl)}`, { method: 'PUT' });
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const client = new CdpClient(socket);
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable')]);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(client, gameReadyExpression, 'initial game boot');

  await evaluate(client, `(() => {
    localStorage.setItem('infuse-rendering-quality-v1', JSON.stringify({ renderScale: 1, frameRateLimit: 60, showStats: true }));
    const key = 'infuse-evergrowth-save-v18';
    const save = JSON.parse(localStorage.getItem(key));
    save.unlockedAreas = [1, 2, 3];
    save.heroHp = 100000000;
    save.stats.maxHp.base = 100000000;
    localStorage.setItem(key, JSON.stringify(save));
    return true;
  })()`);
  await client.send('Page.reload');
  await waitFor(client, gameReadyExpression, 'instrumented game boot');
  await waitForArea(client, 1);
  await capture(client, 'runtime-iphone-12-area-a01.png');

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

  const rendererStats = await evaluate(client, "document.getElementById('renderer-stats')?.textContent");
  if (client.errors.length > 0) throw new Error(`Browser errors:\n${client.errors.join('\n')}`);
  console.log(`Runtime smoke passed through Areas 1 → 3 → 1 → 2.\n${rendererStats}`);
} finally {
  socket?.close();
  browserProcess?.kill();
  viteProcess.kill();
  await wait(300);
  await rm(temporaryRoot, { recursive: true, force: true });
}

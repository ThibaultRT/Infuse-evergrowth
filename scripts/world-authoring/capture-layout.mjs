import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const viewerPort = 4174;
const viewerUrl = `http://127.0.0.1:${viewerPort}`;
const capturesRoot = path.join(repositoryRoot, 'authoring', 'generated', 'captures');
const debugRoot = path.join(repositoryRoot, 'authoring', 'generated', 'debug');
const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const browserExecutable = edgeCandidates.find(existsSync);
if (!browserExecutable) throw new Error('A local Chromium browser (Edge or Chrome) is required for authoring captures.');

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'infuse-world-authoring-'));
const downloadRoot = path.join(temporaryRoot, 'downloads');
await Promise.all([mkdir(capturesRoot, { recursive: true }), mkdir(debugRoot, { recursive: true }), mkdir(downloadRoot, { recursive: true })]);

const viteProcess = spawn(process.execPath, [
  path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--config', path.join(repositoryRoot, 'tools', 'world-authoring-viewer', 'vite.config.ts'),
  '--host', '127.0.0.1', '--port', String(viewerPort), '--strictPort',
], { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

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

async function createBrowserTarget(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(viewerUrl)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create browser target: ${response.status}`);
  return response.json();
}

class CdpClient {
  nextId = 1;
  pending = new Map();

  constructor(webSocket) {
    this.socket = webSocket;
    webSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed.');
  return result.result?.value;
}

async function waitForReady(client) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await evaluate(client, 'window.__WORLD_AUTHORING_READY__ === true')) return;
    await wait(250);
  }
  throw new Error('World authoring viewer did not become ready.');
}

async function capture(client, file, preset, width, height) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
  await evaluate(client, `window.__WORLD_AUTHORING_CAMERA__?.(${JSON.stringify(preset)}); document.querySelector('aside').style.display='none';`);
  await wait(700);
  const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(file, Buffer.from(result.data, 'base64'));
}

async function waitForDownload() {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const files = await readdir(downloadRoot);
    const finished = files.find((file) => file.endsWith('.glb'));
    if (finished) return path.join(downloadRoot, finished);
    await wait(500);
  }
  throw new Error('Timed out waiting for assembled debug GLB export.');
}

function inspectDebugGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) throw new Error('Debug export is not a valid glTF 2.0 GLB.');
  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const names = new Set((document.nodes ?? []).map((node) => node.name).filter(Boolean));
  const required = ['area_A01', 'area_A02', 'area_A03', 'transition_A01-A02', 'transition_A01-A03', 'transition_A02-A03', 'A03_Corner_SW'];
  const missing = required.filter((name) => !names.has(name));
  if (missing.length > 0) throw new Error(`Debug GLB is missing stable nodes: ${missing.join(', ')}`);
  if (![...names].some((name) => name.startsWith('COLLIDER_'))) throw new Error('Debug GLB contains no named collision helpers.');
  return { nodes: names.size, colliders: [...names].filter((name) => name.startsWith('COLLIDER_')).length };
}

try {
  await waitForHttp(viewerUrl, 30000);
  const debugPort = 9334;
  browserProcess = spawn(browserExecutable, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temporaryRoot, 'browser-profile')}`,
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--disable-background-networking', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30000);
  const target = await createBrowserTarget(debugPort);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const client = new CdpClient(socket);
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable')]);
  await waitForReady(client);

  await capture(client, path.join(capturesRoot, 'general-layout.png'), 'world', 1440, 900);
  await capture(client, path.join(capturesRoot, 'iphone-12-area-a01.png'), 'area:A01', 390, 844);
  await capture(client, path.join(capturesRoot, 'iphone-12-area-a02.png'), 'area:A02', 390, 844);
  await capture(client, path.join(capturesRoot, 'iphone-12-area-a03.png'), 'area:A03', 390, 844);

  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadRoot, eventsEnabled: true });
  await evaluate(client, "document.querySelector('aside').style.display='block'; document.querySelector('#export').click();");
  const downloaded = await waitForDownload();
  const debugPath = path.join(debugRoot, 'assembled-world-debug.glb');
  await rename(downloaded, debugPath);
  const inspection = inspectDebugGlb(await readFile(debugPath));
  console.log(`Captured four world images and verified debug GLB (${inspection.nodes} named nodes, ${inspection.colliders} collider helpers).`);
} finally {
  socket?.close();
  browserProcess?.kill();
  viteProcess.kill();
  await wait(300);
  await rm(temporaryRoot, { recursive: true, force: true });
}

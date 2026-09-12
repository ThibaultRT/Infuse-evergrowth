import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readWorkerManifest } from './pwa-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const publicRoot = join(root, 'public', 'assets', 'quaternius');
const worldManifestPath = join(root, 'public', 'assets', 'world', 'asset-manifest.json');
const maximumBytes = 500 * 1024 * 1024;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }))).flat();
}

await Promise.all(['index.html', 'manifest.webmanifest', 'sw.js'].map((file) => access(join(dist, file))));
const files = await filesBelow(dist);
const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
const totalBytes = sizes.reduce((total, size) => total + size, 0);
if (totalBytes >= maximumBytes) throw new Error(`Download payload is ${(totalBytes / 1024 / 1024).toFixed(2)} MiB; budget is below 500 MiB.`);

const index = await readFile(join(dist, 'index.html'), 'utf8');
if (!index.includes('/Infuse-evergrowth/')) throw new Error('Built index does not use the GitHub Pages base path.');
const serviceWorker = await readFile(join(dist, 'sw.js'), 'utf8');
if (!serviceWorker.includes('infuse-assets-v2-')) throw new Error('Built service worker does not include the revisioned asset cache.');
const { entries: offlineEntries } = readWorkerManifest(serviceWorker);
const offlineRevisions = new Map(offlineEntries.map(({ url, revision }) => [url, revision]));
if (offlineRevisions.has('version.json')) throw new Error('The live version check must not be cached.');
const publicAssets = await filesBelow(join(root, 'public', 'assets'));
for (const file of publicAssets) {
  const url = relative(join(root, 'public'), file).replaceAll('\\', '/');
  const bytes = await readFile(file), revision = createHash('md5').update(bytes).digest('hex');
  if (offlineRevisions.get(url) !== revision) throw new Error(`Offline revision is missing or stale: ${url}`);
  const model = url.endsWith('.gltf') ? JSON.parse(bytes.toString('utf8'))
    : url.endsWith('.glb') ? JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) : null;
  for (const { uri } of [...model?.buffers ?? [], ...model?.images ?? []]) {
    if (!uri || uri.startsWith('data:')) continue;
    const dependency = new URL(uri, `https://offline.invalid/${url}`);
    if (dependency.origin !== 'https://offline.invalid' || !offlineRevisions.has(decodeURIComponent(dependency.pathname.slice(1)))) {
      throw new Error(`Model dependency is outside offline coverage: ${url} -> ${uri}`);
    }
  }
}

const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json'), 'utf8'));
const declaredFiles = new Set(manifest.assets.flatMap((asset) => [asset.model, ...asset.textures.map((texture) => `${asset.group}/textures/${texture}`)]));
for (const file of declaredFiles) await access(join(publicRoot, file));
const licenseRecords = new Set([...manifest.assets.map((asset) => asset.pack), 'ual1']);
for (const group of licenseRecords) {
  await access(join(publicRoot, 'licenses', `${group}.txt`));
}

const worldManifest = JSON.parse(await readFile(worldManifestPath, 'utf8'));
if (worldManifest.assets.length === 0) throw new Error('Typed-world runtime manifest has no promoted assets.');
for (const asset of worldManifest.assets) await access(join(root, 'public', asset.runtime));
for (const license of worldManifest.licenses ?? []) await access(join(root, 'public', license.file));

console.log(`Release validation passed: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB downloadable payload.`);
console.log(`Verified ${declaredFiles.size} declared models/textures and ${licenseRecords.size} license records.`);
console.log(`Verified ${worldManifest.assets.length} typed-world runtime assets and ${(worldManifest.licenses ?? []).length} license files.`);
console.log(`Verified content revisions and lazy offline coverage for all ${publicAssets.length} public assets, including model sidecars and textures.`);
console.log(`Largest file: ${relative(dist, files[sizes.indexOf(Math.max(...sizes))])} (${(Math.max(...sizes) / 1024 / 1024).toFixed(2)} MiB).`);

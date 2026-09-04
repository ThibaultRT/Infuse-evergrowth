import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
if (!serviceWorker.includes('quaternius-assets-v1')) throw new Error('Built service worker does not include the Quaternius runtime cache.');
if (!serviceWorker.includes('world-assets-v1')) throw new Error('Built service worker does not include the typed-world runtime cache.');

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
console.log(`Largest file: ${relative(dist, files[sizes.indexOf(Math.max(...sizes))])} (${(Math.max(...sizes) / 1024 / 1024).toFixed(2)} MiB).`);

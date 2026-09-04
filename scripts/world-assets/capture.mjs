import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const destinationRoot = path.join(repositoryRoot, 'authoring', 'local', 'world-development');
const sourceArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'another-example';
const auditOnly = process.argv.includes('--audit');
const sourceRoot = path.resolve(repositoryRoot, sourceArgument);

const requiredSourcePaths = [
  'public/assets',
  'README.md',
  'ASSET-LICENSES.md',
  'assets/quaternius/licenses/nature.txt',
  'assets/Stylized Nature MegaKit[Standard]/License_Standard.txt',
  'Layout.png',
  'docs/WORLD-LAYOUT.md',
  'exports/general-layout.png',
  'exports/iphone-preview.png',
  'exports/world-layout.glb',
  'src/game/content/worldLayout.ts',
  'src/game/content/assets.ts',
  'src/game/simulation/terrain.ts',
  'src/render/WorldBuilder.ts',
  'src/render/objects/WorldGeometry.ts',
  'src/render/materials/WorldMaterials.ts',
  'src/render/loaders/AssetLibrary.ts',
  'src/render/FollowCamera.ts',
  'src/render/exportScene.ts',
  'scripts/capture.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
];

const captureMap = [
  ['public/assets', 'source-assets/another-example-public-assets'],
  ['README.md', 'references/README.md'],
  ['ASSET-LICENSES.md', 'provenance/ASSET-LICENSES.md'],
  ['assets/quaternius/licenses', 'provenance/upstream-license-files/quaternius'],
  ['assets/Stylized Nature MegaKit[Standard]/License_Standard.txt', 'provenance/upstream-license-files/stylized-nature-standard.txt'],
  ['Layout.png', 'references/Layout.png'],
  ['docs/WORLD-LAYOUT.md', 'references/WORLD-LAYOUT.md'],
  ['exports/general-layout.png', 'references/general-layout.png'],
  ['exports/iphone-preview.png', 'references/iphone-preview.png'],
  ['exports/world-layout.glb', 'references/world-layout.glb'],
  ['src/game/content', 'references/prototype-source/src/game/content'],
  ['src/game/simulation/terrain.ts', 'references/prototype-source/src/game/simulation/terrain.ts'],
  ['src/render', 'references/prototype-source/src/render'],
  ['scripts', 'references/prototype-source/scripts'],
  ['package.json', 'references/prototype-source/package.json'],
  ['package-lock.json', 'references/prototype-source/package-lock.json'],
  ['tsconfig.json', 'references/prototype-source/tsconfig.json'],
  ['vite.config.ts', 'references/prototype-source/vite.config.ts'],
];

const toPosix = (value) => value.split(path.sep).join('/');

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(toPosix(path.relative(root, absolute)));
  }
  return files;
}

async function digest(file) {
  const bytes = await readFile(file);
  return { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function validateSource() {
  const missing = [];
  for (const relative of requiredSourcePaths) {
    if (!await exists(path.join(sourceRoot, relative))) missing.push(relative);
  }
  if (missing.length > 0) throw new Error(`Source is not the expected prototype; missing:\n${missing.join('\n')}`);
}

async function collectLicenseFiles() {
  const assetsRoot = path.join(sourceRoot, 'public', 'assets');
  const files = await listFiles(assetsRoot);
  return files.filter((file) => /(^|\/)(license|licence|copying|notice)[^/]*\.(txt|md)$/i.test(file));
}

async function copyCapture() {
  await mkdir(destinationRoot, { recursive: true });
  for (const [sourceRelative, destinationRelative] of captureMap) {
    await cp(path.join(sourceRoot, sourceRelative), path.join(destinationRoot, destinationRelative), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
  const licenseFiles = await collectLicenseFiles();
  for (const relative of licenseFiles) {
    const destination = path.join(destinationRoot, 'provenance', 'upstream-license-files', relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(sourceRoot, 'public', 'assets', relative), destination, { force: true, preserveTimestamps: true });
  }
  const legacyEditorRoot = path.join(repositoryRoot, 'authoring', 'local', 'three-editor');
  if (await exists(legacyEditorRoot)) {
    await cp(legacyEditorRoot, path.join(destinationRoot, 'legacy-three-editor-source'), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
}

async function buildInventory() {
  const files = (await listFiles(destinationRoot)).filter((file) => file !== 'inventory.json');
  const entries = [];
  for (const relative of files) {
    entries.push({ path: relative, ...await digest(path.join(destinationRoot, relative)) });
  }
  return {
    schemaVersion: 1,
    source: toPosix(path.relative(repositoryRoot, sourceRoot)),
    capturedAt: new Date().toISOString(),
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    files: entries,
  };
}

async function audit(compareSource) {
  const inventoryPath = path.join(destinationRoot, 'inventory.json');
  if (!await exists(inventoryPath)) throw new Error('No capture inventory exists. Run capture first.');
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const errors = [];
  for (const entry of inventory.files) {
    const target = path.join(destinationRoot, entry.path);
    if (!await exists(target)) { errors.push(`missing capture: ${entry.path}`); continue; }
    const actual = await digest(target);
    if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) errors.push(`capture differs: ${entry.path}`);
  }
  if (compareSource) {
    await validateSource();
    for (const [sourceRelative, destinationRelative] of captureMap) {
      const sourceTarget = path.join(sourceRoot, sourceRelative);
      const destinationTarget = path.join(destinationRoot, destinationRelative);
      const sourceStats = await stat(sourceTarget);
      const sourceFiles = sourceStats.isDirectory() ? await listFiles(sourceTarget) : [''];
      for (const relative of sourceFiles) {
        const sourceFile = relative ? path.join(sourceTarget, relative) : sourceTarget;
        const destinationFile = relative ? path.join(destinationTarget, relative) : destinationTarget;
        if (!await exists(destinationFile)) { errors.push(`source not captured: ${toPosix(path.join(sourceRelative, relative))}`); continue; }
        const [sourceDigest, destinationDigest] = await Promise.all([digest(sourceFile), digest(destinationFile)]);
        if (sourceDigest.bytes !== destinationDigest.bytes || sourceDigest.sha256 !== destinationDigest.sha256) {
          errors.push(`source/capture mismatch: ${toPosix(path.join(sourceRelative, relative))}`);
        }
      }
    }
  }
  if (errors.length > 0) throw new Error(`Asset capture audit failed:\n${errors.join('\n')}`);
  const scope = compareSource ? 'capture integrity and source parity' : 'capture integrity (source folder absent)';
  console.log(`Asset capture audit passed: ${inventory.fileCount} files, ${inventory.totalBytes} bytes; ${scope}.`);
}

if (auditOnly) {
  await audit(await exists(sourceRoot));
} else {
  await validateSource();
  await copyCapture();
  const inventory = await buildInventory();
  await writeFile(path.join(destinationRoot, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  console.log(`Captured ${inventory.fileCount} files (${inventory.totalBytes} bytes) into ${toPosix(path.relative(repositoryRoot, destinationRoot))}.`);
  await audit(true);
}

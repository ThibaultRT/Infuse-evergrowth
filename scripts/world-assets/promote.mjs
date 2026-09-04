import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const capturedAssetsRoot = path.join(repositoryRoot, 'authoring', 'local', 'world-development', 'source-assets', 'another-example-public-assets');
const catalogPath = path.join(repositoryRoot, 'src', 'data', 'world', 'world-assets.json');
const runtimeRoot = path.join(repositoryRoot, 'public', 'assets', 'world');
const verifyOnly = process.argv.includes('--verify');
const all = process.argv.includes('--all');

const digest = async (file) => {
  const bytes = await readFile(file);
  return { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
};

const decodeDataUri = (uri) => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri);
  if (!match) throw new Error('Malformed glTF data URI');
  return {
    mimeType: match[1] ?? 'application/octet-stream',
    bytes: match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3])),
  };
};

const mimeTypeFor = (file) => {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  throw new Error(`Unsupported embedded image type: ${file}`);
};

const pad = (bytes, value = 0) => {
  const remainder = bytes.byteLength % 4;
  return remainder === 0 ? bytes : Buffer.concat([bytes, Buffer.alloc(4 - remainder, value)]);
};

async function gltfToGlb(source, destination) {
  const document = JSON.parse(await readFile(source, 'utf8'));
  const sourceDirectory = path.dirname(source);
  const binaryParts = [];
  const offsets = [];
  let binaryLength = 0;
  for (const buffer of document.buffers ?? []) {
    if (!buffer.uri) throw new Error(`Cannot repack glTF buffer without URI: ${source}`);
    const bytes = buffer.uri.startsWith('data:') ? decodeDataUri(buffer.uri).bytes : await readFile(path.resolve(sourceDirectory, decodeURIComponent(buffer.uri)));
    const padded = pad(bytes);
    offsets.push(binaryLength);
    binaryParts.push(padded);
    binaryLength += padded.byteLength;
  }
  for (const view of document.bufferViews ?? []) {
    view.byteOffset = (view.byteOffset ?? 0) + offsets[view.buffer ?? 0];
    view.buffer = 0;
  }
  for (const image of document.images ?? []) {
    if (!image.uri) continue;
    const decoded = image.uri.startsWith('data:')
      ? decodeDataUri(image.uri)
      : { mimeType: mimeTypeFor(image.uri), bytes: await readFile(path.resolve(sourceDirectory, decodeURIComponent(image.uri))) };
    const bufferView = { buffer: 0, byteOffset: binaryLength, byteLength: decoded.bytes.byteLength };
    document.bufferViews ??= [];
    document.bufferViews.push(bufferView);
    image.bufferView = document.bufferViews.length - 1;
    image.mimeType = decoded.mimeType;
    delete image.uri;
    const padded = pad(decoded.bytes);
    binaryParts.push(padded);
    binaryLength += padded.byteLength;
  }
  document.buffers = [{ byteLength: binaryLength }];
  const jsonBytes = pad(Buffer.from(JSON.stringify(document)), 0x20);
  const binaryBytes = Buffer.concat(binaryParts);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.byteLength + 8 + binaryBytes.byteLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryBytes.byteLength, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.concat([header, jsonHeader, jsonBytes, binaryHeader, binaryBytes]));
}

async function promoteAsset(key, definition) {
  const source = path.join(capturedAssetsRoot, definition.source);
  const destination = path.join(repositoryRoot, 'public', definition.runtime);
  await stat(source);
  if (definition.kind === 'model' && path.extname(source).toLowerCase() === '.gltf') await gltfToGlb(source, destination);
  else {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  return { key, source: definition.source, runtime: definition.runtime, sourceDigest: await digest(source), runtimeDigest: await digest(destination) };
}

async function promoteLicenses() {
  const developmentRoot = path.join(repositoryRoot, 'authoring', 'local', 'world-development');
  const licenses = [
    [path.join(developmentRoot, 'source-assets', 'another-example-public-assets', 'kaykit-hexagon', 'LICENSE.txt'), path.join(runtimeRoot, 'shared', 'licenses', 'kaykit-medieval-hexagon-cc0.txt')],
    [path.join(developmentRoot, 'provenance', 'upstream-license-files', 'stylized-nature-standard.txt'), path.join(runtimeRoot, 'shared', 'licenses', 'quaternius-stylized-nature-cc0.txt')],
  ];
  for (const [source, destination] of licenses) {
    await mkdir(path.dirname(destination), { recursive: true });
    const normalized = (await readFile(source, 'utf8')).replace(/[ \t]+$/gm, '').replace(/\r?\n/g, '\n');
    await writeFile(destination, normalized.endsWith('\n') ? normalized : `${normalized}\n`, 'utf8');
  }
  return Promise.all(licenses.map(async ([, file]) => ({ file: path.relative(path.join(repositoryRoot, 'public'), file).split(path.sep).join('/'), ...await digest(file) })));
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const keys = all ? Object.keys(catalog) : requested;
if (!verifyOnly && keys.length === 0) throw new Error('Pass --all or one or more semantic asset keys.');

const manifestPath = path.join(runtimeRoot, 'asset-manifest.json');
if (verifyOnly) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const errors = [];
  for (const [key, definition] of Object.entries(catalog)) {
    const entry = manifest.assets.find((candidate) => candidate.key === key);
    if (!entry) { errors.push(`not promoted: ${key}`); continue; }
    const runtimeFile = path.join(repositoryRoot, 'public', definition.runtime);
    try {
      const actual = await digest(runtimeFile);
      if (actual.sha256 !== entry.runtimeDigest.sha256 || actual.bytes !== entry.runtimeDigest.bytes) errors.push(`runtime differs: ${key}`);
    } catch { errors.push(`missing runtime file: ${key}`); }
  }
  for (const license of manifest.licenses ?? []) {
    const file = path.join(repositoryRoot, 'public', license.file);
    try {
      const actual = await digest(file);
      if (actual.sha256 !== license.sha256 || actual.bytes !== license.bytes) errors.push(`license differs: ${license.file}`);
    } catch { errors.push(`missing runtime license: ${license.file}`); }
  }
  if (errors.length > 0) throw new Error(`Runtime world asset verification failed:\n${errors.join('\n')}`);
  console.log(`Verified ${manifest.assets.length} promoted world assets.`);
} else {
  const unknown = keys.filter((key) => !catalog[key]);
  if (unknown.length > 0) throw new Error(`Unknown semantic asset keys: ${unknown.join(', ')}`);
  const existing = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => ({ schemaVersion: 1, assets: [] }));
  const entries = new Map(existing.assets.filter((entry) => catalog[entry.key]).map((entry) => [entry.key, entry]));
  for (const key of keys) entries.set(key, await promoteAsset(key, catalog[key]));
  const licenses = await promoteLicenses();
  const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), assets: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)), licenses };
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Promoted ${keys.length} world assets; manifest now contains ${manifest.assets.length}.`);
}

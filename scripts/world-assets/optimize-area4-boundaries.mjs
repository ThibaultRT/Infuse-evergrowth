import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--tool-root') throw new Error('Expected --tool-root <gltf-transform installation root>');
const requireTool = createRequire(path.resolve(args[1], 'package.json'));
const { NodeIO } = requireTool('@gltf-transform/core');
const { ALL_EXTENSIONS } = requireTool('@gltf-transform/extensions');
const { dedup, prune, weld } = requireTool('@gltf-transform/functions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const spec = JSON.parse(await readFile('src/data/world/area4-boundaries.json', 'utf8'));
const reports = [];
for (const name of ['fence', 'gate']) {
  const target = `public/assets/world/shared/models/area4-east-${name}.glb`;
  const document = await io.read(target);
  await document.transform(weld(), dedup(), prune());
  const root = document.getRoot();
  const triangles = root.listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
  assert.ok(triangles <= spec[name].triangleBudget);
  assert.equal(root.listMaterials().length, 1);
  await io.write(target, document);
  const bytes = await readFile(target);
  assert.ok(bytes.length < 2 * 1048576);
  reports.push({ name, triangles, bytes: bytes.length, textures: root.listTextures().map((texture) => ({ size: texture.getSize(), mime: texture.getMimeType() })), sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile('authoring/local/area4/boundaries/runtime-manifest.json', JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));

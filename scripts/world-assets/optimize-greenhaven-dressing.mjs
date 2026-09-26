import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--tool-root') throw new Error('Use --tool-root <gltf-transform installation>');
const requireTool = createRequire(path.resolve(args[1], 'package.json'));
const { NodeIO } = requireTool('@gltf-transform/core');
const { dedup, prune, weld } = requireTool('@gltf-transform/functions');
const io = new NodeIO();
let totalBytes = 0;
for (const suffix of ['grass-patch', 'shrub-a', 'shrub-b', 'mushrooms', 'fallen-log', 'stump']) {
  const file = `public/assets/world/shared/models/greenhaven-${suffix}.glb`;
  const document = await io.read(file);
  await document.transform(weld(), dedup(), prune());
  assert.equal(document.getRoot().listTextures().length, 0);
  assert.equal(document.getRoot().listMaterials().length, 1);
  const triangles = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
  assert.ok(triangles <= 1400);
  await io.write(file, document);
  const bytes = (await readFile(file)).length;
  totalBytes += bytes;
  console.log(`${suffix}: ${triangles} triangles, ${(bytes / 1024).toFixed(1)} KiB`);
}
assert.ok(totalBytes < 160 * 1024, 'Small dressing assets exceeded 160 KiB combined.');

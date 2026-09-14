import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Authoring tools remain outside the game dependencies. The supplied source is
// preserved in authoring/local; this writes only the normalized runtime derivative.
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--tool-root') throw new Error('Expected --tool-root <gltf-transform installation root>');
const requireTool = createRequire(path.resolve(args[1], 'package.json'));
const { NodeIO } = requireTool('@gltf-transform/core');
const { dedup, prune, simplify, transformMesh, weld } = requireTool('@gltf-transform/functions');
const { MeshoptSimplifier } = requireTool('meshoptimizer');
const local = 'authoring/local/area4/throne';
const sourcePath = `${local}/Throne-area4-source.glb`;
const outputPath = 'public/assets/world/shared/models/area4-throne.glb';
const source = await readFile(sourcePath);
const sourceSha256 = createHash('sha256').update(source).digest('hex');
assert.equal(sourceSha256, '79121ec376e754c6ca76cc762f200fd975acae135e40822dd5b535b99eb7e5de', 'Expected the approved user-supplied throne.');
const { throne } = JSON.parse(await readFile('src/data/world/area4-blockout.json', 'utf8'));
const io = new NodeIO();
const document = await io.read(sourcePath);
const root = document.getRoot();
assert.equal(root.listNodes().length, 1);
assert.equal(root.listMeshes().length, 1);
assert.equal(root.listAnimations().length + root.listSkins().length, 0);
const node = root.listNodes()[0];
assert.deepEqual(node.getMatrix(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const mesh = node.getMesh();
assert.equal(mesh.listPrimitives().length, 1);
const triangles = () => mesh.listPrimitives().reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
const sourceTriangles = triangles();
const textureHashes = () => root.listTextures().map((texture) => createHash('sha256').update(texture.getImage()).digest('hex'));
const originalTextures = textureHashes();
await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 14900 / sourceTriangles, error: .002 }), dedup(), prune());

// Bake a single uniform scale after simplification, preserving proportions and
// the source's -Z-facing seat. Ground-centre the exported mesh; runtime scale is 1.
const bounds = () => {
  const positions = mesh.listPrimitives()[0].getAttribute('POSITION');
  return { min: positions.getMin([]), max: positions.getMax([]) };
};
const before = bounds();
const scale = throne.height / (before.max[1] - before.min[1]);
transformMesh(mesh, [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0,
  -(before.min[0] + before.max[0]) / 2 * scale, -before.min[1] * scale, -(before.min[2] + before.max[2]) / 2 * scale, 1]);
node.setName('Area4_AncientThrone');
mesh.setName('Throne_StoneAndLava');
root.listMaterials()[0].setName('Area4_ThroneStone');
root.getDefaultScene().setName('Area4_Throne').setExtras({ sourceSha256, units: 'metres', forward: '-Z', height: throne.height });
const after = bounds();
const size = after.max.map((v, i) => v - after.min[i]);
assert.ok(Math.abs(size[1] - throne.height) < 1e-5 && Math.abs(after.min[1]) < 1e-5, 'Throne must be grounded and exactly the authored height.');
assert.ok(size[0] <= throne.width && size[2] <= throne.depth, 'Update the authored footprint before accepting a larger model.');
assert.ok(triangles() <= 15000, 'Throne exceeds its geometry target.');
assert.deepEqual(textureHashes(), originalTextures, 'Preserve all three supplied 1K textures without recompression.');
await io.write(outputPath, document);
const output = await readFile(outputPath);
assert.ok(output.length < 2 * 1048576, 'Throne exceeds its 2 MiB target.');
const report = { sourceSha256, runtimeSha256: createHash('sha256').update(output).digest('hex'), sourceBytes: source.length,
  runtimeBytes: output.length, sourceTriangles, triangles: triangles(), materials: root.listMaterials().length,
  textures: root.listTextures().length, textureSize: [1024, 1024], textureHashes: originalTextures,
  bounds: after, size, uniformScale: scale, runtimeScale: 1, forward: '-Z', placement: 'A04_Ancient_Throne' };
await writeFile(`${local}/runtime-manifest.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

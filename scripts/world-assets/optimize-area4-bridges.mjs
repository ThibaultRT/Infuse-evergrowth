import { createRequire } from 'node:module';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--tool-root') throw new Error('Expected --tool-root <gltf-transform installation>');
const requireTool = createRequire(path.resolve(args[1], 'package.json'));
const { NodeIO } = requireTool('@gltf-transform/core');
const { ALL_EXTENSIONS } = requireTool('@gltf-transform/extensions');
const { dedup, prune, weld } = requireTool('@gltf-transform/functions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const root = 'public/assets/world/shared/models';
const files = ['area4-s2-rib-vault.glb', 'area4-s2-land-gate.glb', 'area4-w2-timber-bridge.glb', 'area4-w2-wall-gate.glb'];
const reports = [];
for (const file of files) {
  const target = path.join(root, file);
  const document = await io.read(target);
  // Preserve hinge pivots and the independently fading rib vault. No decoder needed.
  await document.transform(weld(), dedup(), prune({ keepLeaves: true, keepExtras: true }));
  await io.write(target, document);
  const bytes = await readFile(target);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
  const report = { file, triangles: primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0), materials: gltf.materials.length, draws: primitives.length, bytes: (await stat(target)).size, textures: (gltf.images ?? []).length };
  reports.push(report);
  console.log(`${file}: ${report.triangles} triangles, ${report.materials} materials, ${(report.bytes / 1048576).toFixed(2)} MiB`);
}
await writeFile('authoring/local/area4/models/runtime-manifest.json', JSON.stringify(reports, null, 2) + '\n');

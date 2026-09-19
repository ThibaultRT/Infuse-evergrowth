import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const local = 'authoring/local/area4/forest';
const sources = JSON.parse(await readFile('scripts/world-assets/area4-forest-sources.json', 'utf8'));
if (process.argv.includes('--download')) {
  await mkdir(`${local}/textures`, { recursive: true });
  for (const source of sources) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.file}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`${source.file}: upstream source changed; review before rebuilding.`);
    await writeFile(`${local}/textures/${source.file}`, bytes);
  }
} else {
  const at = process.argv.indexOf('--tool-root');
  if (at < 0 || !process.argv[at + 1]) throw new Error('Use --download or --tool-root <gltf-transform installation>.');
  const requireTool = createRequire(path.resolve(process.argv[at + 1], 'package.json'));
  const { NodeIO } = requireTool('@gltf-transform/core');
  const { ALL_EXTENSIONS } = requireTool('@gltf-transform/extensions');
  const { dedup, prune, weld } = requireTool('@gltf-transform/functions');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const reports = [];
  for (const suffix of ['charred-trunk-a', 'charred-trunk-b', 'charred-stump', 'charred-log', 'basalt-a', 'basalt-b']) {
    const file = `public/assets/world/shared/models/area4-${suffix}.glb`;
    const document = await io.read(file);
    for (const material of document.getRoot().listMaterials()) {
      // Charcoal tint compensates the source bark's warm hue; texture data stays CC0.
      material.setBaseColorFactor(suffix.startsWith('charred') ? [.24, .30, .36, 1] : [.7, .78, .88, 1]);
      material.setMetallicFactor(0).setRoughnessFactor(.96);
    }
    await document.transform(weld(), dedup(), prune());
    await io.write(file, document);
    const bytes = await readFile(file);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
    const report = { file, bytes: bytes.length, triangles: primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0), materials: gltf.materials.length, textures: gltf.images.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    reports.push(report);
    console.log(`${suffix}: ${report.triangles} triangles, ${(bytes.length / 1024).toFixed(0)} KiB`);
  }
  await writeFile(`${local}/runtime-manifest.json`, JSON.stringify(reports, null, 2) + '\n');
}

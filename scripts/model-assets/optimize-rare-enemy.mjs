import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Authoring dependencies are separate from the game. Point --tool-root at an
// installation of @gltf-transform/cli (core/functions/extensions + sharp/meshoptimizer).
// Usage: node scripts/model-assets/optimize-rare-enemy.mjs --tool-root <dir> <source.glb> <output.glb>
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--tool-root') throw new Error('Expected --tool-root <dir> <source.glb> <output.glb>');
const requireTool = createRequire(resolve(args[1], 'package.json'));
// Use the image dependency's Sharp installation to avoid mixed libvips DLLs on Windows.
const sharp = createRequire(requireTool.resolve('ndarray-pixels'))('sharp');
const { NodeIO } = requireTool('@gltf-transform/core');
const { ALL_EXTENSIONS } = requireTool('@gltf-transform/extensions');
const { dedup, meshopt, prune, simplify, textureCompress, unpartition, weld } = requireTool('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = requireTool('meshoptimizer');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const source = await io.read(args[2]);
const nodes = source.getRoot().listNodes().filter((node) => node.getMesh());
if (source.getRoot().listSkins().length || source.getRoot().listAnimations().length || nodes.length !== 2 || !nodes.every((node) => /^Rare_LOD[01]$/.test(node.getName()))) {
  throw new Error('Expected two static baked LODs from bake-rare-enemy.py.');
}
const sourceHash = createHash('sha256').update(await readFile(args[2])).digest('hex');
const output = source;
const scene = output.getRoot().getDefaultScene();
for (const node of nodes) node.setExtras({ lodDistance: [0, 26][Number(node.getName().at(-1))] });
await output.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 1, error: .0001 }));
for (const node of nodes) console.log(`${node.getName()}: ${node.getMesh().listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0)} triangles`);
// Preserve the high-poly normal bakes and UVs; share base/PBR textures across
// LODs, resize for game scale, then compress geometry.
await output.transform(dedup(), unpartition(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
scene.setExtras({ sourceSha256: sourceHash, lodHysteresis: .1 });
await io.write(args[3], output);
console.log(`Source SHA-256: ${sourceHash}`);
console.log(`Runtime size: ${((await stat(args[3])).size / 1024 / 1024).toFixed(2)} MiB`);

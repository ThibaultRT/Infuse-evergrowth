import { writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { installGltfNodeCompat } from './gltf-node-compat.mjs';
installGltfNodeCompat();
export async function exportGlb(object,path) {
  const exporter=new GLTFExporter();
  const result=await exporter.parseAsync(object,{binary:true,onlyVisible:false});
  const bytes=Buffer.from(result); await writeFile(path,bytes); return bytes.byteLength;
}

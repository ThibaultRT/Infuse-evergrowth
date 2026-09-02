import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import * as THREE from 'three';
import { BUILDER_VERSION } from './constants.mjs';
import { loadEditorScene } from './scene-loader.mjs';
import { parseWorld } from './guide-parser.mjs';
import { buildRibbon } from './geometry/road-ribbon.mjs';
import { buildRing } from './geometry/road-ring.mjs';
import { buildRiver } from './geometry/river-ribbon.mjs';
import { exportGlb } from './export/chunk-exporter.mjs';
import { findAuthoringObjects, stripAuthoringObjects } from './validation/validate-scene.mjs';
import { diagnosticWarnings, inspectObject } from './validation/build-report.mjs';

const root=process.cwd(); const args=new Set(process.argv.slice(2));
const fixture=args.has('--fixture'); const promote=args.has('--promote'); const validateOnly=args.has('--validate-only');
const explicit=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
let sourcePath=path.resolve(root,explicit ?? (fixture?'scripts/world-authoring/fixtures/minimal-editor-scene.json':'authoring/local/three-editor/infuse-world.json'));
if(validateOnly&&!explicit&&!fixture){try{await stat(sourcePath);}catch{sourcePath=path.resolve(root,'scripts/world-authoring/fixtures/minimal-editor-scene.json');console.log('Local source absent; validating committed fixture.');}}
const relativeSource=path.relative(root,sourcePath).replaceAll('\\','/');

try {
  const {scene,sourceText}=await loadEditorScene(sourcePath); const hash=createHash('sha256').update(sourceText).digest('hex');
  const model=parseWorld(scene); if(model.errors.length) throw new Error(`Authoring validation failed:\n- ${model.errors.join('\n- ')}`);
  console.log(`Validated ${model.chunks.length} chunks and ${model.guides.length} guides from ${relativeSource}.`);
  if(validateOnly){for(const warning of model.warnings)console.warn(`Warning: ${warning}`);process.exit(0);}
  const generated=path.resolve(root,'authoring/generated'); for(const folder of ['chunks/areas','chunks/transitions','preview','manifests','reports'])await mkdir(path.join(generated,folder),{recursive:true});
  const outputs=[]; const generatedObjects=[]; let stripped=0; const warnings=[...model.warnings];
  for(const chunk of model.chunks) {
    const clone=chunk.root.clone(true); clone.position.set(0,0,0); clone.rotation.set(0,0,0); clone.scale.set(1,1,1); clone.updateMatrixWorld(true);
    const inverseRoot=new THREE.Matrix4().copy(chunk.root.matrixWorld).invert();
    for(const guide of model.guides.filter(item=>item.owner===chunk)) {
      let mesh;
      if(guide.type==='road-ring'){const origin=guide.style.origin.clone().applyMatrix4(inverseRoot);mesh=buildRing(guide,origin);}
      else {const points=guide.points.map(point=>point.clone().applyMatrix4(inverseRoot)); mesh=guide.type==='river'?buildRiver(guide,points):buildRibbon(guide,points);}
      mesh.name=`GENERATED_${guide.type==='road-ring'?'ROAD_RING':guide.type.toUpperCase()}_${guide.id}`; clone.add(mesh);
      generatedObjects.push({name:mesh.name,vertices:mesh.geometry.getAttribute('position').count,triangles:mesh.geometry.index.count/3});
    }
    stripped+=stripAuthoringObjects(clone); const remaining=findAuthoringObjects(clone); if(remaining.length)throw new Error(`${chunk.rootName} still contains authoring objects: ${remaining.join(', ')}`);
    const outputPath=path.join(generated,'chunks',chunk.output); await mkdir(path.dirname(outputPath),{recursive:true}); const bytes=await exportGlb(clone,outputPath); const stats=inspectObject(clone); warnings.push(...diagnosticWarnings(chunk.rootName,stats,bytes));
    outputs.push({chunk,clone,bytes,stats,outputPath});
  }
  const preview=new THREE.Scene(); preview.name='AUTHORING_PREVIEW'; for(const output of outputs){const group=new THREE.Group();group.name=`PREVIEW_${output.chunk.rootName}`;group.position.copy(output.chunk.worldPosition);group.add(output.clone);preview.add(group);} const previewPath=path.join(generated,'preview/assembled-world.glb'); const previewBytes=await exportGlb(preview,previewPath);
  const manifest={source:{path:relativeSource,sha256:hash},builderVersion:BUILDER_VERSION,chunks:outputs.map(({chunk})=>({id:chunk.id,kind:chunk.kind,rootName:chunk.rootName,worldPosition:chunk.worldPosition.toArray(),output:chunk.output})),guides:model.guides.map(g=>({type:g.type,id:g.id,owner:g.owner.id,points:g.points.map(p=>p.toArray())}))};
  const report={sourceHash:hash,buildTimestamp:new Date().toISOString(),builderVersion:BUILDER_VERSION,roots:model.chunks.map(c=>c.rootName),guideCounts:Object.fromEntries(['road','road-ring','river'].map(type=>[type,model.guides.filter(g=>g.type===type).length])),generatedObjects,outputs:outputs.map(({chunk,bytes,stats})=>({rootName:chunk.rootName,path:chunk.output,bytes,...stats})),previewBytes,strippedAuthoringObjects:stripped,warnings,errors:[]};
  await writeFile(path.join(generated,'manifests/world-visual-manifest.json'),JSON.stringify(manifest,null,2)+'\n'); await writeFile(path.join(generated,'reports/build-report.json'),JSON.stringify(report,null,2)+'\n');
  if(promote){for(const output of outputs){const destination=path.resolve(root,'public/assets/world',output.chunk.output);await mkdir(path.dirname(destination),{recursive:true});await copyFile(output.outputPath,destination);}console.log(`Promoted ${outputs.length} validated chunks to public/assets/world. Verify ASSET-LICENSES.md before committing.`);}
  console.log(`Built ${outputs.length} GLBs, ${generatedObjects.length} generated surfaces, preview ${(previewBytes/1024).toFixed(1)} KiB.`); for(const warning of warnings)console.warn(`Warning: ${warning}`);
} catch(error) { console.error(error.message); process.exitCode=1; }

import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { normalizeEmbeddedImages } from './embedded-image.mjs';

export async function loadEditorScene(sourcePath) {
  let text;
  try { text = await readFile(sourcePath, 'utf8'); }
  catch (error) { throw new Error(`Cannot read authoring source ${sourcePath}: ${error.message}`); }
  let input;
  try { input = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON in ${sourcePath}: ${error.message}`); }
  const document = input.scene?.object ? input.scene : input.scene?.metadata ? input.scene : input.object ? input : null;
  if (!document?.object) throw new Error('Unsupported Three.js Editor JSON: expected a project scene or exported Object/Scene document.');
  normalizeEmbeddedImages(document);
  let scene;
  try { scene = new THREE.ObjectLoader().parse(document); }
  catch (error) { throw new Error(`Three.js ObjectLoader failed: ${error.message}`); }
  scene.updateMatrixWorld(true);
  return { scene, sourceText: text };
}

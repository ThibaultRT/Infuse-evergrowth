import { LOD, type Object3D } from 'three';

/** Prepared static GLBs carry top-level nodes with authored camera-distance thresholds. */
export function configureModelLod(model: Object3D): void {
  const levels = model.children.filter((child) => typeof child.userData.lodDistance === 'number');
  if (levels.length < 2) return;
  const lod = new LOD();
  lod.name = 'DistanceLOD';
  for (const child of levels) lod.addLevel(child, child.userData.lodDistance as number, .1);
  model.add(lod);
}

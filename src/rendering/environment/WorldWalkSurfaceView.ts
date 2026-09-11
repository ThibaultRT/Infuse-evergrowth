import * as THREE from 'three';
import type { WorldWalkSurface } from '../../domain/world/WorldWalkSurface';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Project authored ramps; the imported model supplies the level bridge deck. */
export function createWalkSurfaceView(surface: WorldWalkSurface, material: THREE.Material, includeDeck: boolean): THREE.Mesh {
  const planks: THREE.BufferGeometry[] = [];
  for (let index = 1; index < surface.profile.length; index += 1) {
    const [z0, y0] = surface.profile[index - 1];
    const [z1, y1] = surface.profile[index];
    if (y0 === y1 && !includeDeck) continue;
    const count = Math.ceil((z1 - z0) / 0.3);
    const slope = Math.atan2(y1 - y0, z1 - z0);
    for (let plank = 0; plank < count; plank += 1) {
      const t = (plank + 0.5) / count;
      const geometry = new THREE.BoxGeometry(surface.width, 0.12, Math.hypot(z1 - z0, y1 - y0) / count - 0.008);
      geometry.rotateX(-slope);
      geometry.translate(0, y0 + (y1 - y0) * t - 0.06 / Math.cos(slope), z0 + (z1 - z0) * t);
      planks.push(geometry);
    }
  }
  const geometry = mergeGeometries(planks);
  for (const plank of planks) plank.dispose();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = includeDeck ? 'WalkableBridge_Fallback' : 'WalkableBridge_Approaches';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.worldOwnedGeometry = true;
  return mesh;
}

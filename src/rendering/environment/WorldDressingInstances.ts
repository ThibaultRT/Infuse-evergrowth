import * as THREE from 'three';
import { WORLD_PROP_CATALOG, type WorldPropDefinition, type WorldPropKey } from '../../data/world/WorldPropCatalog';

/** Collapse opted-in, non-occluding dressing into draws sharing the cached geometry.
 * Failed assets retain their owned fallback resources and individual roots. */
export function batchWorldDressing(group: THREE.Group): void {
  const batches = new Map<string, { source: THREE.Mesh; matrices: THREE.Matrix4[]; names: string[] }>();
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  for (const root of [...group.children]) {
    const definition: WorldPropDefinition | undefined = WORLD_PROP_CATALOG[root.userData.propKey as WorldPropKey];
    if (!definition?.batchInstances || definition.cameraOccluder || root.userData.worldAssetFallback) continue;
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const key = [child.geometry.uuid, ...materials.map((material) => material.uuid), child.castShadow, child.receiveShadow].join(':');
      const batch = batches.get(key) ?? { source: child, matrices: [] as THREE.Matrix4[], names: [] as string[] };
      batch.matrices.push(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
      batch.names.push(root.name);
      batches.set(key, batch);
    });
    group.remove(root);
  }
  for (const { source, matrices, names } of batches.values()) {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, matrices.length);
    mesh.name = `${group.name}_Dressing_${names[0]}`;
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    mesh.userData.worldDressingInstances = names;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

import * as THREE from 'three';

/** Cloned skinned models own their skeleton textures, but share asset geometry/materials. */
export function disposeClonedSkeletons(root: THREE.Object3D): void {
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
  skeletons.forEach((skeleton) => skeleton.dispose());
}

/** Disposes geometry/materials that are explicitly owned by one procedural view. */
export function disposeOwnedObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

import * as THREE from 'three';

export type AssetResources = { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material>; textures: Set<THREE.Texture> };
export function assetResources(root?: THREE.Object3D, texture?: THREE.Texture): AssetResources {
  const resources: AssetResources = { geometries: new Set(), materials: new Set(), textures: new Set(texture ? [texture] : []) };
  root?.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.textures.add(value);
    }
  });
  return resources;
}

/** Estimated resident buffer + decoded texture bytes, including mipmaps; not process RAM. */
export function estimatedAssetBytes(resources: AssetResources): number {
  const buffers = new Set<ArrayBufferLike>();
  for (const geometry of resources.geometries) {
    for (const attribute of [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat(), geometry.index]) {
      if (!attribute) continue;
      const array = attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.array : attribute.array;
      buffers.add(array.buffer);
    }
  }
  let bytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const sources = new Set<THREE.Texture['source']>();
  for (const texture of resources.textures) {
    if (sources.has(texture.source)) continue;
    sources.add(texture.source);
    const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } } | undefined;
    bytes += image?.data?.byteLength ?? ((image?.width ?? 0) * (image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
  }
  return Math.ceil(bytes);
}

export function disposeAssetResources(resources: AssetResources): void {
  resources.geometries.forEach((geometry) => geometry.dispose());
  resources.materials.forEach((material) => material.dispose());
  const images = new Set<unknown>();
  resources.textures.forEach((texture) => {
    texture.dispose();
    if (texture.image) images.add(texture.image);
  });
  for (const image of images) {
    if (typeof (image as { close?: unknown }).close === 'function') (image as { close(): void }).close();
  }
}

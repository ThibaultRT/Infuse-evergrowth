import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { VisualChunkInstance, VisualChunkKind, VisualChunkProvider } from './WorldVisualStreamingManager';

export type StreamedGlbVisualSpec = {
  id: string;
  kind: VisualChunkKind;
  path: string;
  worldPosition: { x: number; y?: number; z: number };
  fallback?: () => VisualChunkInstance;
};

function viteAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

/** Disposes a unique authored visual package; use only for chunk-owned GLB resources. */
function disposeUniquePackage(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.boneTexture?.dispose();
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

/**
 * Provider for independently exported Three.js Editor/Gaea chunks. It keeps at
 * most one decoded package while prefetched/resident and evicts it when the
 * streaming manager releases the chunk. Shipping roots remain local; the
 * explicit world transform lives in this runtime metadata.
 */
export function createStreamedGlbVisualProvider(spec: StreamedGlbVisualSpec): VisualChunkProvider {
  const loader = new GLTFLoader();
  let request: Promise<GLTF> | undefined;
  let loaded: GLTF | undefined;
  let activeInstances = 0;

  const load = (): Promise<GLTF> => {
    if (request) return request;
    request = loader.loadAsync(viteAssetUrl(spec.path)).then((gltf) => { loaded = gltf; return gltf; });
    return request;
  };

  return {
    id: spec.id,
    kind: spec.kind,
    prefetch: async () => { await load(); },
    create: () => {
      const root = new THREE.Group();
      root.name = spec.id;
      root.position.set(spec.worldPosition.x, spec.worldPosition.y ?? 0, spec.worldPosition.z);
      const fallback = spec.fallback?.();
      let fallbackActive = Boolean(fallback);
      let disposed = false;
      activeInstances += 1;
      if (fallback) root.add(fallback.root);

      const attachLoaded = async (): Promise<void> => {
        try {
          const gltf = await load();
          if (disposed) return;
          if (fallbackActive && fallback) {
            fallback.root.removeFromParent();
            fallback.dispose?.();
            fallbackActive = false;
          }
          root.add(gltf.scene);
        } catch (error) {
          if (!disposed) console.warn(`${spec.id} authored visual unavailable; keeping fallback.`, error);
        }
      };
      void attachLoaded();

      return {
        root,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          activeInstances = Math.max(0, activeInstances - 1);
          if (fallbackActive && fallback) fallback.dispose?.();
          root.clear();
        }
      };
    },
    evict: () => {
      if (activeInstances > 0) return;
      const packageToDispose = loaded;
      request = undefined;
      loaded = undefined;
      if (packageToDispose) disposeUniquePackage(packageToDispose.scene);
    }
  };
}

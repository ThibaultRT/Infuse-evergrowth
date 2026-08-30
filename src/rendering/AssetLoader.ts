import { Box3, LoadingManager, Object3D, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export class AssetLoader {
  private readonly loader: GLTFLoader;
  private readonly cache = new Map<string, Promise<GLTF>>();

  constructor(manager?: LoadingManager, private readonly assetRoot = 'assets/quaternius/') {
    this.loader = new GLTFLoader(manager);
  }

  url(path: string): string {
    return `${import.meta.env.BASE_URL}${this.assetRoot}${path}`;
  }

  load(path: string): Promise<GLTF> {
    const url = this.url(path);
    const cached = this.cache.get(url);
    if (cached) return cached;
    const request = this.loader.loadAsync(url);
    this.cache.set(url, request);
    return request;
  }

  async preload(paths: readonly string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
    let loaded = 0;
    onProgress?.(loaded, paths.length);
    const results = await Promise.allSettled(paths.map(async (path) => {
      try { await this.load(path); }
      finally {
        loaded += 1;
        onProgress?.(loaded, paths.length);
      }
    }));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  }

  async cloneScene(path: string): Promise<Object3D> {
    return (await this.load(path)).scene.clone(true);
  }

  async cloneSkinnedScene(path: string): Promise<Object3D> {
    return clone((await this.load(path)).scene);
  }
}

export const quaterniusAssets = new AssetLoader();
export const kaykitAssets = new AssetLoader(undefined, 'assets/kaykit/');
export const gameModelAssets = new AssetLoader(undefined, 'assets/models/');

/** Centers a model on the ground and scales it to a predictable world-space height. */
export function fitModelToHeight(model: Object3D, height: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  if (size.y <= 0) return;
  model.scale.multiplyScalar(height / size.y);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
}

/** Centers a model on the ground and scales its widest horizontal axis to a world-space footprint. */
export function fitModelToFootprint(model: Object3D, footprint: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const width = Math.max(size.x, size.z);
  if (width <= 0) return;
  model.scale.multiplyScalar(footprint / width);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
}

export const BOOT_ASSETS = [
  'animations/UAL1_Standard.glb',
  'characters/models/Male_Ranger.gltf'
] as const;

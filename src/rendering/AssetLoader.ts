import { LoadingManager, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const ASSET_ROOT = 'assets/quaternius/';

export class AssetLoader {
  private readonly loader: GLTFLoader;
  private readonly cache = new Map<string, Promise<GLTF>>();

  constructor(manager?: LoadingManager) {
    this.loader = new GLTFLoader(manager);
  }

  url(path: string): string {
    return `${import.meta.env.BASE_URL}${ASSET_ROOT}${path}`;
  }

  load(path: string): Promise<GLTF> {
    const url = this.url(path);
    const cached = this.cache.get(url);
    if (cached) return cached;
    const request = this.loader.loadAsync(url);
    this.cache.set(url, request);
    return request;
  }

  async cloneScene(path: string): Promise<Object3D> {
    return (await this.load(path)).scene.clone(true);
  }

  async cloneSkinnedScene(path: string): Promise<Object3D> {
    return clone((await this.load(path)).scene);
  }
}

export const quaterniusAssets = new AssetLoader();

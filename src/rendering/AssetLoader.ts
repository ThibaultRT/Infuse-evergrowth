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

export const BOOT_ASSETS = [
  'animations/UAL1_Standard.glb',
  'characters/models/Male_Ranger.gltf',
  'characters/models/Male_Peasant.gltf',
  'nature/models/CommonTree_1.gltf',
  'nature/models/CommonTree_3.gltf',
  'nature/models/Rock_Medium_1.gltf',
  'nature/models/Rock_Medium_2.gltf',
  'nature/models/Bush_Common_Flowers.gltf',
  'nature/models/Flower_3_Group.gltf',
  'nature/models/Grass_Common_Short.gltf',
  'nature/models/RockPath_Round_Wide.gltf',
  'village/models/Prop_WoodenFence_Single.gltf',
  'village/models/Prop_WoodenFence_Extension1.gltf',
  'village/models/Prop_Brick1.gltf',
  'village/models/Floor_UnevenBrick.gltf',
  'village/models/DoorFrame_Round_Brick.gltf',
  'village/models/Door_4_Round.gltf'
] as const;

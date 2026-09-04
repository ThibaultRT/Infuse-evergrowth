import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { WorldAssetKey } from '../../data/world/WorldAssetKeys';
import { fitModelToFootprint } from '../AssetLoader';
import type { WorldAssetResolver } from './WorldVisualAssetCatalog';

type LoadedModel = { readonly scene: THREE.Object3D; readonly definition: ReturnType<WorldAssetResolver['resolve']> };

export class WorldAssetLibrary {
  private readonly modelLoader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly models = new Map<WorldAssetKey, Promise<LoadedModel>>();
  private readonly textures = new Map<WorldAssetKey, Promise<THREE.Texture>>();

  constructor(private readonly resolver: WorldAssetResolver) {}

  async preload(keys: readonly WorldAssetKey[]): Promise<void> {
    await Promise.all([...new Set(keys)].map(async (key) => {
      const definition = this.resolver.resolve(key);
      if (definition.kind === 'model') await this.loadModel(key);
      else await this.loadTexture(key);
    }));
  }

  async instantiate(key: WorldAssetKey, name: string): Promise<THREE.Object3D> {
    try {
      const loaded = await this.loadModel(key);
      const content = cloneSkinned(loaded.scene);
      content.scale.setScalar(loaded.definition.baseScale ?? 1);
      content.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = loaded.definition.castShadow ?? true;
        child.receiveShadow = true;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          const mapped = material as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
          for (const texture of [mapped.map, mapped.emissiveMap]) if (texture) texture.colorSpace = THREE.SRGBColorSpace;
          material.needsUpdate = true;
        }
      });
      if (!loaded.definition.fitFootprint) {
        content.name = name;
        return content;
      }
      fitModelToFootprint(content, loaded.definition.fitFootprint);
      content.name = `${name}_Model`;
      const normalized = new THREE.Group();
      normalized.name = name;
      normalized.add(content);
      return normalized;
    } catch (error) {
      console.warn(`World asset ${key} failed; using a visible fallback.`, error);
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.85 }),
      );
      fallback.name = name;
      fallback.position.y = 0.7;
      fallback.userData.worldAssetFallback = key;
      return fallback;
    }
  }

  loadTexture(key: WorldAssetKey): Promise<THREE.Texture> {
    const existing = this.textures.get(key);
    if (existing) return existing;
    const definition = this.resolver.resolve(key);
    if (definition.kind !== 'texture') return Promise.reject(new Error(`${key} is not a texture.`));
    const request = this.textureLoader.loadAsync(definition.url);
    this.textures.set(key, request);
    return request;
  }

  private loadModel(key: WorldAssetKey): Promise<LoadedModel> {
    const existing = this.models.get(key);
    if (existing) return existing;
    const definition = this.resolver.resolve(key);
    if (definition.kind !== 'model') return Promise.reject(new Error(`${key} is not a model.`));
    const request = this.modelLoader.loadAsync(definition.url).then((gltf) => ({ scene: gltf.scene, definition }));
    this.models.set(key, request);
    return request;
  }
}

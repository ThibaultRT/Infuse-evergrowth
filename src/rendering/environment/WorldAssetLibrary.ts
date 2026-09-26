import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { WorldAssetKey } from '../../data/world/WorldAssetKeys';
import { fitModelToFootprint } from '../AssetLoader';
import type { WorldAssetResolver } from './WorldVisualAssetCatalog';
import { WORLD_ASSET_CACHE_BYTES } from '../../config';
import { assetResources, disposeAssetResources, estimatedAssetBytes, type AssetResources } from './WorldAssetResources';

type LoadedModel = { readonly scene: THREE.Object3D; readonly definition: ReturnType<WorldAssetResolver['resolve']> };
type Entry<T> = { request: Promise<T>; resources?: AssetResources; bytes: number; used: number };

export class WorldAssetLibrary {
  private readonly modelLoader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly models = new Map<WorldAssetKey, Entry<LoadedModel>>();
  private readonly textures = new Map<WorldAssetKey, Entry<THREE.Texture>>();
  private readonly users = new Map<WorldAssetKey, number>();
  private serial = 0;
  private disposed = false;

  constructor(private readonly resolver: WorldAssetResolver, private readonly budgetBytes = WORLD_ASSET_CACHE_BYTES) {}

  /** Reserve before loading: in-flight builds and prefetched neighbours are users too. */
  retain(keys: readonly WorldAssetKey[]): () => void {
    if (this.disposed) throw new Error('World asset library is disposed.');
    const unique = [...new Set(keys)];
    unique.forEach((key) => this.users.set(key, (this.users.get(key) ?? 0) + 1));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unique.forEach((key) => {
        const count = (this.users.get(key) ?? 1) - 1;
        if (count > 0) this.users.set(key, count); else this.users.delete(key);
      });
      this.trim();
    };
  }

  get snapshot(): { estimatedBytes: number; unusedBytes: number; budgetBytes: number; entries: number; users: number } {
    const entries = [...this.models, ...this.textures];
    return { estimatedBytes: entries.reduce((total, [, entry]) => total + entry.bytes, 0),
      unusedBytes: entries.reduce((total, [key, entry]) => total + (this.users.has(key) ? 0 : entry.bytes), 0),
      budgetBytes: this.budgetBytes, entries: entries.length, users: [...this.users.values()].reduce((total, count) => total + count, 0) };
  }

  trim(): void {
    let bytes = this.snapshot.estimatedBytes;
    for (const [key, entry] of [...this.models, ...this.textures].sort((a, b) => a[1].used - b[1].used)) {
      if (bytes <= this.budgetBytes) break;
      if (this.users.has(key) || !entry.resources) continue;
      this.models.delete(key); this.textures.delete(key);
      disposeAssetResources(entry.resources);
      bytes -= entry.bytes;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const [, entry] of [...this.models, ...this.textures]) if (entry.resources) disposeAssetResources(entry.resources);
    this.models.clear(); this.textures.clear(); this.users.clear();
  }

  async preload(keys: readonly WorldAssetKey[]): Promise<void> {
    await Promise.all([...new Set(keys)].map(async (key) => {
      const definition = this.resolver.resolve(key);
      // Keep rejected requests cached; instantiate supplies the playable fallback.
      if (definition.kind === 'model') await this.loadModel(key).catch(() => undefined);
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
      fallback.userData.worldOwnedGeometry = true;
      fallback.userData.worldOwnedMaterial = true;
      return fallback;
    }
  }

  loadTexture(key: WorldAssetKey): Promise<THREE.Texture> {
    const existing = this.textures.get(key);
    if (existing) { existing.used = ++this.serial; return existing.request; }
    if (this.disposed) return Promise.reject(new Error('World asset library is disposed.'));
    const definition = this.resolver.resolve(key);
    if (definition.kind !== 'texture') return Promise.reject(new Error(`${key} is not a texture.`));
    const entry: Entry<THREE.Texture> = { request: this.textureLoader.loadAsync(definition.url), bytes: 0, used: ++this.serial };
    entry.request = entry.request.then((texture) => {
      const resources = assetResources(undefined, texture);
      if (this.disposed) { disposeAssetResources(resources); throw new Error('World asset library is disposed.'); }
      entry.resources = resources; entry.bytes = estimatedAssetBytes(resources);
      queueMicrotask(() => this.trim());
      return texture;
    });
    this.textures.set(key, entry);
    return entry.request;
  }

  private loadModel(key: WorldAssetKey): Promise<LoadedModel> {
    const existing = this.models.get(key);
    if (existing) { existing.used = ++this.serial; return existing.request; }
    if (this.disposed) return Promise.reject(new Error('World asset library is disposed.'));
    const definition = this.resolver.resolve(key);
    if (definition.kind !== 'model') return Promise.reject(new Error(`${key} is not a model.`));
    const entry: Entry<LoadedModel> = { request: this.modelLoader.loadAsync(definition.url).then((gltf) => ({ scene: gltf.scene, definition })), bytes: 0, used: ++this.serial };
    entry.request = entry.request.then((model) => {
      const resources = assetResources(model.scene);
      if (this.disposed) { disposeAssetResources(resources); throw new Error('World asset library is disposed.'); }
      entry.resources = resources; entry.bytes = estimatedAssetBytes(resources);
      queueMicrotask(() => this.trim());
      return model;
    });
    this.models.set(key, entry);
    return entry.request;
  }
}

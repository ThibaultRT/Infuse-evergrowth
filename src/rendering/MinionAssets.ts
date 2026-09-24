import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AssetLoader } from './AssetLoader';
import { WORLD_ASSET_DEFINITIONS, type WorldAssetKey } from '../data/world/WorldAssetKeys';
import type { MinionColorVariant } from '../types';

const loader = new AssetLoader(undefined, '');
const textures = new THREE.TextureLoader();
const variants = new Map<MinionColorVariant, Promise<THREE.Object3D>>();
const variantKeys: Record<MinionColorVariant, WorldAssetKey> = {
  'variant-1': 'minion.impColor1', 'variant-2': 'minion.impColor2', 'variant-3': 'minion.impColor3'
};

/** Called only by unlocked, resident views. Geometry/maps are cached across clones. */
export async function loadMinionModel(color: MinionColorVariant): Promise<THREE.Object3D> {
  let pending = variants.get(color);
  if (!pending) {
    pending = Promise.all([
      loader.load(WORLD_ASSET_DEFINITIONS['minion.imp'].runtime),
      textures.loadAsync(loader.url(WORLD_ASSET_DEFINITIONS[variantKeys[color]].runtime))
    ]).then(([gltf, texture]) => {
      texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
      const materials = new Map<THREE.Material, THREE.Material>();
      const template = clone(gltf.scene);
      template.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const convert = (source: THREE.Material): THREE.Material => {
          let material = materials.get(source);
          if (!material) {
            material = source.clone();
            if (material instanceof THREE.MeshStandardMaterial) material.map = texture;
            materials.set(source, material);
          }
          return material;
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      });
      return template;
    });
    variants.set(color, pending);
  }
  return clone(await pending);
}

export async function loadPitModel(): Promise<THREE.Object3D> {
  return (await loader.load(WORLD_ASSET_DEFINITIONS['landmark.summoningPit'].runtime)).scene.clone(true);
}

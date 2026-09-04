import * as THREE from 'three';
import type { TerrainProfile } from '../../data/world/WorldLayout';
import { WorldAssetLibrary } from './WorldAssetLibrary';

export type WorldMaterialSet = {
  readonly terrain: Readonly<Record<TerrainProfile, THREE.MeshStandardMaterial>>;
  readonly trail: THREE.MeshStandardMaterial;
  readonly cobble: THREE.MeshStandardMaterial;
  readonly water: THREE.MeshPhysicalMaterial;
  readonly cliff: THREE.MeshStandardMaterial;
  readonly lockedGate: THREE.MeshStandardMaterial;
};

async function tiledMaterial(
  assets: WorldAssetLibrary,
  colorKey: 'terrain.meadowColor' | 'terrain.forestColor' | 'terrain.trailColor' | 'terrain.cobbleColor',
  normalKey: 'terrain.meadowNormal' | 'terrain.forestNormal' | 'terrain.trailNormal' | 'terrain.cobbleNormal',
  repeat: number,
  tint: number,
): Promise<THREE.MeshStandardMaterial> {
  const [sourceMap, sourceNormal] = await Promise.all([assets.loadTexture(colorKey), assets.loadTexture(normalKey)]);
  const map = sourceMap.clone();
  const normalMap = sourceNormal.clone();
  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.4, 0.4), color: tint, roughness: 0.92, metalness: 0 });
}

export async function createWorldMaterials(assets: WorldAssetLibrary): Promise<WorldMaterialSet> {
  const [meadow, forest, trail, cobble] = await Promise.all([
    tiledMaterial(assets, 'terrain.meadowColor', 'terrain.meadowNormal', 12, 0xb8c59e),
    tiledMaterial(assets, 'terrain.forestColor', 'terrain.forestNormal', 11, 0x9baa87),
    tiledMaterial(assets, 'terrain.trailColor', 'terrain.trailNormal', 5, 0xcdbb91),
    tiledMaterial(assets, 'terrain.cobbleColor', 'terrain.cobbleNormal', 14, 0xc4beb0),
  ]);
  const transitionMeadow = meadow.clone();
  transitionMeadow.color.setHex(0xaebf91);
  const transitionFortress = cobble.clone();
  transitionFortress.color.setHex(0xa9a294);
  return {
    terrain: { meadow, forest, cobble, 'transition-meadow': transitionMeadow, 'transition-fortress': transitionFortress },
    trail,
    cobble,
    water: new THREE.MeshPhysicalMaterial({ color: 0x3e94a0, emissive: 0x163b40, emissiveIntensity: 0.3, roughness: 0.2, transmission: 0.16, transparent: true, opacity: 0.84, side: THREE.DoubleSide }),
    cliff: new THREE.MeshStandardMaterial({ color: 0x6f7569, roughness: 0.96 }),
    lockedGate: new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 0.82, metalness: 0.05 }),
  };
}

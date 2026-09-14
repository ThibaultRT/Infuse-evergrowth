import * as THREE from 'three';
import type { TerrainProfile } from '../../data/world/WorldLayout';
import { WorldAssetLibrary } from './WorldAssetLibrary';
import type { RenderScale } from '../RenderingQuality';
import type { BlockoutMaterial } from '../../data/world/area4';
import { createArea4Materials, type Area4MaterialSet } from './Area4TerrainView';

export type WorldMaterialSet = {
  readonly terrain: Readonly<Record<TerrainProfile, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>>;
  readonly trail: THREE.MeshStandardMaterial;
  readonly cobble: THREE.MeshStandardMaterial;
  readonly water: THREE.MeshPhysicalMaterial;
  readonly cliff: THREE.MeshStandardMaterial;
  readonly lockedGate: THREE.MeshStandardMaterial;
  readonly timber: THREE.MeshStandardMaterial;
  readonly blockout: Readonly<Record<BlockoutMaterial, THREE.MeshStandardMaterial>>;
  readonly ashTrail: THREE.MeshStandardMaterial;
  readonly abyss: THREE.MeshBasicMaterial;
  readonly area4: Area4MaterialSet;
};

/** Reduced mode avoids transmission's extra scene pass; Full restores the authored look. */
export function applyWorldMaterialQuality(materials: WorldMaterialSet, renderScale: RenderScale): void {
  const transmission = renderScale === .7 ? 0 : .16;
  const side = renderScale === .7 ? THREE.FrontSide : THREE.DoubleSide;
  if (materials.water.transmission === transmission && materials.water.side === side) return;
  materials.water.transmission = transmission;
  materials.water.side = side;
  materials.water.needsUpdate = true;
}

async function tiledMaterial(
  assets: WorldAssetLibrary,
  colorKey: 'terrain.meadowColor' | 'terrain.forestColor' | 'terrain.trailColor' | 'terrain.cobbleColor',
  normalKey: 'terrain.meadowNormal' | 'terrain.forestNormal' | 'terrain.trailNormal' | 'terrain.cobbleNormal',
  repeat: number,
  tint: number,
): Promise<THREE.MeshStandardMaterial> {
  const load = async (key: typeof colorKey | typeof normalKey): Promise<THREE.Texture | null> => {
    try { return (await assets.loadTexture(key)).clone(); }
    catch (error) { console.warn(`World texture ${key} unavailable; using an untextured material.`, error); return null; }
  };
  const [map, normalMap] = await Promise.all([load(colorKey), load(normalKey)]);
  for (const texture of [map, normalMap]) {
    if (!texture) continue;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
  }
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.4, 0.4), color: tint, roughness: 0.92, metalness: 0 });
}

export async function createWorldMaterials(assets: WorldAssetLibrary): Promise<WorldMaterialSet> {
  const [meadow, forest, trail, cobble] = await Promise.all([
    tiledMaterial(assets, 'terrain.meadowColor', 'terrain.meadowNormal', 12, 0xb8c59e),
    tiledMaterial(assets, 'terrain.forestColor', 'terrain.forestNormal', 11, 0x626c50),
    tiledMaterial(assets, 'terrain.trailColor', 'terrain.trailNormal', 5, 0xcdbb91),
    tiledMaterial(assets, 'terrain.cobbleColor', 'terrain.cobbleNormal', 14, 0xc4beb0),
  ]);
  const transitionMeadow = meadow.clone();
  transitionMeadow.color.setHex(0xaebf91);
  const transitionFortress = cobble.clone();
  transitionFortress.color.setHex(0xa9a294);
  const abyss = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false });
  const area4 = createArea4Materials();
  return {
    terrain: { meadow, forest, cobble, 'transition-meadow': transitionMeadow, 'transition-fortress': transitionFortress,
      ash: area4.ground, rift: abyss },
    area4,
    trail,
    cobble,
    water: new THREE.MeshPhysicalMaterial({ color: 0x3e94a0, emissive: 0x163b40, emissiveIntensity: 0.3, roughness: 0.2, transmission: 0.16, transparent: true, opacity: 0.84, side: THREE.DoubleSide }),
    cliff: new THREE.MeshStandardMaterial({ color: 0x6f7569, roughness: 0.96 }),
    lockedGate: new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 0.82, metalness: 0.05 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x977047, roughness: 0.86 }),
    ashTrail: new THREE.MeshStandardMaterial({ color: 0x8c7a69, roughness: 1 }),
    abyss,
    blockout: {
      ash: new THREE.MeshStandardMaterial({ color: 0x242326, roughness: 1 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x8d8582, roughness: 1 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x46525a, roughness: 0.7, metalness: 0.5 }),
      timber: new THREE.MeshStandardMaterial({ color: 0x785438, roughness: 1 }),
      lava: new THREE.MeshStandardMaterial({ color: 0xff691c, emissive: 0xff3a08, emissiveIntensity: 0.75, roughness: 1 }),
    },
  };
}

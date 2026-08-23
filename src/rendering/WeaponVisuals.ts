import * as THREE from 'three';
import type { DamageType, EquipmentRarity, WeaponClass, WeaponDefinition } from '../types';

const RARITY: Record<EquipmentRarity, number> = { common: 0xaeb5ae, uncommon: 0x68b86d, rare: 0x5c90d9, epic: 0xa66ed1, legendary: 0xe7b94e };

/** Stable cosmetic mapping kept separate from equipment damage/progression data. */
export function equipmentVisualId(item: WeaponDefinition): string { return `weapon:${item.weaponClass}:${item.rarity}`; }

export function makeWeaponVisual(weaponClass: WeaponClass, rarity: EquipmentRarity): THREE.Group {
  const root = new THREE.Group();
  root.name = `weapon:${weaponClass}:${rarity}`;
  // Hand attachments face local +Z, while the procedural weapons are authored toward -Z.
  root.rotation.y = Math.PI;
  const metal = new THREE.MeshStandardMaterial({ color: RARITY[rarity], metalness: .62, roughness: .3 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x56371f, roughness: .82 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, weaponClass === 'spear' ? 1.75 : .7, 8), wood);
  shaft.rotation.x = Math.PI / 2;
  if (weaponClass === 'sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.1, .035, 1.05), metal); blade.position.z = -.78;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(.42, .07, .08), metal); guard.position.z = -.22;
    root.add(blade, guard, shaft);
  } else if (weaponClass === 'hammer') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(.55, .28, .3), metal); head.position.z = -.45;
    root.add(head, shaft);
  } else {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.1, .42, 6), metal); tip.rotation.x = -Math.PI / 2; tip.position.z = -1.08;
    root.add(tip, shaft);
  }
  return root;
}

export function attackStyle(type: DamageType): { arc: number; reach: number } {
  if (type === 'blunt') return { arc: 1.15, reach: .18 };
  if (type === 'slash') return { arc: .9, reach: .08 };
  return { arc: .18, reach: .5 };
}

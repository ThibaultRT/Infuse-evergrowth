import * as THREE from 'three';
import { makeHumanoid } from '../visuals';
import { AnimatedHumanoidView } from './AnimatedHumanoidView';
import type { DamageType, EquipmentSlotId, InventoryState } from '../types';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { attackStyle, makeWeaponVisual } from './WeaponVisuals';

const RANGER = 'characters/models/Male_Ranger.gltf';

function handFocus(color: number): THREE.Mesh {
  const focus = new THREE.Mesh(
    new THREE.OctahedronGeometry(.055),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .3, roughness: .5 })
  );
  focus.name = 'independent-hand-attachment';
  return focus;
}

export class HeroView extends AnimatedHumanoidView {
  private targetFacing = 0;
  private inventory: InventoryState | null = null;
  private readonly weaponRoots: Record<'left' | 'right', THREE.Group> = { left: new THREE.Group(), right: new THREE.Group() };
  private readonly attackTime: Record<'hand1' | 'hand2', number> = { hand1: 0, hand2: 0 };
  private readonly attackType: Record<'hand1' | 'hand2', DamageType> = { hand1: 'blunt', hand2: 'blunt' };
  readonly orbitRoot = new THREE.Group();
  private orbitWeapons: Partial<Record<'orbit1' | 'orbit2', THREE.Object3D>> = {};
  private orbitFlights: Partial<Record<'orbit1' | 'orbit2', { target: THREE.Vector3; progress: number }>> = {};

  constructor() {
    super(makeHumanoid(0x2f3540, true));
    this.root.add(this.orbitRoot);
    void this.loadModel(RANGER);
  }

  setFacing(radians: number): void { this.targetFacing = radians; }

  update(dt: number, moving: boolean, active = true): void {
    this.root.rotation.y = THREE.MathUtils.lerp(this.root.rotation.y, this.targetFacing, 1 - Math.exp(-14 * dt));
    this.setMotion(moving ? 'jog' : 'idle');
    this.updateAnimation(dt, active);
    for (const slot of ['hand1', 'hand2'] as const) {
      this.attackTime[slot] = Math.max(0, this.attackTime[slot] - dt * 4.5);
      const style = attackStyle(this.attackType[slot]);
      const phase = Math.sin(this.attackTime[slot] * Math.PI);
      const root = slot === 'hand1' ? this.weaponRoots.right : this.weaponRoots.left;
      root.rotation.y = (slot === 'hand1' ? -1 : 1) * style.arc * phase;
      root.position.z = -style.reach * phase;
    }
    this.updateOrbits(dt);
  }

  syncEquipment(inventory: InventoryState): void {
    this.inventory = inventory;
    for (const [slot, side] of [['hand1', 'right'], ['hand2', 'left']] as const) {
      const root = this.weaponRoots[side]; root.clear();
      const item = EQUIPMENT_BY_ID.get(inventory.equipped[slot] ?? '');
      if (item) root.add(makeWeaponVisual(item.weaponClass, item.rarity));
    }
    this.orbitRoot.clear(); this.orbitWeapons = {};
    for (const [index, slot] of (['orbit1', 'orbit2'] as const).entries()) {
      const item = EQUIPMENT_BY_ID.get(inventory.equipped[slot] ?? '');
      if (!item) continue;
      const weapon = makeWeaponVisual(item.weaponClass, item.rarity); weapon.scale.setScalar(.85);
      this.orbitRoot.add(weapon); this.orbitWeapons[slot] = weapon; weapon.userData.orbitIndex = index;
    }
  }

  playWeaponAttack(slot: EquipmentSlotId, type: DamageType, target: THREE.Vector3): void {
    if (slot === 'hand1' || slot === 'hand2') { this.attackType[slot] = type; this.attackTime[slot] = 1; }
    else this.orbitFlights[slot] = { target: this.root.worldToLocal(target.clone()), progress: 0 };
  }

  protected override async onModelReady(): Promise<void> {
    this.root.add(this.orbitRoot);
    this.weaponRoots.left.add(handFocus(0x63d9ff)); this.weaponRoots.right.add(handFocus(0xffc457));
    this.attach('left', this.weaponRoots.left); this.attach('right', this.weaponRoots.right);
    if (this.inventory) this.syncEquipment(this.inventory);
  }

  private updateOrbits(dt: number): void {
    const time = performance.now() * .001;
    for (const [slot, weapon] of Object.entries(this.orbitWeapons) as ['orbit1' | 'orbit2', THREE.Object3D][]) {
      const index = weapon.userData.orbitIndex as number; const angle = time * 1.4 + index * Math.PI;
      const home = new THREE.Vector3(Math.cos(angle) * 1.15, 1.35 + Math.sin(time * 2 + index) * .08, Math.sin(angle) * 1.15);
      const flight = this.orbitFlights[slot];
      if (flight) {
        flight.progress = Math.min(1, flight.progress + dt * 2.8);
        const travel = Math.sin(flight.progress * Math.PI);
        weapon.position.copy(home).lerp(flight.target, travel);
        if (flight.progress === 1) delete this.orbitFlights[slot];
      } else weapon.position.copy(home);
      weapon.rotation.y += dt * 2;
    }
  }
}

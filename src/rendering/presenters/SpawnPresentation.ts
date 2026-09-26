import * as THREE from 'three';
import { TIER_CONFIG, areaById } from '../../config';
import type { CombatAffinity, DamageType, SpawnDefinition, TierConfig, WeaponSlotId, SaveData } from '../../types';
import { makeTierRing } from '../../visuals';
import { CrystalView } from '../CrystalView';
import { EnemyView } from '../EnemyView';
import type { GameplayRuntime, RuntimeSpawn } from '../../game/GameplayRuntime';
import type { SoulCatcherSystem } from '../../systems/SoulCatcherSystem';
import type { EffectManager } from '../EffectManager';
import type { WorldUiManager } from '../WorldUiManager';
import { formatRewardAmount, lootIcon, weaponCombatIcon, WEAPON_DAMAGE_TEXT_OFFSET } from './CombatLabels';

type SpawnPresentationContext = { runtime: GameplayRuntime; state: SaveData; souls: SoulCatcherSystem; scene: THREE.Scene; host: HTMLElement; effects: EffectManager; worldUi: WorldUiManager };

export class SpawnPresentation {
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly weakness: CombatAffinity | null;
  readonly targetUi = document.createElement('div');
  readonly lootLabel = document.createElement('div');
  readonly healthBar = document.createElement('div');
  readonly healthFill = document.createElement('span');
  readonly healthValue = document.createElement('strong');
  enemyView: EnemyView | null = null;
  crystalView: CrystalView | null = null;
  presentationActive = false;
  deathPresentationRemaining = 0;
  readonly state: RuntimeSpawn;

  constructor(readonly def: SpawnDefinition, private readonly context: SpawnPresentationContext) {
    this.state = this.context.runtime.spawnById.get(def.id)!;
    this.config = TIER_CONFIG[def.tier];
    this.weakness = def.enemyWeakness === undefined ? areaById(def.areaId).enemyWeakness : def.enemyWeakness;
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.targetUi.className = `world-target-ui rarity-${def.tier}`;
    this.lootLabel.className = 'world-loot';
    this.healthBar.className = 'world-hp-bar';
    this.healthValue.className = 'world-hp-value';
    this.healthBar.append(this.healthFill, this.healthValue);
    this.targetUi.append(this.lootLabel, this.healthBar);
    this.renderLoot();
    this.renderHealth();
    this.syncAreaVisibility();
  }

  dispose(): void { this.setPresentationActive(false); this.targetUi.remove(); }

  get alive(): boolean { return this.state.alive; }
  get hp(): number { return this.state.hp; }
  get maxHp(): number { return this.state.maxHp; }
  setPresentationActive(active: boolean): void {
    if (active === this.presentationActive) return;
    this.presentationActive = active;
    if (active) {
      this.enemyView = this.def.tier === 'crystal' ? null : new EnemyView(this.def.tier, this.config.color);
      this.crystalView = this.def.tier === 'crystal' ? new CrystalView(this.config.color, this.def.areaId) : null;
      this.root.add(this.enemyView?.root ?? this.crystalView!.root, makeTierRing(this.config.color));
      this.context.scene.add(this.root);
      this.context.host.append(this.targetUi);
      this.syncTransform();
      this.renderHealth();
    } else {
      this.root.removeFromParent();
      this.enemyView?.dispose();
      this.crystalView?.dispose();
      this.root.clear();
      this.targetUi.remove();
      this.enemyView = null;
      this.crystalView = null;
    }
    this.syncAreaVisibility();
  }
  renderLoot(): void {
    const reward = this.context.state.spawns[this.def.id].roll.reward;
    const loot = reward.stat;
    this.lootLabel.className = `world-loot ${loot}`;
    const soul = this.context.souls.yieldFor(this.def);
    this.lootLabel.innerHTML = `<span>${formatRewardAmount(reward.amount)}</span>${lootIcon(loot)}${soul ? `<span class="world-soul-reward"><span>${soul.quantity}</span><i class="soul-icon soul-${soul.soulType}"></i></span>` : ''}`;
  }

  renderHealth(): void {
    const hp = Math.max(0, this.hp);
    this.healthFill.style.width = `${(hp / this.maxHp) * 100}%`;
    this.healthValue.textContent = String(Math.ceil(hp));
    this.healthBar.setAttribute('aria-label', `${Math.ceil(hp)} of ${this.maxHp} health`);
  }

  syncAreaVisibility(): void {
    const visible = this.presentationActive && (this.alive || this.deathPresentationRemaining > 0);
    this.root.visible = visible;
    this.targetUi.classList.toggle('hidden', !this.presentationActive || !this.alive);
  }

  presentRespawn(): void {
    this.deathPresentationRemaining = 0;
    this.crystalView?.reset();
    this.renderLoot();
    this.renderHealth();
    this.syncTransform();
    this.syncAreaVisibility();
  }

  resetAfterHeroDefeat(): void { this.renderHealth(); this.syncTransform(); }
  distanceToHero(): number { return this.context.runtime.distanceFromHero(this.state.position); }

  presentDamage(amount: number, type: DamageType, itemId: string, slot: WeaponSlotId): void {
    this.renderHealth();
    if (!this.presentationActive) return;
    this.context.effects.impact(this.root.position, type);
    this.enemyView?.playHit();
    this.context.worldUi.addCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), `<span>-${Math.round(amount)}</span>${weaponCombatIcon(itemId)}`, false, WEAPON_DAMAGE_TEXT_OFFSET[slot]);
  }

  presentDefeat(): void {
    if (!this.presentationActive) return;
    this.enemyView?.playDeath();
    this.crystalView?.playDeath();
    this.deathPresentationRemaining = this.crystalView ? .45 : 1.1;
    this.syncAreaVisibility();
  }

  syncTransform(): void {
    const previousX = this.root.position.x;
    const previousZ = this.root.position.z;
    this.root.position.copy(this.state.position);
    if (this.state.moving) this.root.rotation.y = Math.atan2(this.root.position.x - previousX, this.root.position.z - previousZ);
  }

  updateView(dt: number): void {
    this.crystalView?.update(dt);
    if (this.deathPresentationRemaining > 0) {
      this.deathPresentationRemaining = Math.max(0, this.deathPresentationRemaining - dt);
      if (this.deathPresentationRemaining === 0) this.syncAreaVisibility();
    }
    this.enemyView?.update(dt, this.state.moving, this.presentationActive && (this.alive || this.deathPresentationRemaining > 0));
  }
}

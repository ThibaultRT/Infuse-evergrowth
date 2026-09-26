import * as THREE from 'three';
import { areaById } from '../../config';
import { showEquipmentDrop, showSoulDrop, showStatGain, showToast } from '../../ui';
import { attackProfile } from '../../systems/EquipmentSystem';
import { equipmentDropCopiesRequired } from '../../systems/HudProjection';
import { showCombatText, showEvadedCombatText } from './CombatLabels';
import type { WeaponSlotId } from '../../types';
import type { GameSession } from '../../game/GameSession';
import type { HeroView } from '../HeroView';
import type { SpawnPresentation } from './SpawnPresentation';
import type { GatePresentation } from './GatePresentation';
import type { MinionPresentation } from '../MinionPresentation';
import type { BossPresentation } from './BossPresentation';
import type { CameraController } from '../../controllers/CameraController';
import type { InputController } from '../../controllers/InputController';
import type { EffectManager } from '../EffectManager';
import type { WorldUiManager } from '../WorldUiManager';

type Context = { session: GameSession; heroView: HeroView; entities: SpawnPresentation[]; gates: GatePresentation[];
  minions: MinionPresentation; boss: BossPresentation; camera: CameraController; input: InputController; effects: EffectManager; worldUi: WorldUiManager };

/** Projects gameplay events; it never advances or mutates progression. */
export class CombatPresentation {
  private heroDeathHidden = false;
  private readonly subscriptions: (() => void)[] = [];
  constructor(private readonly context: Context) {
    const { session, heroView, entities, gates: gateEntities, minions: minionPresentation, boss: bossPresentation, camera: cameraController, input, effects, worldUi } = context;
    const { events, runtime: gameplay, state: save } = session, hero = heroView.root;
    for (const event of ['equipmentEquipped', 'equipmentUnequipped'] as const) this.subscriptions.push(events.on(event, () => heroView.syncEquipment(save.inventory)));
    const entityById = new Map(entities.map((entity) => [entity.def.id, entity]));
    this.subscriptions.push(events.on('enemyDamaged', ({ enemyId, owner, amount, damageType, itemId, slot }) => {
      const entity = entityById.get(enemyId);
      entity?.presentDamage(amount, damageType, itemId, slot);
      if (owner.kind === 'minion' && entity) minionPresentation.attack(owner.minionId, entity.state.position);
    }));
    this.subscriptions.push(events.on('minionDamaged', ({ minionId }) => minionPresentation.damaged(minionId)));
    this.subscriptions.push(events.on('minionDefeated', ({ minionId }) => minionPresentation.remove(minionId)));
    this.subscriptions.push(events.on('minionInfused', ({ minionId }) => minionPresentation.remove(minionId)));
    this.subscriptions.push(events.on('enemyDefeated', ({ enemyId }) => entityById.get(enemyId)?.presentDefeat()));
    this.subscriptions.push(events.on('enemyRespawned', ({ enemyId }) => entityById.get(enemyId)?.presentRespawn()));
    this.subscriptions.push(events.on('weaponAttacked', ({ slot, targetId }) => {
      const profile = attackProfile(save, slot as WeaponSlotId);
      const target = gameplay.spawnById.get(targetId);
      if (profile && target) heroView.playWeaponAttack(slot as WeaponSlotId, new THREE.Vector3().copy(target.position), profile.cooldownSeconds);
    }));
    this.subscriptions.push(events.on('statGained', ({ sourceId, stat, amount }) => { if (entityById.get(sourceId)?.presentationActive) showStatGain(amount, stat === 'hp' ? 'HP' : stat === 'regen' ? 'HP/S' : stat.toUpperCase()); }));
    this.subscriptions.push(events.on('equipmentDropped', (drop) => { if (entityById.get(drop.sourceId)?.presentationActive) showEquipmentDrop({ ...drop, copiesRequired: equipmentDropCopiesRequired(drop.itemId, drop.ascend) }); }));
    this.subscriptions.push(events.on('soulDropped', ({ sourceId, quantity, soulType }) => { if (entityById.get(sourceId)?.presentationActive) showSoulDrop(quantity, soulType); }));
    this.subscriptions.push(events.on('bossDefeated', (event) => { if (entityById.get(event.bossId)?.presentationActive) bossPresentation.presentBossDefeat(event); }));
    this.subscriptions.push(events.on('gateUnlocked', ({ gateId }) => gateEntities.find((gate) => gate.def.id === gateId)?.setOpen(true)));
    this.subscriptions.push(events.on('dailyReset', () => showToast('Daily reset · all spawns restored')));
    this.subscriptions.push(events.on('heroEvaded', () => showEvadedCombatText(worldUi, hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)))));
    this.subscriptions.push(events.on('heroDamaged', ({ amount, damageType, blocked }) => showCombatText(worldUi, hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), amount, damageType, true, blocked)));
    this.subscriptions.push(events.on('heroDefeated', () => {
      this.heroDeathHidden = false; hero.visible = true; heroView.playDeath(); input.reset();
      entities.forEach((entity) => entity.resetAfterHeroDefeat());
      showToast('Defeated · respawning in 5 seconds');
    }));
    this.subscriptions.push(events.on('heroResurrected', () => {
      hero.position.copy(gameplay.hero.position); hero.visible = true; this.heroDeathHidden = false;
      cameraController.returnToHero(); effects.resurrection(hero.position);
    }));
    this.subscriptions.push(events.on('heroProgressReset', () => heroView.syncEquipment(save.inventory)));
    for (const event of ['soulNodePurchased', 'soulCatcherReset'] as const) this.subscriptions.push(events.on(event, () => entities.forEach((entity) => entity.renderLoot())));

  }
  dispose(): void { this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe()); }
  update(dt: number): void {
    const { session, heroView, camera: cameraController } = this.context, gameplay = session.runtime, hero = heroView.root;
    hero.position.copy(gameplay.hero.position);
    if (gameplay.hero.dead) {
      heroView.update(dt, false);
      if (!this.heroDeathHidden && heroView.deathAnimationFinished) {
        this.heroDeathHidden = true;
        hero.visible = false;
        const area = areaById(gameplay.currentAreaId);
        cameraController.focus(new THREE.Vector3(area.originX, 0, area.originZ), gameplay.hero.respawnRemaining * 1000);
      }
      return;
    }
    heroView.setFacing(gameplay.hero.facing);
    heroView.update(dt, gameplay.hero.moving);
  }

}

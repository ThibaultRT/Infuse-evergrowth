import { AREAS, BASE_RESPAWN_MS, BLOCKED_DAMAGE_MULTIPLIER, ENEMY_AGGRO_RADIUS_METERS, ENEMY_ATTACK_COOLDOWN, ENEMY_ATTACK_RANGE_METERS, ENEMY_LEASH_RADIUS_METERS, ENEMY_POSITIONING_RANGE_METERS, HERO_ATTACK_RANGE_METERS, HERO_COMBAT_EXIT_DELAY_SECONDS, HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER, HERO_RESPAWN_DELAY_MS, SPAWNS, TIER_CONFIG, WORLD_CONNECTIONS, areaById } from '../config';
import { localDailyKey, nextLocalMidnightMs } from '../domain/time/LocalCalendar';
import type { CombatAffinity, SaveData, SpawnDefinition, WeaponSlotId } from '../types';
import { CombatSystem } from '../systems/CombatSystem';
import { attackProfile, equippedDefense } from '../systems/EquipmentSystem';
import { heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroEvasionChance, heroRegen, heroSpeed, maxHeroHp } from '../systems/HeroStats';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { RespawnSystem } from '../systems/RespawnSystem';
import { SoulCatcherSystem } from '../systems/SoulCatcherSystem';
import { createProgressionSnapshot, type ProgressionSnapshot } from '../systems/ProgressionSnapshot';
import { MinionSystem } from '../systems/MinionSystem';
import { MinionAISystem } from '../systems/MinionAISystem';
import { statTotal } from '../domain/stats/StatSources';
import { AUTOSAVE_INTERVAL_MS } from '../config';
import { GameCommands } from './GameCommands';
import { GameEvents } from './GameEvents';
import { GameplayRuntime } from './GameplayRuntime';
import { browserClock, type GameClock } from './PlatformAdapters';

/** Authoritative gameplay lifecycle. No views, DOM, cameras, or panel state. */
export class GameSession {
  readonly runtime: GameplayRuntime;
  readonly commands: GameCommands;
  readonly soulCatcher: SoulCatcherSystem;
  readonly minions: MinionSystem;
  readonly minionAI: MinionAISystem;
  private readonly combat: CombatSystem;
  private readonly respawns: RespawnSystem;
  private readonly progression: ProgressionSystem;
  private healthPersistSeconds = 0;
  private saveDirty = true;
  private criticalSavePending = false;
  private updating = false;
  private lastSaveAt: number;
  private midnightSeconds = 0;
  private minionsPaused = false;
  private readonly subscriptions: (() => void)[] = [];

  constructor(readonly state: SaveData, readonly events: GameEvents, private readonly writeSave: () => void | boolean,
    private readonly clock: GameClock = browserClock, private readonly random = Math.random) {
    this.lastSaveAt = clock.now();
    this.respawns = new RespawnSystem(random);
    this.minions = new MinionSystem(state, random);
    this.minions.reviveDue(clock.now());
    this.soulCatcher = new SoulCatcherSystem(state, events, () => this.persist(true), (slotId) => this.minions.unlockSlot(slotId));
    for (const definition of SPAWNS) {
      this.respawns.reviveIfDue(state.spawns[definition.id], definition, clock.now());
    }
    this.runtime = new GameplayRuntime({
      areas: AREAS, connections: WORLD_CONNECTIONS, unlockedAreas: state.unlockedAreas,
      spawns: SPAWNS.map((definition) => ({ definition, tier: TIER_CONFIG[definition.tier],
        maxHp: state.spawns[definition.id].roll.maxHp, alive: !state.spawns[definition.id].respawnAt,
        damage: definition.attackDamage, damageType: areaById(definition.areaId).enemyWeapon })),
      minions: state.minions.roster,
      currentAreaId: state.currentAreaId, heroHp: Math.min(state.heroHp, maxHeroHp(state.stats)), heroSpeed: heroSpeed(state.stats),
      heroRespawnSeconds: HERO_RESPAWN_DELAY_MS / 1000, enemyAggroRadius: ENEMY_AGGRO_RADIUS_METERS,
      enemyLeashRadius: ENEMY_LEASH_RADIUS_METERS, enemyAttackRange: ENEMY_ATTACK_RANGE_METERS,
      enemyPositioningRange: ENEMY_POSITIONING_RANGE_METERS, enemyAttackCooldown: ENEMY_ATTACK_COOLDOWN,
    });
    this.commands = new GameCommands(state, this.runtime, events, () => this.persist(true), this.soulCatcher, this.minions);
    this.progression = new ProgressionSystem(state, events, (critical) => this.persist(critical), random, (rarity) => this.soulCatcher.equipmentQuantity(rarity),
      (definition) => this.soulCatcher.credit(definition), this.minions);
    this.minionAI = new MinionAISystem(state, this.runtime, random);
    this.subscriptions.push(events.on('minionInfused', ({ minionId }) => this.minionAI.remove(minionId)));
    const cooldown = (slot: WeaponSlotId): number => attackProfile(state, slot)?.cooldownSeconds ?? 0;
    this.combat = new CombatSystem({ orbit1: cooldown('orbit1') * .25, orbit2: cooldown('orbit2') * .5, orbit3: cooldown('orbit3') * .75 });
    this.subscriptions.push(events.on('heroProgressReset', () => this.soulCatcher.syncEffects()));
    const syncStats = (): void => {
      this.runtime.setHeroSpeed(heroSpeed(state.stats));
      this.runtime.hero.hp = Math.min(this.runtime.hero.hp, maxHeroHp(state.stats));
    };
    for (const event of ['statGained', 'equipmentEquipped', 'equipmentUnequipped', 'weaponAscended', 'soulNodePurchased', 'soulCatcherReset', 'heroProgressReset', 'minionInfused'] as const) this.subscriptions.push(events.on(event, syncStats));
  }

  /** Routine mutations only mark dirty; critical commands flush after a complete update. */
  persist(critical = false): void {
    this.state.heroHp = this.runtime.hero.hp;
    this.saveDirty = true;
    this.criticalSavePending ||= critical;
    if (critical && !this.updating) this.flushSave();
  }

  flushSave(): void {
    if (!this.saveDirty) return;
    this.state.heroHp = this.runtime.hero.hp;
    this.lastSaveAt = this.clock.now();
    this.criticalSavePending = false;
    this.saveDirty = this.writeSave() === false;
  }

  dispose(): void { this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe()); }

  /** Advance deadlines after suspension without simulating offline combat or movement. */
  resumeWallClock(elapsedSeconds: number): void {
    this.resetAtMidnightIfNeeded();
    this.reviveDueSpawns();
    for (const event of this.runtime.update(0, { x: 0, y: 0 }, false, elapsedSeconds, false)) {
      if (event.type !== 'heroRespawned') continue;
      this.runtime.hero.hp = maxHeroHp(this.state.stats);
      this.events.emit('heroResurrected', { areaId: event.areaId });
      this.persist();
    }
    for (const minionId of this.minions.reviveDue(this.clock.now())) {
      this.minionAI.respawned(minionId);
      this.events.emit('minionRespawned', { minionId });
      this.persist();
    }
  }

  progressionSnapshot(): ProgressionSnapshot {
    return createProgressionSnapshot(this.state, this.soulCatcher, this.minions, (id) => {
      const targetId = this.minionAI.targetId(id);
      const target = targetId ? this.runtime.spawnById.get(targetId) : null;
      return { mode: this.minionsPaused ? 'paused' : this.minionAI.mode(id), target: target?.alive
        ? { id: target.id, tier: target.definition.tier, hp: target.hp, maxHp: target.maxHp } : null };
    });
  }

  update(dt: number, movement: Readonly<{ x: number; y: number }>, elapsedSeconds = dt, minionsPaused = false): void {
    this.updating = true;
    try {
      this.saveDirty = true;
      this.minionsPaused = minionsPaused;
      this.combat.update(dt);
      this.midnightSeconds += dt;
      if (this.midnightSeconds >= 1) { this.midnightSeconds = 0; this.resetAtMidnightIfNeeded(); }
      // Panels and camera presentations never pause simulation or wall-clock timers.
      for (const event of this.runtime.update(dt, this.commands.movement({ type: 'move', ...movement }), true, elapsedSeconds, !minionsPaused)) {
        if (event.type === 'enemyAttack') {
          if (event.target.kind === 'hero') this.damageHero(event.amount, event.damageType);
          else this.damageMinion(event.target.minionId, event.amount, event.damageType);
        }
        else if (event.type === 'areaEntered') this.commands.execute({ type: 'enterArea', areaId: event.areaId, connectionId: event.connectionId });
        else {
          this.runtime.hero.hp = maxHeroHp(this.state.stats);
          this.events.emit('heroResurrected', { areaId: event.areaId });
          this.persist();
        }
      }
      this.reviveDueSpawns();
      this.autoAttack();
      for (const attack of minionsPaused ? [] : this.minionAI.update(dt)) {
        const minion = this.minions.find(attack.minionId), target = this.runtime.spawnById.get(attack.spawnId);
        if (!minion || minion.respawnAt !== null || !target?.alive) continue;
        const hit = this.runtime.damageSpawn(attack.spawnId, attack.amount, { kind: 'minion', minionId: minion.id });
        if (!hit) continue;
        this.events.emit('enemyDamaged', { enemyId: attack.spawnId, owner: { kind: 'minion', minionId: minion.id }, amount: attack.amount, damageType: attack.damageType, itemId: attack.itemId, slot: attack.slot });
        if (hit.defeated) {
          const definition = target.definition;
          this.progression.defeat(definition, TIER_CONFIG[definition.tier], this.runtime.hero, AREAS, WORLD_CONNECTIONS, this.clock.now(),
            BASE_RESPAWN_MS / this.soulCatcher.respawnDivisor(definition.tier), nextLocalMidnightMs(this.clock.date()), { kind: 'minion', minionId: minion.id });
          this.minionAI.afterKill(minion);
        }
      }
      const revivedMinions = this.minions.reviveDue(this.clock.now());
      if (revivedMinions.length) this.persist();
      for (const minionId of revivedMinions) { this.minionAI.respawned(minionId); this.events.emit('minionRespawned', { minionId }); }
      if (!this.runtime.hero.dead) {
        const multiplier = this.runtime.hero.combatRemainingSeconds > 0 ? 1 : HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER;
        this.runtime.hero.hp = Math.min(maxHeroHp(this.state.stats), this.runtime.hero.hp + heroRegen(this.state.stats) * multiplier * dt);
      }
      this.healthPersistSeconds += dt;
      if (this.healthPersistSeconds >= 1) {
        this.healthPersistSeconds = 0;
        this.persist();
        if (this.state.minions.roster.length) this.events.emit('minionVitalsChanged', undefined);
      }
    } finally {
      this.updating = false;
      if (this.criticalSavePending || this.clock.now() - this.lastSaveAt >= AUTOSAVE_INTERVAL_MS) this.flushSave();
    }
  }

  damageHero(amount: number, type: CombatAffinity): void {
    if (this.runtime.hero.dead) return;
    this.runtime.enterHeroCombat(HERO_COMBAT_EXIT_DELAY_SECONDS);
    if (this.combat.rollChance(heroEvasionChance(this.state.stats), this.random)) {
      this.events.emit('heroEvaded', { damageType: type });
      return;
    }
    const defended = this.combat.enemyAttackDamage(amount, type, (damageType) => equippedDefense(this.state, damageType), (damageType) => this.soulCatcher.resistance(damageType));
    const blocked = this.combat.rollChance(heroBlockChance(this.state.stats), this.random);
    const damage = defended * (blocked ? BLOCKED_DAMAGE_MULTIPLIER : 1);
    const defeated = this.runtime.damageHero(damage);
    this.events.emit('heroDamaged', { amount: damage, damageType: type, blocked });
    if (defeated) this.events.emit('heroDefeated', undefined);
    this.persist();
  }

  damageMinion(minionId: string, amount: number, type: CombatAffinity): void {
    const minion = this.minions.find(minionId);
    if (!minion || minion.respawnAt !== null) return;
    this.minionAI.damaged(minionId);
    if (this.combat.rollChance(heroEvasionChance(minion.stats), this.random)) return;
    const defended = this.combat.enemyAttackDamage(amount, type, (damageType) => equippedDefense(minion, damageType),
      (damageType) => statTotal(minion.stats.damageResistance[damageType]));
    const blocked = this.combat.rollChance(heroBlockChance(minion.stats), this.random);
    const damage = defended * (blocked ? BLOCKED_DAMAGE_MULTIPLIER : 1);
    this.runtime.damageMinion(minionId, damage);
    let respawnAt: number | null = null;
    if (minion.hp === 0) {
      respawnAt = this.minions.kill(minionId, this.clock.now());
      this.minionAI.died(minionId);
    }
    this.persist();
    this.events.emit('minionDamaged', { minionId, amount: damage, blocked });
    if (respawnAt !== null) this.events.emit('minionDefeated', { minionId, respawnAt });
  }

  private autoAttack(): void {
    if (this.runtime.hero.dead) return;
    for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
      if (!this.combat.ready(slot)) continue;
      const profile = attackProfile(this.state, slot);
      if (!profile) continue;
      const candidates = this.runtime.spawns.filter((spawn) => spawn.definition.areaId === this.runtime.currentAreaId).map((spawn) => ({
        spawn, alive: spawn.alive,
        weakness: spawn.definition.enemyWeakness === undefined ? areaById(spawn.definition.areaId).enemyWeakness : spawn.definition.enemyWeakness,
        distanceToHero: () => this.runtime.distanceFromHero(spawn.position),
      }));
      const target = this.combat.nearestTarget(candidates, HERO_ATTACK_RANGE_METERS);
      if (!target) continue;
      this.combat.schedule(slot, profile.cooldownSeconds);
      const critical = this.combat.rollChance(heroCriticalChance(this.state.stats), this.random);
      const amount = this.combat.heroAttackDamage(profile.damage * (critical ? heroCriticalDamageMultiplier(this.state.stats) : 1), profile.damageType, target.weakness);
      const hit = this.runtime.damageSpawn(target.spawn.id, amount, { kind: 'hero' });
      if (!hit) continue;
      if (target.spawn.hostile) this.runtime.enterHeroCombat(HERO_COMBAT_EXIT_DELAY_SECONDS);
      if (slot === 'hand1') {
        const dx = target.spawn.position.x - this.runtime.hero.position.x, dz = target.spawn.position.z - this.runtime.hero.position.z;
        if (dx !== 0 || dz !== 0) this.runtime.hero.facing = Math.atan2(dx, dz);
      }
      this.events.emit('weaponAttacked', { slot, targetId: target.spawn.id, damageType: profile.damageType, itemId: profile.itemId });
      this.events.emit('enemyDamaged', { enemyId: target.spawn.id, owner: { kind: 'hero' }, amount, damageType: profile.damageType, itemId: profile.itemId, slot });
      if (hit.defeated) {
        const definition = target.spawn.definition;
        this.progression.defeat(definition, TIER_CONFIG[definition.tier], this.runtime.hero, AREAS, WORLD_CONNECTIONS, this.clock.now(), BASE_RESPAWN_MS / this.soulCatcher.respawnDivisor(definition.tier), nextLocalMidnightMs(this.clock.date()));
      }
    }
  }

  private revive(definition: SpawnDefinition): void {
    this.runtime.setSpawnAlive(definition.id, true, this.state.spawns[definition.id].roll.maxHp);
    this.events.emit('enemyRespawned', { enemyId: definition.id });
  }

  reviveDueSpawns(): void {
    let changed = false;
    for (const spawn of this.runtime.spawns) {
      if (!spawn.alive && this.respawns.reviveIfDue(this.state.spawns[spawn.id], spawn.definition, this.clock.now())) {
        this.revive(spawn.definition); changed = true;
      }
    }
    if (changed) this.persist();
  }

  resetAtMidnightIfNeeded(): void {
    const key = localDailyKey(this.clock.date());
    if (this.state.dailyKey === key) return;
    this.state.dailyKey = key;
    for (const definition of SPAWNS) {
      const spawn = this.state.spawns[definition.id];
      spawn.killsToday = 0;
      this.respawns.reroll(spawn, definition);
      this.revive(definition);
    }
    this.events.emit('dailyReset', undefined);
    this.persist(true);
  }

  resetSpawnCooldowns(): number {
    let count = 0;
    for (const definition of SPAWNS) {
      const spawn = this.state.spawns[definition.id];
      if (!spawn.respawnAt) continue;
      this.respawns.reroll(spawn, definition);
      this.revive(definition); count++;
    }
    this.persist(true);
    return count;
  }
}

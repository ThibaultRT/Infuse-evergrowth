import { AREAS, BASE_RESPAWN_MS, BLOCKED_DAMAGE_MULTIPLIER, ENEMY_AGGRO_RADIUS_METERS, ENEMY_ATTACK_COOLDOWN, ENEMY_ATTACK_RANGE_METERS, ENEMY_LEASH_RADIUS_METERS, ENEMY_POSITIONING_RANGE_METERS, HERO_ATTACK_RANGE_METERS, HERO_RESPAWN_DELAY_MS, SPAWNS, TIER_CONFIG, WORLD_CONNECTIONS, areaById } from '../config';
import { localDailyKey, nextLocalMidnightMs } from '../save';
import type { CombatAffinity, SaveData, SpawnDefinition, WeaponSlotId } from '../types';
import { CombatSystem } from '../systems/CombatSystem';
import { attackProfile, equippedDefense } from '../systems/EquipmentSystem';
import { heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroEvasionChance, heroRegen, heroSpeed, maxHeroHp } from '../systems/HeroStats';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { RespawnSystem } from '../systems/RespawnSystem';
import { SoulCatcherSystem } from '../systems/SoulCatcherSystem';
import { GameCommands } from './GameCommands';
import { GameEvents } from './GameEvents';
import { GameplayRuntime } from './GameplayRuntime';
import { browserClock, type GameClock } from './PlatformAdapters';

/** Authoritative gameplay lifecycle. No views, DOM, cameras, or panel state. */
export class GameSession {
  readonly runtime: GameplayRuntime;
  readonly commands: GameCommands;
  readonly soulCatcher: SoulCatcherSystem;
  private readonly combat: CombatSystem;
  private readonly respawns: RespawnSystem;
  private readonly progression: ProgressionSystem;
  private healthPersistSeconds = 0;
  private midnightSeconds = 0;

  constructor(readonly state: SaveData, readonly events: GameEvents, private readonly writeSave: () => void,
    private readonly clock: GameClock = browserClock, private readonly random = Math.random) {
    this.respawns = new RespawnSystem(random);
    this.soulCatcher = new SoulCatcherSystem(state, events, () => this.persist());
    for (const definition of SPAWNS) {
      this.respawns.reviveIfDue(state.spawns[definition.id], definition, clock.now());
    }
    this.runtime = new GameplayRuntime({
      areas: AREAS, connections: WORLD_CONNECTIONS, unlockedAreas: state.unlockedAreas,
      spawns: SPAWNS.map((definition) => ({ definition, tier: TIER_CONFIG[definition.tier],
        maxHp: state.spawns[definition.id].roll.maxHp, alive: !state.spawns[definition.id].respawnAt,
        damage: definition.attackDamage, damageType: areaById(definition.areaId).enemyWeapon })),
      currentAreaId: state.currentAreaId, heroHp: Math.min(state.heroHp, maxHeroHp(state.stats)), heroSpeed: heroSpeed(state.stats),
      heroRespawnSeconds: HERO_RESPAWN_DELAY_MS / 1000, enemyAggroRadius: ENEMY_AGGRO_RADIUS_METERS,
      enemyLeashRadius: ENEMY_LEASH_RADIUS_METERS, enemyAttackRange: ENEMY_ATTACK_RANGE_METERS,
      enemyPositioningRange: ENEMY_POSITIONING_RANGE_METERS, enemyAttackCooldown: ENEMY_ATTACK_COOLDOWN,
    });
    this.commands = new GameCommands(state, this.runtime, events, () => this.persist(), this.soulCatcher);
    this.progression = new ProgressionSystem(state, events, () => this.persist(), random, (rarity) => this.soulCatcher.equipmentQuantity(rarity));
    const cooldown = (slot: WeaponSlotId): number => attackProfile(state, slot)?.cooldownSeconds ?? 0;
    this.combat = new CombatSystem({ orbit1: cooldown('orbit1') * .25, orbit2: cooldown('orbit2') * .5, orbit3: cooldown('orbit3') * .75 });
    events.on('heroProgressReset', () => this.soulCatcher.syncEffects());
    const syncStats = (): void => {
      this.runtime.setHeroSpeed(heroSpeed(state.stats));
      this.runtime.hero.hp = Math.min(this.runtime.hero.hp, maxHeroHp(state.stats));
    };
    for (const event of ['statGained', 'equipmentEquipped', 'equipmentUnequipped', 'weaponAscended', 'soulNodePurchased', 'soulCatcherReset', 'heroProgressReset'] as const) events.on(event, syncStats);
  }

  persist(): void { this.state.heroHp = this.runtime.hero.hp; this.writeSave(); }

  update(dt: number, movement: Readonly<{ x: number; y: number }>, elapsedSeconds = dt): void {
    this.combat.update(dt);
    this.midnightSeconds += dt;
    if (this.midnightSeconds >= 1) { this.midnightSeconds = 0; this.resetAtMidnightIfNeeded(); }
    // Panels and camera presentations never pause simulation or wall-clock timers.
    for (const event of this.runtime.update(dt, this.commands.movement({ type: 'move', ...movement }), true, elapsedSeconds)) {
      if (event.type === 'enemyAttack') this.damageHero(event.amount, event.damageType);
      else if (event.type === 'areaEntered') this.commands.execute({ type: 'enterArea', areaId: event.areaId, connectionId: event.connectionId });
      else {
        this.runtime.hero.hp = maxHeroHp(this.state.stats);
        this.events.emit('heroResurrected', { areaId: event.areaId });
        this.persist();
      }
    }
    this.reviveDueSpawns();
    this.autoAttack();
    if (!this.runtime.hero.dead) this.runtime.hero.hp = Math.min(maxHeroHp(this.state.stats), this.runtime.hero.hp + heroRegen(this.state.stats) * dt);
    this.healthPersistSeconds += dt;
    if (this.healthPersistSeconds >= 1) { this.healthPersistSeconds = 0; this.persist(); }
  }

  damageHero(amount: number, type: CombatAffinity): void {
    if (this.runtime.hero.dead) return;
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
      const hit = this.runtime.damageSpawn(target.spawn.id, amount);
      if (!hit) continue;
      if (slot === 'hand1') {
        const dx = target.spawn.position.x - this.runtime.hero.position.x, dz = target.spawn.position.z - this.runtime.hero.position.z;
        if (dx !== 0 || dz !== 0) this.runtime.hero.facing = Math.atan2(dx, dz);
      }
      this.events.emit('weaponAttacked', { slot, targetId: target.spawn.id, damageType: profile.damageType, itemId: profile.itemId });
      this.events.emit('enemyDamaged', { enemyId: target.spawn.id, amount, damageType: profile.damageType, itemId: profile.itemId, slot });
      if (hit.defeated) {
        const definition = target.spawn.definition;
        this.progression.defeat(definition, TIER_CONFIG[definition.tier], this.runtime.hero, AREAS, WORLD_CONNECTIONS, this.clock.now(), BASE_RESPAWN_MS / this.soulCatcher.respawnDivisor(definition.tier), nextLocalMidnightMs(this.clock.date()));
        this.soulCatcher.grant(definition);
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
    this.persist();
  }

  resetSpawnCooldowns(): number {
    let count = 0;
    for (const definition of SPAWNS) {
      const spawn = this.state.spawns[definition.id];
      if (!spawn.respawnAt) continue;
      this.respawns.reroll(spawn, definition);
      this.revive(definition); count++;
    }
    this.persist();
    return count;
  }
}

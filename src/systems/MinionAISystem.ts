import balance from '../data/balance.json';
import { areaById, ENEMY_AGGRO_RADIUS_METERS, HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER } from '../config';
import { recoveryComplete, shouldRecover } from '../domain/minions';
import { statTotal } from '../domain/stats/StatSources';
import { affinityDamage } from '../domain/combat/Affinity';
import { CombatSystem } from './CombatSystem';
import { attackProfile } from './EquipmentSystem';
import { heroCriticalChance, heroCriticalDamageMultiplier, heroRegen, heroSpeed } from './HeroStats';
import type { GameplayRuntime, RuntimeSpawn } from '../game/GameplayRuntime';
import type { DamageType, SavedMinion, SaveData, WeaponSlotId } from '../types';

export type MinionMode = 'seeking' | 'moving' | 'attacking' | 'recovering' | 'dead' | 'paused';
export type MinionAttack = { minionId: string; spawnId: string; amount: number; damageType: DamageType; slot: WeaponSlotId; itemId: string };
type Intent = { mode: MinionMode; targetId: string | null; path: { x: number; z: number }[]; waypoint: number; seekAfter: number; stuckFor: number;
  defendUntil: number; lastX: number; lastZ: number; combat: CombatSystem; routeKey: string };

/** Transient intent and independent attack schedules; live position/HP stay in GameplayRuntime's roster. */
export class MinionAISystem {
  private readonly intents = new Map<string, Intent>();
  private elapsed = 0;

  constructor(private readonly state: SaveData, private readonly runtime: GameplayRuntime, private readonly random: () => number) {}

  private intent(minion: SavedMinion): Intent {
    let intent = this.intents.get(minion.id);
    if (!intent) {
      intent = { mode: minion.respawnAt === null ? 'seeking' : 'dead', targetId: null, path: [], waypoint: 0, seekAfter: 0,
        stuckFor: 0, defendUntil: 0, lastX: minion.position.x, lastZ: minion.position.z, combat: new CombatSystem(), routeKey: '' };
      this.intents.set(minion.id, intent);
    }
    return intent;
  }

  mode(id: string): MinionMode { return this.intents.get(id)?.mode ?? 'seeking'; }
  targetId(id: string): string | null { return this.intents.get(id)?.targetId ?? null; }
  afterKill(minion: SavedMinion): void {
    const intent = this.intent(minion);
    intent.targetId = null; intent.path = []; intent.seekAfter = 0;
    intent.mode = shouldRecover(minion.hp, statTotal(minion.stats.maxHp)) ? 'recovering' : 'seeking';
  }
  damaged(id: string): void { const intent = this.intents.get(id); if (intent) { intent.defendUntil = this.elapsed + 3; intent.seekAfter = 0; intent.mode = 'seeking'; } }
  died(id: string): void { const intent = this.intents.get(id); if (intent) { intent.mode = 'dead'; intent.targetId = null; intent.path = []; } }
  respawned(id: string): void { this.intents.delete(id); }
  remove(id: string): void { this.intents.delete(id); }

  update(dt: number): MinionAttack[] {
    this.elapsed += dt;
    const attacks: MinionAttack[] = [];
    const routeKey = [...this.state.unlockedAreas].sort((a, b) => a - b).join(',');
    for (const minion of this.state.minions.roster.slice(0, balance.minions.activeCapacity)) {
      const intent = this.intent(minion);
      if (minion.respawnAt !== null || minion.hp <= 0) { intent.mode = 'dead'; continue; }
      intent.combat.update(dt);
      const maxHp = statTotal(minion.stats.maxHp);
      const threats = this.runtime.spawns.filter((spawn) => spawn.alive && spawn.hostile && spawn.definition.areaId === minion.areaId
        && Math.hypot(spawn.position.x - minion.position.x, spawn.position.z - minion.position.z) <= ENEMY_AGGRO_RADIUS_METERS)
        .sort((a, b) => Math.hypot(a.position.x - minion.position.x, a.position.z - minion.position.z)
          - Math.hypot(b.position.x - minion.position.x, b.position.z - minion.position.z) || a.id.localeCompare(b.id));
      const threatened = threats.length > 0 || intent.defendUntil > this.elapsed;
      if (intent.mode === 'recovering' && (recoveryComplete(minion.hp, maxHp) || threatened)) intent.mode = 'seeking';
      if (!threatened && minion.hp < maxHp * balance.minions.recoveryEndFraction && intent.mode !== 'recovering'
        && (shouldRecover(minion.hp, maxHp) || intent.targetId === null && intent.defendUntil > 0)) intent.mode = 'recovering';
      this.runtime.regenerateMinion(minion.id, heroRegen(minion.stats) * (intent.mode === 'recovering' ? HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER : 1) * dt);
      if (intent.mode === 'recovering') continue;
      const currentTarget = intent.targetId ? this.runtime.spawnById.get(intent.targetId) : null;
      const invalid = !currentTarget?.alive || routeKey !== intent.routeKey || intent.seekAfter <= this.elapsed;
      if (invalid) {
        const candidates = threats.length ? threats : this.runtime.spawns.filter((spawn) => spawn.alive);
        const route = candidates.length ? this.runtime.navigation.nearestRoute(minion.areaId, minion.position,
          candidates.map((spawn) => ({ id: spawn.id, areaId: spawn.definition.areaId, position: spawn.position })), this.state.unlockedAreas) : null;
        intent.targetId = route?.targetId ?? null; intent.path = route?.waypoints ?? []; intent.waypoint = 0;
        intent.seekAfter = this.elapsed + 1.5; intent.routeKey = routeKey; intent.stuckFor = 0;
      }
      const target = intent.targetId ? this.runtime.spawnById.get(intent.targetId) : null;
      if (!target?.alive) { intent.mode = 'seeking'; continue; }
      const distance = Math.hypot(target.position.x - minion.position.x, target.position.z - minion.position.z);
      if (target.definition.areaId === minion.areaId && distance <= balance.minions.attackRangeMeters) {
        intent.mode = 'attacking'; attacks.push(...this.attack(minion, intent, target));
        continue;
      }
      intent.mode = 'moving';
      while (intent.waypoint < intent.path.length && Math.hypot(intent.path[intent.waypoint].x - minion.position.x, intent.path[intent.waypoint].z - minion.position.z) < .35) intent.waypoint++;
      const waypoint = intent.path[intent.waypoint];
      if (!waypoint || !this.runtime.moveMinion(minion, waypoint, heroSpeed(minion.stats) * dt)) intent.stuckFor += dt;
      else if (Math.hypot(minion.position.x - intent.lastX, minion.position.z - intent.lastZ) > .1) intent.stuckFor = 0;
      intent.lastX = minion.position.x; intent.lastZ = minion.position.z;
      if (intent.stuckFor > 1.5) { intent.seekAfter = 0; intent.stuckFor = 0; }
    }
    return attacks;
  }

  private attack(minion: SavedMinion, intent: Intent, target: RuntimeSpawn): MinionAttack[] {
    const attacks: MinionAttack[] = [];
    for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
      if (!intent.combat.ready(slot)) continue;
      const profile = attackProfile(minion, slot);
      if (slot !== 'hand1' && !profile) continue;
      const damageType = profile?.damageType ?? 'blunt';
      const raw = profile?.damage ?? statTotal(minion.stats.attack.blunt);
      const cooldown = profile?.cooldownSeconds ?? balance.minions.innateAttackCooldownSeconds;
      intent.combat.schedule(slot, cooldown);
      const critical = intent.combat.rollChance(heroCriticalChance(minion.stats), this.random);
      const weakness = target.definition.enemyWeakness === undefined ? areaById(target.definition.areaId).enemyWeakness : target.definition.enemyWeakness;
      attacks.push({ minionId: minion.id, spawnId: target.id, amount: affinityDamage(raw * (critical ? heroCriticalDamageMultiplier(minion.stats) : 1), damageType, weakness),
        damageType, slot, itemId: profile?.itemId ?? 'innate-blunt' });
    }
    return attacks;
  }
}

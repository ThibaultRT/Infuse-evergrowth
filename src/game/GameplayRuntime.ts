import type { Position } from '../domain/world/Position';
import { copyPosition, distanceBetween } from '../domain/world/Position';
import { EnemyAISystem, type EnemyAIState } from '../systems/EnemyAISystem';
import type { AreaDefinition, CombatAffinity, SpawnDefinition, TierConfig } from '../types';

export type RuntimeSpawn = EnemyAIState & {
  id: string;
  definition: SpawnDefinition;
  position: Position;
  spawnPosition: Position;
  maxHp: number;
  hp: number;
  alive: boolean;
  moving: boolean;
  damage: number;
  damageType: CombatAffinity;
  hostile: boolean;
  speed: number;
};

export type RuntimeHero = {
  position: Position;
  hp: number;
  dead: boolean;
  respawnRemaining: number;
  moving: boolean;
  facing: number;
};

export type GameplayRuntimeEvent =
  | { type: 'enemyAttack'; spawnId: string; amount: number; damageType: CombatAffinity }
  | { type: 'heroRespawned'; areaId: number };

type SpawnRuntimeDefinition = {
  definition: SpawnDefinition;
  tier: TierConfig;
  maxHp: number;
  alive: boolean;
  damage: number;
  damageType: CombatAffinity;
};

export type GameplayRuntimeOptions = {
  areas: AreaDefinition[];
  spawns: SpawnRuntimeDefinition[];
  currentAreaId: number;
  heroHp: number;
  heroSpeed: number;
  heroRespawnSeconds: number;
  enemyAggroRadius: number;
  enemyLeashRadius: number;
  enemyAttackRange: number;
  enemyAttackCooldown: number;
};

/** Authoritative, renderer-independent live world state and movement/AI simulation. */
export class GameplayRuntime {
  readonly hero: RuntimeHero;
  readonly spawns: RuntimeSpawn[];
  readonly spawnById: ReadonlyMap<string, RuntimeSpawn>;
  currentAreaId: number;
  private readonly enemyAI: EnemyAISystem;

  constructor(private readonly options: GameplayRuntimeOptions) {
    this.currentAreaId = options.currentAreaId;
    const area = this.area(this.currentAreaId);
    this.hero = {
      position: { x: area.originX, y: 0, z: area.originZ },
      hp: options.heroHp,
      dead: false,
      respawnRemaining: 0,
      moving: false,
      facing: 0
    };
    this.spawns = options.spawns.map(({ definition, tier, maxHp, alive, damage, damageType }) => ({
      id: definition.id,
      definition,
      position: { x: definition.x, y: 0, z: definition.z },
      spawnPosition: { x: definition.x, y: 0, z: definition.z },
      maxHp,
      hp: maxHp,
      alive,
      provoked: false,
      attackCooldown: 0,
      moving: false,
      damage,
      damageType,
      hostile: tier.hostile,
      speed: Math.min(4.8, 2.4 + tier.statMultiplier * .18)
    }));
    this.spawnById = new Map(this.spawns.map((spawn) => [spawn.id, spawn]));
    this.enemyAI = new EnemyAISystem(options.enemyAggroRadius, options.enemyLeashRadius, options.enemyAttackRange);
  }

  update(dt: number, movement: Readonly<{ x: number; y: number }>, controlsEnabled: boolean, elapsedSeconds = dt): GameplayRuntimeEvent[] {
    const events: GameplayRuntimeEvent[] = [];
    if (this.hero.dead) {
      this.hero.moving = false;
      this.hero.respawnRemaining = Math.max(0, this.hero.respawnRemaining - elapsedSeconds);
      if (this.hero.respawnRemaining === 0) {
        const area = this.area(this.currentAreaId);
        this.hero.position = { x: area.originX, y: 0, z: area.originZ };
        this.hero.dead = false;
        events.push({ type: 'heroRespawned', areaId: this.currentAreaId });
      }
    } else this.updateHero(dt, movement, controlsEnabled);

    if (!controlsEnabled) return events;
    for (const spawn of this.spawns) {
      spawn.moving = false;
      if (!spawn.alive || spawn.definition.areaId !== this.currentAreaId || !spawn.hostile || this.hero.dead) continue;
      const distanceToHero = distanceBetween(spawn.position, this.hero.position);
      const distanceFromSpawn = distanceBetween(spawn.position, spawn.spawnPosition);
      const intent = this.enemyAI.update(spawn, distanceToHero, distanceFromSpawn, dt);
      if (intent === 'chase') this.moveTowards(spawn, this.hero.position, spawn.speed * dt);
      else if (intent === 'return') this.moveTowards(spawn, spawn.spawnPosition, 3 * dt);
      else if (intent === 'attack') {
        spawn.attackCooldown = this.options.enemyAttackCooldown;
        events.push({ type: 'enemyAttack', spawnId: spawn.id, amount: spawn.damage, damageType: spawn.damageType });
      } else if (!spawn.provoked) copyPosition(spawn.position, spawn.spawnPosition);
    }
    return events;
  }

  damageSpawn(id: string, amount: number): { hp: number; defeated: boolean } | null {
    const spawn = this.spawnById.get(id);
    if (!spawn?.alive || spawn.definition.areaId !== this.currentAreaId) return null;
    spawn.hp = Math.max(0, spawn.hp - amount);
    if (spawn.hostile) spawn.provoked = true;
    if (spawn.hp === 0) spawn.alive = false;
    return { hp: spawn.hp, defeated: spawn.hp === 0 };
  }

  setSpawnAlive(id: string, alive: boolean, maxHp?: number): void {
    const spawn = this.spawnById.get(id);
    if (!spawn) return;
    spawn.alive = alive;
    if (maxHp !== undefined) spawn.maxHp = maxHp;
    if (alive) {
      spawn.hp = spawn.maxHp;
      spawn.provoked = false;
      spawn.attackCooldown = 0;
      copyPosition(spawn.position, spawn.spawnPosition);
    }
  }

  resetEnemiesAfterHeroDefeat(): void {
    for (const spawn of this.spawns) {
      if (!spawn.alive) continue;
      spawn.hp = spawn.maxHp;
      spawn.provoked = false;
      spawn.attackCooldown = 0;
      copyPosition(spawn.position, spawn.spawnPosition);
    }
  }

  damageHero(amount: number): boolean {
    if (this.hero.dead) return false;
    this.hero.hp = Math.max(0, this.hero.hp - amount);
    if (this.hero.hp > 0) return false;
    this.hero.dead = true;
    this.hero.respawnRemaining = this.options.heroRespawnSeconds;
    this.hero.moving = false;
    this.resetEnemiesAfterHeroDefeat();
    return true;
  }

  enterArea(targetAreaId: number, crossedAdjacentBoundary: boolean): void {
    const previous = this.area(this.currentAreaId);
    const area = this.area(targetAreaId);
    this.currentAreaId = targetAreaId;
    if (crossedAdjacentBoundary) this.hero.position.z += area.originZ < previous.originZ ? -2.8 : 2.8;
    else this.hero.position = { x: area.originX, y: 0, z: area.originZ };
    for (const spawn of this.spawns) spawn.provoked = false;
  }

  distanceFromHero(position: Position): number { return distanceBetween(this.hero.position, position); }

  private updateHero(dt: number, movement: Readonly<{ x: number; y: number }>, controlsEnabled: boolean): void {
    this.hero.moving = controlsEnabled && (movement.x !== 0 || movement.y !== 0);
    if (!this.hero.moving) return;
    this.hero.position.x += movement.x * this.options.heroSpeed * dt;
    this.hero.position.z -= movement.y * this.options.heroSpeed * dt;
    const area = this.area(this.currentAreaId);
    this.hero.position.x = Math.min(area.originX + 17.2, Math.max(area.originX - 17.2, this.hero.position.x));
    this.hero.position.z = Math.min(area.originZ + 27.2, Math.max(area.originZ - 27.2, this.hero.position.z));
    this.hero.facing = Math.atan2(movement.x, -movement.y);
  }

  private moveTowards(spawn: RuntimeSpawn, target: Position, distance: number): void {
    const x = target.x - spawn.position.x;
    const z = target.z - spawn.position.z;
    const length = Math.hypot(x, z);
    if (length === 0) return;
    const step = Math.min(distance, length);
    spawn.position.x += x / length * step;
    spawn.position.z += z / length * step;
    spawn.moving = true;
  }

  private area(id: number): AreaDefinition {
    const area = this.options.areas.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }
}

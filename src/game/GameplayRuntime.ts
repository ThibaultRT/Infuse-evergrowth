import type { Position } from '../domain/world/Position';
import { copyPosition, distanceBetween } from '../domain/world/Position';
import { lakeBarrierBounds, lakeBarrierSegments } from '../domain/world/LakeBoundary';
import { EnemyAISystem, type EnemyAIState } from '../systems/EnemyAISystem';
import type { AreaDefinition, CombatAffinity, SpawnDefinition, TierConfig, WorldConnection } from '../types';

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
  | { type: 'heroRespawned'; areaId: number }
  | { type: 'areaEntered'; areaId: number; connectionId: string };

export type GameplaySnapshot = {
  areaId: number;
  hero: Readonly<RuntimeHero>;
  spawns: ReadonlyArray<Readonly<Pick<RuntimeSpawn, 'id' | 'position' | 'hp' | 'maxHp' | 'alive'>>>;
};

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
  connections: WorldConnection[];
  unlockedAreas: number[];
  spawns: SpawnRuntimeDefinition[];
  currentAreaId: number;
  heroHp: number;
  heroSpeed: number;
  heroRespawnSeconds: number;
  enemyAggroRadius: number;
  enemyLeashRadius: number;
  enemyAttackRange: number;
  enemyPositioningRange: number;
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
    this.enemyAI = new EnemyAISystem(options.enemyAggroRadius, options.enemyLeashRadius, options.enemyAttackRange, options.enemyPositioningRange);
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
    } else {
      const crossing = this.updateHero(dt, movement, controlsEnabled);
      if (crossing) events.push(crossing);
    }

    if (!controlsEnabled) return events;
    for (const spawn of this.spawns) {
      spawn.moving = false;
      if (!spawn.alive || spawn.definition.areaId !== this.currentAreaId || !spawn.hostile || this.hero.dead) continue;
      const distanceToHero = distanceBetween(spawn.position, this.hero.position);
      const distanceFromSpawn = distanceBetween(spawn.position, spawn.spawnPosition);
      const intent = this.enemyAI.update(spawn, distanceToHero, distanceFromSpawn, dt);
      if (intent === 'chase') { const previous = { ...spawn.position }; this.moveTowards(spawn, this.hero.position, spawn.speed * dt); this.constrainSpawn(spawn, previous); }
      else if (intent === 'return') { const previous = { ...spawn.position }; this.moveTowards(spawn, spawn.spawnPosition, 3 * dt); this.constrainSpawn(spawn, previous); }
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

  distanceFromHero(position: Position): number { return distanceBetween(this.hero.position, position); }

  snapshot(): GameplaySnapshot {
    return {
      areaId: this.currentAreaId,
      hero: { ...this.hero, position: { ...this.hero.position } },
      spawns: this.spawns.map(({ id, position, hp, maxHp, alive }) => ({ id, position: { ...position }, hp, maxHp, alive }))
    };
  }

  private updateHero(dt: number, movement: Readonly<{ x: number; y: number }>, controlsEnabled: boolean): GameplayRuntimeEvent | null {
    this.hero.moving = controlsEnabled && (movement.x !== 0 || movement.y !== 0);
    if (!this.hero.moving) return null;
    const previous = { ...this.hero.position };
    const candidate = { x: previous.x + movement.x * this.options.heroSpeed * dt, y: 0, z: previous.z - movement.y * this.options.heroSpeed * dt };
    const area = this.area(this.currentAreaId);
    const heroRadius = .45;
    const halfWidth = area.size.width / 2;
    const halfDepth = area.size.depth / 2;
    // Start resolving a boundary crossing when the hero's collision circle reaches
    // the edge. Waiting for the centre to leave the area made the normal clamp put
    // the hero back half a metre on every frame, so no gate could ever be crossed.
    const outsideX = Math.abs(candidate.x - area.originX) > halfWidth - heroRadius;
    const outsideZ = Math.abs(candidate.z - area.originZ) > halfDepth - heroRadius;
    if (outsideX || outsideZ) {
      const connection = this.options.connections.find((item) => {
        if (item.areaAId !== area.id && item.areaBId !== area.id) return false;
        if (!this.options.unlockedAreas.includes(item.requiredUnlockedAreaId)) return false;
        const coordinate = item.axis === 'x' ? candidate.z : candidate.x;
        const center = item.axis === 'x' ? item.z : item.x;
        const crossed = item.axis === 'x' ? outsideX : outsideZ;
        // Match the dry causeway's collision opening exactly. A looser crossing
        // tolerance let the hero enter the destination while clipping a lake end,
        // which looked like a teleport from the gate into the water.
        return crossed && Math.abs(coordinate - center) <= item.width / 2 - heroRadius;
      });
      if (connection) {
        const target = connection.areaAId === area.id ? connection.areaBId : connection.areaAId;
        const targetArea = this.area(target);
        // Adjacent chunks meet at the authored boundary. Accept the hero while its
        // circle straddles that shared edge, then let the destination clamp move it
        // fully inside on the following update.
        const targetHalfWidth = targetArea.size.width / 2 + heroRadius;
        const targetHalfDepth = targetArea.size.depth / 2 + heroRadius;
        if (Math.abs(candidate.x - targetArea.originX) <= targetHalfWidth && Math.abs(candidate.z - targetArea.originZ) <= targetHalfDepth) {
          this.hero.position = candidate;
          this.currentAreaId = target;
          for (const spawn of this.spawns) spawn.provoked = false;
          this.hero.facing = Math.atan2(movement.x, -movement.y);
          return { type: 'areaEntered', areaId: target, connectionId: connection.id };
        }
      }
    }
    this.constrainToLakeBank(candidate, area, heroRadius, previous);
    this.constrainToAuthoredCollision(candidate, previous, area, heroRadius);
    this.hero.position.x = Math.min(area.originX + halfWidth - heroRadius, Math.max(area.originX - halfWidth + heroRadius, candidate.x));
    this.hero.position.z = Math.min(area.originZ + halfDepth - heroRadius, Math.max(area.originZ - halfDepth + heroRadius, candidate.z));
    this.hero.facing = Math.atan2(movement.x, -movement.y);
    return null;
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

  /** Keep enemy simulation inside its authored walkable land, independent of scenery meshes. */
  private constrainSpawn(spawn: RuntimeSpawn, previous: Position): void {
    const area = this.area(spawn.definition.areaId);
    const radius = .45;
    spawn.position.x = Math.min(area.originX + area.size.width / 2 - radius, Math.max(area.originX - area.size.width / 2 + radius, spawn.position.x));
    spawn.position.z = Math.min(area.originZ + area.size.depth / 2 - radius, Math.max(area.originZ - area.size.depth / 2 + radius, spawn.position.z));
    this.constrainToLakeBank(spawn.position, area, radius);
    this.constrainToAuthoredCollision(spawn.position, previous, area, radius);
  }

  private constrainToAuthoredCollision(position: Position, previous: Position, area: AreaDefinition, radius: number): void {
    for (const shape of area.collision) {
      const overlaps = (point: Position): boolean => Math.abs(point.x - shape.x) < shape.width / 2 + radius && Math.abs(point.z - shape.z) < shape.depth / 2 + radius;
      if (!overlaps(position)) continue;
      const xOnly = { ...position, z: previous.z };
      const zOnly = { ...position, x: previous.x };
      if (!overlaps(xOnly)) position.z = previous.z;
      else if (!overlaps(zOnly)) position.x = previous.x;
      else copyPosition(position, previous);
    }
  }

  /** Keep both lakes solid while allowing movement along and across the causeway. */
  private constrainToLakeBank(position: Position, area: AreaDefinition, radius: number, previous?: Position): void {
    const connection = this.options.connections.find((item) =>
      item.visualStyle === 'lake-gate' && item.axis === 'z' && (item.areaAId === area.id || item.areaBId === area.id)
    );
    if (!connection) return;
    const bounds = lakeBarrierBounds(connection, this.options.areas);
    const segments = lakeBarrierSegments(connection, bounds.minX, bounds.maxX);
    for (const segment of segments) {
      const overlapsX = position.x + radius > segment.minX && position.x - radius < segment.maxX;
      const overlapsZ = position.z + radius > segment.minZ && position.z - radius < segment.maxZ;
      if (!overlapsX || !overlapsZ) continue;

      // When entering from the causeway, stop at the lake's vertical end instead
      // of snapping all the way back to a bank. This closes the gate-side leak.
      const previousWasInOpening = previous && previous.x - radius >= segments[0].maxX && previous.x + radius <= segments[1].minX;
      const previousWasAlongLake = previous && previous.z + radius > segment.minZ && previous.z - radius < segment.maxZ;
      if (previousWasInOpening && previousWasAlongLake) {
        position.x = segment === segments[0] ? segment.maxX + radius : segment.minX - radius;
        continue;
      }

      const bankInset = (connection.barrierDepth ?? 0) / 2 + radius;
      if (area.originZ > connection.z) position.z = connection.z + bankInset;
      else position.z = connection.z - bankInset;
    }
  }

  private area(id: number): AreaDefinition {
    const area = this.options.areas.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }
}

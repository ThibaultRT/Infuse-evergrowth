import type { Position } from '../domain/world/Position';
import { copyPosition, distanceBetween } from '../domain/world/Position';
import { circleOverlapsWorldCollision } from '../domain/world/CollisionMath';
import { worldWalkHeight } from '../domain/world/WorldWalkSurface';
import { WorldNavigation } from '../domain/world/WorldNavigation';
import { statTotal } from '../domain/stats/StatSources';
import { EnemyAISystem, type EnemyAIState } from '../systems/EnemyAISystem';
import type { AreaDefinition, CombatActorRef, CombatAffinity, SavedMinion, SpawnDefinition, TierConfig, WorldConnection } from '../types';

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
  target: CombatActorRef | null;
  targetPath: { x: number; z: number }[];
  targetWaypoint: number;
  pathRefresh: number;
};

export type RuntimeHero = {
  position: Position;
  hp: number;
  dead: boolean;
  combatRemainingSeconds: number;
  respawnRemaining: number;
  moving: boolean;
  facing: number;
};

export type GameplayRuntimeEvent =
  | { type: 'enemyAttack'; spawnId: string; target: CombatActorRef; amount: number; damageType: CombatAffinity }
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
  minions?: SavedMinion[];
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
  readonly navigation: WorldNavigation;
  currentAreaId: number;
  private readonly enemyAI: EnemyAISystem;

  constructor(private readonly options: GameplayRuntimeOptions) {
    this.currentAreaId = options.currentAreaId;
    this.navigation = new WorldNavigation(options.areas, options.connections);
    const area = this.area(this.currentAreaId);
    this.hero = {
      position: { x: area.originX, y: 0, z: area.originZ },
      hp: options.heroHp,
      dead: options.heroHp <= 0,
      combatRemainingSeconds: 0,
      respawnRemaining: options.heroHp <= 0 ? options.heroRespawnSeconds : 0,
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
      ,target: null, targetPath: [], targetWaypoint: 0, pathRefresh: 0
    }));
    this.spawnById = new Map(this.spawns.map((spawn) => [spawn.id, spawn]));
    this.enemyAI = new EnemyAISystem(options.enemyAggroRadius, options.enemyLeashRadius, options.enemyAttackRange, options.enemyPositioningRange);
  }

  setHeroSpeed(heroSpeed: number): void { this.options.heroSpeed = heroSpeed; }

  enterHeroCombat(durationSeconds: number): void {
    if (this.hero.dead) return;
    this.hero.combatRemainingSeconds = Math.max(this.hero.combatRemainingSeconds, durationSeconds);
  }

  update(dt: number, movement: Readonly<{ x: number; y: number }>, controlsEnabled: boolean, elapsedSeconds = dt): GameplayRuntimeEvent[] {
    const events: GameplayRuntimeEvent[] = [];
    this.hero.combatRemainingSeconds = Math.max(0, this.hero.combatRemainingSeconds - elapsedSeconds);
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
      if (!spawn.alive || !spawn.hostile) continue;
      const actors: { ref: CombatActorRef; position: Position }[] = [];
      if (!this.hero.dead && spawn.definition.areaId === this.currentAreaId) actors.push({ ref: { kind: 'hero' }, position: this.hero.position });
      for (const minion of this.options.minions ?? []) if (minion.respawnAt === null && minion.hp > 0 && minion.areaId === spawn.definition.areaId)
        actors.push({ ref: { kind: 'minion', minionId: minion.id }, position: { ...minion.position, y: 0 } });
      if (!actors.length) { spawn.target = null; spawn.targetPath = []; spawn.provoked = false; continue; }
      const retained = actors.find(({ ref }) => ref.kind === spawn.target?.kind && (ref.kind === 'hero' || ref.minionId === (spawn.target as { minionId?: string } | null)?.minionId));
      spawn.pathRefresh = Math.max(0, spawn.pathRefresh - dt);
      let target = retained;
      if (!target || spawn.pathRefresh === 0) {
        const possible = retained ? [retained] : actors.filter((actor) => distanceBetween(spawn.position, actor.position) <= this.options.enemyAggroRadius);
        if (!possible.length) { spawn.target = null; spawn.provoked = false; continue; }
        const direct = possible.filter((actor) => this.navigation.directlyReachable(spawn.definition.areaId, spawn.position, actor.position, this.options.unlockedAreas));
        if (direct.length === possible.length && direct.length) {
          target = [...direct].sort((a, b) => distanceBetween(spawn.position, a.position) - distanceBetween(spawn.position, b.position)
            || (a.ref.kind === 'hero' ? 'hero' : a.ref.minionId).localeCompare(b.ref.kind === 'hero' ? 'hero' : b.ref.minionId))[0];
          spawn.targetPath = [{ x: target.position.x, z: target.position.z }];
        } else {
          const route = this.navigation.nearestRoute(spawn.definition.areaId, spawn.position,
            possible.map((actor) => ({ id: actor.ref.kind === 'hero' ? 'hero' : actor.ref.minionId, areaId: spawn.definition.areaId, position: actor.position })), this.options.unlockedAreas);
          target = route ? possible.find((actor) => (actor.ref.kind === 'hero' ? 'hero' : actor.ref.minionId) === route.targetId) : undefined;
          spawn.targetPath = route?.waypoints ?? [];
        }
        spawn.targetWaypoint = 0; spawn.pathRefresh = 1;
      }
      if (!target) { spawn.target = null; spawn.provoked = false; continue; }
      spawn.target = target.ref;
      const distanceToTarget = distanceBetween(spawn.position, target.position);
      const distanceFromSpawn = distanceBetween(spawn.position, spawn.spawnPosition);
      const clearStrike = this.navigation.directlyReachable(spawn.definition.areaId, spawn.position, target.position, this.options.unlockedAreas);
      const intent = this.enemyAI.update(spawn, clearStrike ? distanceToTarget : Infinity, distanceFromSpawn, dt);
      if (intent === 'chase') {
        while (spawn.targetWaypoint < spawn.targetPath.length && distanceBetween(spawn.position, { ...spawn.targetPath[spawn.targetWaypoint], y: 0 }) < .35) spawn.targetWaypoint++;
        const next = spawn.targetPath[spawn.targetWaypoint] ?? target.position;
        const previous = { ...spawn.position }; this.moveTowards(spawn, { ...next, y: 0 }, spawn.speed * dt); this.constrainSpawn(spawn, previous);
      }
      else if (intent === 'return') { const previous = { ...spawn.position }; this.moveTowards(spawn, spawn.spawnPosition, 3 * dt); this.constrainSpawn(spawn, previous); }
      else if (intent === 'attack') {
        spawn.attackCooldown = this.options.enemyAttackCooldown;
        events.push({ type: 'enemyAttack', spawnId: spawn.id, target: target.ref, amount: spawn.damage, damageType: spawn.damageType });
      } else if (!spawn.provoked) copyPosition(spawn.position, spawn.spawnPosition);
    }
    return events;
  }

  damageSpawn(id: string, amount: number, actorAreaId = this.currentAreaId): { hp: number; defeated: boolean } | null {
    const spawn = this.spawnById.get(id);
    if (!spawn?.alive || spawn.definition.areaId !== actorAreaId) return null;
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
      spawn.target = null;
      spawn.targetPath = []; spawn.targetWaypoint = 0; spawn.pathRefresh = 0;
      copyPosition(spawn.position, spawn.spawnPosition);
    }
  }

  resetEnemiesAfterHeroDefeat(): void {
    for (const spawn of this.spawns) {
      if (!spawn.alive) continue;
      if ((this.options.minions ?? []).some((minion) => minion.respawnAt === null && minion.hp > 0 && minion.areaId === spawn.definition.areaId)) continue;
      spawn.hp = spawn.maxHp;
      spawn.provoked = false;
      spawn.attackCooldown = 0;
      spawn.target = null;
      spawn.targetPath = []; spawn.targetWaypoint = 0; spawn.pathRefresh = 0;
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

  regenerateMinion(id: string, amount: number): number | null {
    const minion = this.options.minions?.find((entry) => entry.id === id);
    if (!minion || minion.respawnAt !== null) return null;
    minion.hp = Math.min(statTotal(minion.stats.maxHp), minion.hp + Math.max(0, amount));
    return minion.hp;
  }

  damageMinion(id: string, amount: number): number | null {
    const minion = this.options.minions?.find((entry) => entry.id === id);
    if (!minion || minion.respawnAt !== null) return null;
    minion.hp = Math.max(0, minion.hp - Math.max(0, amount));
    return minion.hp;
  }

  moveMinion(minion: SavedMinion, target: Readonly<{ x: number; z: number }>, distance: number): boolean {
    if (minion.respawnAt !== null || distance <= 0) return false;
    const dx = target.x - minion.position.x, dz = target.z - minion.position.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) return true;
    const step = Math.min(length, distance);
    const candidate = { x: minion.position.x + dx / length * step, z: minion.position.z + dz / length * step };
    if (this.navigation.valid(minion.areaId, candidate, this.options.unlockedAreas)) { minion.position = candidate; return true; }
    const crossing = this.options.connections.find((gate) => {
      if ((gate.areaAId !== minion.areaId && gate.areaBId !== minion.areaId) || !this.options.unlockedAreas.includes(gate.requiredUnlockedAreaId)) return false;
      return this.navigation.crossingWalkable(gate, candidate, this.options.unlockedAreas);
    });
    if (!crossing) return false;
    const other = crossing.areaAId === minion.areaId ? crossing.areaBId : crossing.areaAId;
    if (this.navigation.valid(other, candidate, this.options.unlockedAreas)) { minion.areaId = other; minion.position = candidate; return true; }
    // A crossing's authored deck may span the space between playable footprints.
    const destination = this.area(other);
    const boundary = crossing.axis === 'x' ? crossing.x : crossing.z;
    const direction = Math.sign(crossing.axis === 'x' ? destination.originX - boundary : destination.originZ - boundary);
    if (((crossing.axis === 'x' ? candidate.x : candidate.z) - boundary) * direction > 0) minion.areaId = other;
    minion.position = candidate;
    return true;
  }

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
    const candidate = { x: previous.x + movement.x * this.options.heroSpeed * dt, y: previous.y, z: previous.z - movement.y * this.options.heroSpeed * dt };
    const area = this.area(this.currentAreaId);
    const heroRadius = .45;
    const halfWidth = area.size.width / 2;
    const halfDepth = area.size.depth / 2;
    // Resolve the bridge rails and locked doors before considering an area entry.
    this.constrainToAuthoredCollision(candidate, previous, area, heroRadius);
    const outsideX = Math.abs(candidate.x - area.originX) > halfWidth - heroRadius;
    const outsideZ = Math.abs(candidate.z - area.originZ) > halfDepth - heroRadius;
    let crossingAxis: 'x' | 'z' | undefined;
    if (outsideX || outsideZ) {
      const connection = this.options.connections.find((item) => {
        if (item.areaAId !== area.id && item.areaBId !== area.id) return false;
        if (!this.options.unlockedAreas.includes(item.requiredUnlockedAreaId)) return false;
        const coordinate = item.axis === 'x' ? candidate.z : candidate.x;
        const center = item.axis === 'x' ? item.z : item.x;
        const crossed = item.axis === 'x' ? outsideX : outsideZ;
        const boundary = item.axis === 'x' ? item.x : item.z;
        const along = item.axis === 'x' ? candidate.x : candidate.z;
        return crossed && Math.abs(along - boundary) <= this.options.heroSpeed * dt + heroRadius
          && Math.abs(coordinate - center) <= item.width / 2 - heroRadius;
      });
      if (connection) {
        const target = connection.areaAId === area.id ? connection.areaBId : connection.areaAId;
        const targetArea = this.area(target);
        crossingAxis = connection.axis;
        const boundary = connection.axis === 'x' ? connection.x : connection.z;
        const direction = Math.sign(connection.axis === 'x' ? targetArea.originX - area.originX : targetArea.originZ - area.originZ);
        const crossedCenter = (candidate[connection.axis] - boundary) * direction > 0;
        // Let the circle straddle an unlocked seam, but change area only when its
        // centre crosses it. This avoids repeated A01/A02 entries on the deck.
        const targetHalfWidth = targetArea.size.width / 2 + heroRadius;
        const targetHalfDepth = targetArea.size.depth / 2 + heroRadius;
        if (crossedCenter && Math.abs(candidate.x - targetArea.originX) <= targetHalfWidth && Math.abs(candidate.z - targetArea.originZ) <= targetHalfDepth) {
          this.constrainToAuthoredCollision(candidate, previous, targetArea, heroRadius);
          if ((candidate[connection.axis] - boundary) * direction <= 0) return null;
          candidate.y = worldWalkHeight(targetArea.walkSurfaces, candidate);
          this.hero.position = candidate;
          this.currentAreaId = target;
          for (const spawn of this.spawns) if (spawn.target?.kind === 'hero') { spawn.provoked = false; spawn.target = null; }
          this.hero.facing = Math.atan2(movement.x, -movement.y);
          return { type: 'areaEntered', areaId: target, connectionId: connection.id };
        }
      }
    }
    const marginX = crossingAxis === 'x' ? 0 : heroRadius;
    const marginZ = crossingAxis === 'z' ? 0 : heroRadius;
    this.hero.position.x = Math.min(area.originX + halfWidth - marginX, Math.max(area.originX - halfWidth + marginX, candidate.x));
    this.hero.position.z = Math.min(area.originZ + halfDepth - marginZ, Math.max(area.originZ - halfDepth + marginZ, candidate.z));
    this.hero.position.y = worldWalkHeight(area.walkSurfaces, this.hero.position);
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
    this.constrainToAuthoredCollision(spawn.position, previous, area, radius);
    spawn.position.y = worldWalkHeight(area.walkSurfaces, spawn.position);
  }

  private constrainToAuthoredCollision(position: Position, previous: Position, area: AreaDefinition, radius: number): void {
    for (const shape of area.collision) {
      if (shape.activation) {
        const connection = this.options.connections.find((candidate) => candidate.id === shape.activation?.connectionId);
        if (!connection || this.options.unlockedAreas.includes(connection.requiredUnlockedAreaId)) continue;
      }
      const overlaps = (point: Position): boolean => circleOverlapsWorldCollision(point, radius, shape);
      if (!overlaps(position)) continue;
      const xOnly = { ...position, z: previous.z };
      const zOnly = { ...position, x: previous.x };
      if (!overlaps(xOnly)) position.z = previous.z;
      else if (!overlaps(zOnly)) position.x = previous.x;
      else copyPosition(position, previous);
    }
  }

  private area(id: number): AreaDefinition {
    const area = this.options.areas.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }
}

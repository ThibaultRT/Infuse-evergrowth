import assert from 'node:assert/strict';

/** Check the new loop, abyss containment and progress earned before this area existed. */
export async function validateArea4(vite, config) {
  const [{ GameplayRuntime }, { AREA_A04_LAYOUT: layout }, { AREA4_SPEC: spec }, { circleOverlapsWorldCollision }, { worldTerrainHeight }, { loadSave, persist }, { ProgressionSystem }, { GameEvents }] = await Promise.all([
    vite.ssrLoadModule('/src/game/GameplayRuntime.ts'),
    vite.ssrLoadModule('/src/data/world/areas/areaA04Layout.ts'),
    vite.ssrLoadModule('/src/data/world/area4.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'),
    vite.ssrLoadModule('/src/save.ts'),
    vite.ssrLoadModule('/src/systems/ProgressionSystem.ts'),
    vite.ssrLoadModule('/src/game/GameEvents.ts'),
  ]);
  const area = config.AREAS.find((candidate) => candidate.id === 4);
  const crossings = config.WORLD_CONNECTIONS.filter((connection) => connection.areaBId === 4);
  assert.equal(config.SPAWNS.filter((spawn) => spawn.areaId === 4).length, 0, 'The playground must not add provisional encounters or rewards.');
  assert.equal(area.bossSpawnId, null, 'The blockout must not invent a boss ID.');
  assert.deepEqual(crossings.map((connection) => connection.areaAId).sort(), [1, 3]);
  assert.ok(crossings.every((connection) => connection.axis === 'z' && connection.z === 36 && connection.requiredUnlockedAreaId === 4 && connection.unlockOnBossOfAreaId === 3));
  assert.equal(spec.throne.height / spec.throne.humanHeight, 3);

  const create = (id, unlocked = [1, 2, 3, 4]) => new GameplayRuntime({
    areas: config.AREAS, connections: config.WORLD_CONNECTIONS, unlockedAreas: unlocked,
    spawns: [], currentAreaId: id, heroHp: 100, heroSpeed: config.HERO_SPEED,
    heroRespawnSeconds: 1, enemyAggroRadius: 10, enemyLeashRadius: 15,
    enemyAttackRange: 2, enemyPositioningRange: 2, enemyAttackCooldown: 1,
  });
  for (const gate of crossings) {
    for (const fps of [30, 60]) for (const reverse of [false, true]) for (const offset of [-1.1, 0, 1.1]) {
      const unlocked = [1, 2, 3];
      const runtime = create(reverse ? 4 : gate.areaAId, unlocked);
      runtime.hero.position = { x: gate.x + offset, y: 0, z: reverse ? 53 : 32 };
      const input = { x: 0, y: reverse ? 1 : -1 };
      for (let frame = 0; frame < fps * 4; frame++) runtime.update(1 / fps, input, true);
      assert.equal(runtime.currentAreaId, reverse ? 4 : gate.areaAId, `${gate.id} locked crossing leaked.`);
      unlocked.push(4);
      const entries = [];
      for (let frame = 0; frame < fps * 4; frame++) entries.push(...runtime.update(1 / fps, input, true));
      assert.equal(runtime.currentAreaId, reverse ? gate.areaAId : 4, `${gate.id} off-center crossing failed at ${fps} FPS.`);
      assert.equal(entries.filter((event) => event.type === 'areaEntered').length, 1);
      assert.equal(runtime.hero.position.y, 0, 'Bridge must rejoin flat ground.');
    }
    for (const side of [-1, 1]) {
      const runtime = create(4);
      runtime.hero.position = { x: gate.x, y: spec.bridge.deckHeight, z: 43 };
      for (let frame = 0; frame < 120; frame++) runtime.update(1 / 60, { x: side, y: 0 }, true);
      assert.ok(Math.abs(runtime.hero.position.x - gate.x) <= gate.width / 2 - 0.45 + 1e-6, 'Rift bridge rails must contain the hero.');
    }
  }
  for (let x = -35; x <= 107; x += 0.5) {
    if (crossings.some((gate) => Math.abs(x - gate.x) < gate.width / 2 + .45)) continue;
    assert.ok(area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision({ x, z: 42 }, .45, shape)), `Unprotected abyss at ${x},42.`);
  }

  const step = .5, columns = 285, rows = 93;
  const pointAt = (index) => ({ x: index % columns * step - 71, z: Math.floor(index / columns) * step - 23 });
  const indexOf = ({ x, z }) => Math.round((z + 23) / step) * columns + Math.round((x + 71) / step);
  const open = new Uint8Array(columns * rows);
  for (let index = 0; index < open.length; index++) {
    const local = pointAt(index), world = { x: area.originX + local.x, z: area.originZ + local.z };
    open[index] = Number(!area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision(world, .5, shape)));
    if (open[index] && world.z > 48) assert.equal(worldTerrainHeight(layout, local.x, local.z), 0);
  }
  const start = indexOf({ x: 0, z: 0 }), reached = new Set([start]), queue = [start];
  assert.ok(open[start], 'Reload/respawn origin must be clear.');
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    for (const next of [index - columns, index + columns, ...(index % columns ? [index - 1] : []), ...(index % columns < columns - 1 ? [index + 1] : [])]) {
      if (next < 0 || next >= open.length || !open[next] || reached.has(next)) continue;
      reached.add(next); queue.push(next);
    }
  }
  const destinations = [...crossings.map((gate) => ({ x: gate.x - area.originX, z: -8 })), { x: 0, z: 10 }, ...layout.encounterSpots.map((spot) => ({ x: spot.center[0], z: spot.center[1] }))];
  for (const destination of destinations) assert.ok(reached.has(indexOf(destination)), `Area 4 strands ${JSON.stringify(destination)}.`);

  const now = new Date(2026, 8, 13, 12), values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const previous = loadSave(storage, now);
  const boss = config.SPAWNS.find((spawn) => spawn.id === config.AREAS.find((candidate) => candidate.id === 3).bossSpawnId);
  previous.unlockedAreas = [1, 2, 3];
  previous.defeatedBosses = [boss.id];
  previous.stats.attack.blunt.additive.kills = 123;
  previous.spawns[boss.id].killsToday = 2;
  previous.spawns[boss.id].respawnAt = now.getTime() + 1000;
  previous.spawns[boss.id].defeatedAt = now.getTime() - 1000;
  values.set('infuse-evergrowth-save-v18', JSON.stringify(previous));
  const restored = loadSave(storage, now);
  assert.ok(restored.unlockedAreas.includes(4), 'Existing Area 3 victories must unlock the new routes.');
  for (const key of ['stats', 'spawns', 'inventory', 'soulCatcher', 'defeatedBosses']) assert.deepEqual(restored[key], previous[key], `Area 4 normalization lost ${key}.`);
  restored.currentAreaId = 4;
  assert.ok(persist(restored, storage, now));
  assert.equal(loadSave(storage, now).currentAreaId, 4, 'Area 4 must survive a save/reload.');
  const fresh = loadSave({ getItem: () => null, setItem: () => {} }, now);
  assert.deepEqual(fresh.unlockedAreas, [1]);
  fresh.unlockedAreas = [1, 2, 3];
  const events = new GameEvents(), opened = [];
  events.on('gateUnlocked', ({ gateId }) => opened.push(gateId));
  const progression = new ProgressionSystem(fresh, events, () => {}, () => 0.99);
  progression.defeat(boss, config.TIER_CONFIG[boss.tier], create(3).hero, config.AREAS, config.WORLD_CONNECTIONS, now.getTime(), config.BASE_RESPAWN_MS, now.getTime() + 86400000);
  assert.deepEqual(opened.sort(), crossings.map((gate) => gate.id).sort(), 'One Area 3 boss defeat must open both crossings.');
  assert.equal(fresh.unlockedAreas.filter((id) => id === 4).length, 1);
  console.log('Area 4: both routes cross at 30/60 FPS, locks/rails/abyss contain actors, clearings are reachable, and old/new boss victories and Area 4 reloads preserve progression.');
}

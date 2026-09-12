import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

// Focused regressions from code-review.md, using the existing Vite SSR harness.
const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
const failures = [];
let passed = 0;
async function check(name, run, expectedWarnings = 0) {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try { await run(); assert.equal(warnings.length, expectedWarnings, 'Unexpected warning count'); passed++; }
  catch (error) { failures.push(name); console.error(`${name}: ${error.message}`); }
  finally { console.warn = originalWarn; }
}
const originalGlobals = new Map();
function mockGlobal(name, descriptor) {
  if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

try {
  mockGlobal('localStorage', { value: undefined });
  const [persistence, config, { GameplayRuntime }, equipment, quality, { createWorldMaterials }, disposal, { InputController }] = await Promise.all([
    vite.ssrLoadModule('/src/save.ts'),
    vite.ssrLoadModule('/src/config.ts'),
    vite.ssrLoadModule('/src/game/GameplayRuntime.ts'),
    vite.ssrLoadModule('/src/systems/EquipmentSystem.ts'),
    vite.ssrLoadModule('/src/rendering/RenderingQuality.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldMaterials.ts'),
    vite.ssrLoadModule('/src/rendering/RenderingResourceDisposal.ts'),
    vite.ssrLoadModule('/src/controllers/InputController.ts'),
  ]);
  const now = new Date(2026, 8, 12, 12);
  const emptyStorage = { getItem: () => null, setItem: () => {} };
  const fresh = () => persistence.loadSave(emptyStorage, now);
  const load = (data) => persistence.loadSave({ getItem: (key) => key.endsWith(`v${data.version}`) ? JSON.stringify(data) : null, setItem: () => {} }, now);
  const spawnId = config.SPAWNS[0].id;

  await check('Supported v7-v18 saves retain progression', () => {
    for (let version = 7; version <= 18; version++) {
      const data = fresh();
      data.version = version;
      data.stats.attack.blunt.additive.kills = 1234;
      data.inventory.items['hammer-common'].level = 37;
      data.heroHp = 17;
      const result = load(data);
      assert.equal(result.stats.attack.blunt.additive.kills, 1234);
      assert.equal(result.inventory.items['hammer-common'].level, 37);
      assert.equal(result.heroHp, version >= 12 ? 17 : config.BASE_HERO_MAX_HP);
    }
  });
  await check('A malformed spawn roll does not erase unrelated progress', () => {
    const data = fresh();
    data.stats.attack.blunt.additive.kills = 1234;
    data.spawns[spawnId] = { killsToday: 4, respawnAt: now.getTime() + 60000, defeatedAt: now.getTime(), roll: { maxHp: 100 } };
    const result = load(data);
    assert.equal(result.stats.attack.blunt.additive.kills, 1234);
    assert.equal(result.spawns[spawnId].killsToday, 4);
    assert.equal(result.spawns[spawnId].respawnAt, now.getTime() + 60000);
    assert.ok(Number.isFinite(result.spawns[spawnId].roll.reward.amount));
  });
  await check('Valid per-life rolls survive authored balance changes until midnight', () => {
    const data = fresh();
    data.spawns[spawnId].roll = { maxHp: 99999, reward: { stat: 'hp', amount: 99999 } };
    assert.deepEqual(load(data).spawns[spawnId].roll, data.spawns[spawnId].roll);
    data.dailyKey = '2026-09-11';
    data.spawns[spawnId].killsToday = 8;
    const reset = load(data).spawns[spawnId];
    assert.equal(reset.killsToday, 0);
    assert.notDeepEqual(reset.roll, data.spawns[spawnId].roll);
  });
  await check('Invalid numeric sources are repaired independently', () => {
    const data = fresh();
    data.stats.maxHp.additive.kills = 123;
    data.stats.maxHp.additive.other = 'broken';
    data.stats.maxHp.multiplicative.other = null;
    data.stats.evasion.raw.other = 'Infinity';
    data.inventory.items['hammer-common'] = { itemId: 'hammer-common', level: 'Infinity', ascend: 'Infinity' };
    const result = load(data);
    assert.equal(persistence.statTotal(result.stats.maxHp), config.BASE_HERO_MAX_HP + 123);
    assert.equal(result.stats.evasion.raw.other, 0);
    assert.deepEqual(result.inventory.items['hammer-common'], { itemId: 'hammer-common', level: 1, ascend: 0 });
  });
  await check('Soul migration bounds levels and reconstructs missing XP', async () => {
    const { SOUL_NODE_BY_ID } = await vite.ssrLoadModule('/src/data/soul-catcher/index.ts');
    const { soulCost, soulPurchaseXp } = await vite.ssrLoadModule('/src/domain/soul-catcher.ts');
    const data = fresh();
    data.soulCatcher.nodeLevels = { 'SC-01': 1000000000000, 'SC-02': 'Infinity', 'SC-999': 2 };
    delete data.soulCatcher.xp;
    const result = load(data);
    const node = SOUL_NODE_BY_ID.get('SC-01');
    assert.deepEqual(result.soulCatcher.nodeLevels, { 'SC-01': node.maxLevel });
    let expectedXp = 0;
    for (let level = 1; level <= node.maxLevel; level++) expectedXp += soulPurchaseXp(node.cost.soulType, soulCost(node, level));
    assert.equal(result.soulCatcher.xp, expectedXp);
  });
  await check('One owned item cannot be restored into multiple weapon slots', () => {
    const data = fresh();
    data.unlockedAreas = [1, 2];
    data.inventory.equipped.orbit1 = 'hammer-common';
    assert.equal(Object.values(load(data).inventory.equipped).filter((id) => id === 'hammer-common').length, 1);
  });
  await check('Loading zero HP resumes the death countdown before movement', () => {
    const runtime = new GameplayRuntime({ areas: config.AREAS, connections: config.WORLD_CONNECTIONS, unlockedAreas: [1], spawns: [], currentAreaId: 1, heroHp: 0, heroSpeed: 7.6, heroRespawnSeconds: 5, enemyAggroRadius: 5, enemyLeashRadius: 7, enemyAttackRange: 2.5, enemyPositioningRange: 1.7, enemyAttackCooldown: 1 });
    const start = { ...runtime.hero.position };
    assert.equal(runtime.hero.dead, true);
    assert.deepEqual(runtime.update(.05, { x: 1, y: 0 }, true, 4), []);
    assert.deepEqual(runtime.hero.position, start);
    assert.deepEqual(runtime.update(.05, { x: 1, y: 0 }, true, 1), [{ type: 'heroRespawned', areaId: 1 }]);
  });
  await check('Flat defense includes every persistent source before adding armor', () => {
    Object.assign(persistence.save, fresh());
    assert.equal(equipment.equippedDefense('blunt'), 0);
    persistence.save.stats.defense.blunt = { base: 3, additive: { kills: 4, other: 5, soulCatcher: 6 }, multiplicative: { other: 2 } };
    assert.equal(equipment.equippedDefense('blunt'), 36);
  });
  await check('Reduced resolution is 70% of Full on DPR 1, 2 and 3 screens', () => {
    for (const dpr of [1, 2, 3]) {
      mockGlobal('devicePixelRatio', { value: dpr });
      const full = quality.effectivePixelRatio({ renderScale: 1 });
      const reduced = quality.effectivePixelRatio({ renderScale: .7 });
      assert.equal(reduced, full * .7);
      assert.ok(full <= 2);
    }
  });
  await check('Focus changes and extra fingers cannot leave movement stuck', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { hidden: false });
    mockGlobal('addEventListener', { value: windowTarget.addEventListener.bind(windowTarget) });
    mockGlobal('document', { value: documentTarget });
    const captures = new Set();
    const joystick = Object.assign(new EventTarget(), {
      setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });
    const input = new InputController(joystick, { style: {} });
    const emit = (target, type, props = {}) => target.dispatchEvent(Object.assign(new Event(type), props));
    emit(windowTarget, 'keydown', { code: 'KeyW' });
    assert.equal(input.movement.y, 1);
    emit(windowTarget, 'blur');
    assert.ok(input.movement.x === 0 && input.movement.y === 0);
    emit(joystick, 'pointerdown', { pointerId: 1 });
    emit(joystick, 'pointermove', { pointerId: 1, clientX: 84, clientY: 50 });
    emit(joystick, 'pointerdown', { pointerId: 2 });
    emit(joystick, 'pointerup', { pointerId: 2 });
    assert.equal(input.movement.x, 1);
    emit(joystick, 'lostpointercapture', { pointerId: 1 });
    assert.ok(input.movement.x === 0 && input.movement.y === 0);
    emit(windowTarget, 'keydown', { code: 'KeyW' });
    documentTarget.hidden = true;
    emit(documentTarget, 'visibilitychange');
    assert.ok(input.movement.x === 0 && input.movement.y === 0);
  });
  await check('Missing terrain textures still yield usable world materials', async () => {
    const materials = await createWorldMaterials({ loadTexture: async () => { throw new Error('Simulated missing texture'); } });
    assert.equal(materials.terrain.meadow.map, null);
    assert.equal(materials.terrain.forest.normalMap, null);
    assert.ok(materials.water.isMaterial);
    new Set([...Object.values(materials.terrain), materials.trail, materials.cobble, materials.water, materials.cliff, materials.lockedGate, materials.timber]).forEach((material) => material.dispose());
  }, 8);
  await check('Skeleton cleanup disposes private textures without disposing shared geometry', () => {
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    mesh.bind(new THREE.Skeleton([new THREE.Bone()]));
    mesh.skeleton.computeBoneTexture();
    let textureDisposed = false, geometryDisposed = false;
    mesh.skeleton.boneTexture.addEventListener('dispose', () => { textureDisposed = true; });
    mesh.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
    disposal.disposeClonedSkeletons(mesh);
    assert.equal(textureDisposed, true);
    assert.equal(geometryDisposed, false);
    mesh.geometry.dispose(); mesh.material.dispose();
  });
  await check('Storage access failures keep the game running and prevent overwriting unread progress', () => {
    mockGlobal('localStorage', { get: () => { throw new Error('Simulated storage denied'); } });
    assert.doesNotThrow(() => persistence.loadSave());
    assert.equal(persistence.persist(), false);
    assert.doesNotThrow(() => quality.saveRenderingQuality({ renderScale: .7, frameRateLimit: 30, showStats: false }));
    let writes = 0;
    mockGlobal('localStorage', { value: { getItem: () => null, setItem: () => writes++ } });
    assert.equal(persistence.persist(), false);
    assert.equal(writes, 0);
  }, 2);
} finally {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  await vite.close();
}
console.log(`Code-review regressions: ${passed} passed, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;

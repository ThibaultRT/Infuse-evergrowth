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
    assert.equal(equipment.equippedDefense(persistence.save, 'blunt'), 0);
    persistence.save.stats.defense.blunt = { base: 3, additive: { kills: 4, other: 5, soulCatcher: 6 }, multiplicative: { other: 2 } };
    assert.equal(equipment.equippedDefense(persistence.save, 'blunt'), 36);
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
  const [{ GameSession }, { GameEvents }, { SoulCatcherSystem }, { SOUL_NODES }, { ascendOwnedEquipment, canAscend }, { configureModelLod }, { applyWorldMaterialQuality }] = await Promise.all([
    vite.ssrLoadModule('/src/game/GameSession.ts'), vite.ssrLoadModule('/src/game/GameEvents.ts'), vite.ssrLoadModule('/src/systems/SoulCatcherSystem.ts'),
    vite.ssrLoadModule('/src/data/soul-catcher/index.ts'), vite.ssrLoadModule('/src/domain/items/EquipmentProgression.ts'),
    vite.ssrLoadModule('/src/rendering/ModelLod.ts'), vite.ssrLoadModule('/src/rendering/environment/WorldMaterials.ts'),
  ]);
  const memory = () => {
    const values = new Map();
    return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  };
  const primary = 'infuse-evergrowth-save-v19', backup = 'infuse-evergrowth-save-backup';
  const clock = { now: () => now.getTime(), date: () => new Date(now) };
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

  await check('One detached progression snapshot agrees with combat, inventory, and Soul rules', () => {
    const state = fresh(); state.unlockedAreas.push(2); state.defeatedBosses.push('area2-rare-01');
    state.soulCatcher.balances.common = 10000;
    const session = new GameSession(state, new GameEvents(), () => {}, clock);
    state.stats.attack.blunt = { base: 0, additive: { kills: 25, soulCatcher: 50 }, multiplicative: { soulCatcher: 1.05, equipment: 1.10 } };
    equipment.applyEquipmentCopies(state, 'hammer-uncommon', 101); equipment.equip(state, 'hammer-uncommon', 'orbit1');
    const before = structuredClone(state), snapshot = session.progressionSnapshot();
    assert.deepEqual(state, before, 'Reading a snapshot must not change the save');
    assert.deepEqual(structuredClone(snapshot), snapshot, 'Snapshot must contain serializable values only');
    for (const attack of snapshot.stats.attacks) {
      near(attack.damage, equipment.attackProfile(state, attack.slot).damage);
      near(attack.sources.total, attack.damage);
    }
    near(snapshot.equipment.summary.totalAttack, snapshot.stats.attacks.reduce((sum, attack) => sum + attack.damage, 0));
    for (const type of ['blunt', 'slash', 'piercing']) near(snapshot.stats.defense[type].total, equipment.equippedDefense(state, type));
    for (const layer of snapshot.soulCatcher.layers) for (const node of layer.nodes) {
      assert.equal(node.purchasable, session.soulCatcher.canPurchase(node.id));
      assert.equal(node.revealed, session.soulCatcher.revealed(node.id));
    }
    for (const definition of config.SPAWNS.filter((spawn) => spawn.tier !== 'crystal')) {
      const yieldValue = snapshot.soulCatcher.yields.find(({ type }) => type === definition.tier);
      assert.equal(yieldValue.total, session.soulCatcher.yieldFor(definition)?.quantity ?? 0);
    }
    state.stats.attack.blunt.multiplicative.equipment = 3; state.inventory.items['hammer-uncommon'].level++;
    state.soulCatcher.balances.common = 0;
    assert.equal(snapshot.stats.attacks[0].sources.multiplicative.equipment, 1.1);
    assert.equal(snapshot.equipment.items['hammer-uncommon'].owned.level, 101);
    assert.equal(snapshot.soulCatcher.balances.common, 10000);
    snapshot.stats.attacks[0].sources.additive.kills = -100;
    snapshot.equipment.items['hammer-common'].definition.name = 'changed snapshot';
    snapshot.soulCatcher.layers[0].nodes[0].position.radius = -1;
    assert.equal(state.stats.attack.blunt.additive.kills, 25);
    assert.notEqual(equipment.EQUIPMENT_BY_ID.get('hammer-common').name, 'changed snapshot');
    assert.notEqual(SOUL_NODES[0].position.radius, -1);
  });
  await check('Snapshots follow equip, Ascend, purchases, layer unlocks, and resets', () => {
    const state = fresh(), session = new GameSession(state, new GameEvents(), () => {}, clock);
    equipment.applyEquipmentCopies(state, 'sword-common', 101);
    let snapshot = session.progressionSnapshot();
    assert.equal(snapshot.equipment.items['sword-common'].equipSlots.some(({ slot }) => slot === 'orbit1'), false);
    assert.equal(snapshot.soulCatcher.available, false);
    assert.ok(snapshot.soulCatcher.yields.every(({ total }) => total === 0));
    state.unlockedAreas.push(2); state.defeatedBosses.push('area2-rare-01');
    assert.equal(session.commands.execute({ type: 'equip', itemId: 'sword-common', slot: 'orbit1' }), true);
    const preview = session.progressionSnapshot().equipment.items['sword-common'];
    assert.equal(session.commands.execute({ type: 'ascend', itemId: 'sword-common' }), true);
    snapshot = session.progressionSnapshot();
    assert.equal(snapshot.equipment.items['sword-common'].owned.level, 2);
    near(snapshot.equipment.items['sword-common'].value, preview.ascend.value);
    assert.equal(snapshot.equipment.items['sword-common'].equippedSlot, 'orbit1');
    const root = snapshot.soulCatcher.layers[0].nodes.find(({ revealed }) => revealed);
    state.soulCatcher.balances.common = 1000000; state.soulCatcher.xp = 84291;
    assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: root.id }), true);
    snapshot = session.progressionSnapshot();
    assert.equal(snapshot.soulCatcher.layers[0].nodes.find(({ id }) => id === root.id).level, 1);
    assert.equal(snapshot.soulCatcher.layers[1].unlocked, true);
    assert.equal(snapshot.soulCatcher.xp, state.soulCatcher.xp);
    session.commands.execute({ type: 'resetSoulCatcher' });
    snapshot = session.progressionSnapshot();
    assert.equal(snapshot.soulCatcher.layers[1].unlocked, false);
    assert.equal(snapshot.soulCatcher.balances.common, 0);
    assert.ok(snapshot.soulCatcher.layers.flatMap(({ nodes }) => nodes).every(({ level }) => level === 0));
    session.commands.execute({ type: 'resetHero', equipment: true });
    assert.equal(session.progressionSnapshot().equipment.items['sword-common'], undefined);
  });

  await check('Layer 3 prices, Epic Soul unlock, and restored XP', async () => {
    const { SOUL_LAYER_REGISTRY, SOUL_NODE_BY_ID, SOUL_LAYERS } = await vite.ssrLoadModule('/src/data/soul-catcher/index.ts');
    const { soulCost, soulPurchaseXp } = await vite.ssrLoadModule('/src/domain/soul-catcher.ts');
    const layer = SOUL_LAYERS[2], fifth = layer.nodes[4], priced = SOUL_NODE_BY_ID.get('SC-62');
    assert.equal(layer.nodes.length, 30);
    assert.equal(fifth.id, 'SC-65');
    assert.deepEqual(fifth.reward.effects, [{ type: 'unlockSoulDrop', soulType: 'epic' }]);
    assert.ok(layer.nodes[0].neighbors.includes(fifth.id));
    assert.equal(soulCost(priced, 2), Math.ceil(priced.cost.base * 1.35));
    assert.ok(soulCost(priced, 3) > soulCost(priced, 2));
    assert.ok(SOUL_LAYER_REGISTRY[3].unlockXp <= 1000000, 'Existing Layer 4 unlocks must remain unlocked');

    const state = fresh();
    state.defeatedBosses.push('area2-rare-01');
    state.soulCatcher.xp = SOUL_LAYER_REGISTRY[2].unlockXp;
    state.soulCatcher.highestUnlockedLayer = 3;
    state.soulCatcher.balances.rare = 1000;
    const session = new GameSession(state, new GameEvents(), () => {}, clock);
    const epic = config.SPAWNS.find(({ tier }) => tier === 'epic');
    assert.equal(session.soulCatcher.yieldFor(epic), null);
    assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-61' }), true);
    assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: fifth.id }), true);
    assert.deepEqual(session.soulCatcher.yieldFor(epic), { soulType: 'epic', quantity: 1 });
    assert.deepEqual(session.soulCatcher.credit(epic), { soulType: 'epic', quantity: 1 });
    assert.equal(state.soulCatcher.balances.epic, 1);
    const previousXp = state.soulCatcher.xp;
    assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: priced.id }), true);
    assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: priced.id }), true);
    assert.equal(state.soulCatcher.xp - previousXp, soulPurchaseXp('rare', soulCost(priced, 1) + soulCost(priced, 2)));

    const stored = fresh();
    stored.soulCatcher.nodeLevels = { [priced.id]: 3 };
    delete stored.soulCatcher.xp;
    const restored = load(stored);
    const spent = [1, 2, 3].reduce((sum, level) => sum + soulCost(priced, level), 0);
    assert.equal(restored.soulCatcher.xp, soulPurchaseXp('rare', spent));
  });

  await check('Complete weapon attack sums additions before multiplying every source', () => {
    const state = fresh();
    const item = equipment.EQUIPMENT_BY_ID.get('hammer-common');
    equipment.EQUIPMENT_BY_ID.set(item.id, { ...item, baseDamage: 100 });
    try {
      state.stats.attack.blunt = { base: 0, additive: { kills: 25, soulCatcher: 50 }, multiplicative: { soulCatcher: 1.05, equipment: 1.10 } };
      const profile = equipment.attackProfile(state, 'hand1');
      assert.equal(profile.sources.additive.equippedWeapon, 100);
      assert.equal(persistence.statAdditiveTotal(profile.sources), 175);
      near(persistence.statMultiplierTotal(profile.sources), 1.155);
      near(profile.damage, 202.125);
      assert.equal(state.stats.attack.blunt.additive.equippedWeapon, undefined, 'Projection must not save or double-count weapon damage');
    } finally { equipment.EQUIPMENT_BY_ID.set(item.id, item); }
  });
  await check('Matching equipped weapons retain separate per-slot attack damage', () => {
    const state = fresh(); state.unlockedAreas.push(2);
    state.stats.attack.blunt = { base: 0, additive: { kills: 25, soulCatcher: 50 }, multiplicative: { soulCatcher: 1.05, equipment: 1.10 } };
    equipment.applyEquipmentCopies(state, 'hammer-uncommon', 1);
    equipment.equip(state, 'hammer-uncommon', 'orbit1');
    near(equipment.attackProfile(state, 'hand1').damage, (75 + 15) * 1.155);
    near(equipment.attackProfile(state, 'orbit1').damage, (75 + 75) * 1.155);
    near(equipment.equipmentCombatSummary(state).totalAttack, (90 + 150) * 1.155);
  });
  await check('Equipped armor is included before persistent defense multipliers', () => {
    const state = fresh(); const armor = equipment.EQUIPMENT.find((item) => item.kind === 'armor');
    state.stats.defense[armor.damageType] = { base: 3, additive: { kills: 4 }, multiplicative: { other: 2 } };
    const { owned } = equipment.applyEquipmentCopies(state, armor.id, 2);
    assert.equal(equipment.equip(state, armor.id, equipment.equipmentSlot(armor.id)), true);
    assert.equal(equipment.equippedDefense(state, armor.damageType), (7 + equipment.equipmentDefense(armor, owned)) * 2);
  });
  await check('Soul percentage upgrades stack without overwriting another node and reset cleanly', () => {
    const state = fresh(); const events = new GameEvents();
    const node = SOUL_NODES.find((n) => n.reward.effects.some((e) => e.type === 'attackPercentAdditive' && e.damageType === 'blunt'));
    const second = { ...node, id: 'review-percent-node', reward: { effects: [{ type: 'attackPercentAdditive', damageType: 'blunt', amountPerLevel: .1 }] } };
    SOUL_NODES.push(second);
    try {
      state.soulCatcher.nodeLevels[node.id] = 5; state.soulCatcher.nodeLevels[second.id] = 1;
      state.stats.attack.blunt.multiplicative.equipment = 1.2;
      const souls = new SoulCatcherSystem(state, events, () => {}, () => null);
      near(persistence.statMultiplierTotal(state.stats.attack.blunt), 1.05 * 1.1 * 1.2);
      souls.syncEffects();
      near(persistence.statMultiplierTotal(state.stats.attack.blunt), 1.05 * 1.1 * 1.2);
      souls.reset();
      near(persistence.statMultiplierTotal(state.stats.attack.blunt), 1.2);
    } finally { SOUL_NODES.pop(); }
  });
  await check('Ascend carries excess copies regardless of acquisition order for every item', () => {
    for (const item of equipment.EQUIPMENT) {
      const threshold = equipment.ascendCopies(item, 0);
      const owned = { itemId: item.id, level: threshold - 1, ascend: 0 };
      assert.equal(canAscend(item, owned), false);
      owned.level = threshold;
      assert.equal(ascendOwnedEquipment(item, owned).level, 1);
      const first = ascendOwnedEquipment(item, { ...owned, level: threshold + 1 });
      const second = ascendOwnedEquipment(item, owned); second.level++;
      assert.deepEqual(first, second);
      const collectThenAscend = { ...owned, level: threshold * 3 + 50 };
      let early = ascendOwnedEquipment(item, owned); early.level += threshold * 2 + 50;
      let late = collectThenAscend;
      while (canAscend(item, early)) early = ascendOwnedEquipment(item, early);
      while (canAscend(item, late)) late = ascendOwnedEquipment(item, late);
      assert.deepEqual(early, late);
    }
  });
  await check('Armor bases, per-copy gains and successive ascend costs follow rarity curves', () => {
    const cases = [
      ['common', [600, 12375, 49954, 159809], [70, 180, 470, 1200], 100],
      ['uncommon', [4700, 33075, 111881], [100, 250, 600], 200],
      ['rare', [50000, 139871], [130, 270], 350],
      ['epic', [310000, 566300], [190, 400], 500],
      ['legendary', [2500000, 3945200], [160, 320], 2000],
    ];
    for (const [rarity, bases, costs, perCopy] of cases) {
      const armor = equipment.EQUIPMENT.find((item) => item.kind === 'armor' && item.rarity === rarity);
      for (let ascend = 0; ascend < bases.length; ascend++) {
        const owned = { itemId: armor.id, level: 1, ascend };
        assert.equal(equipment.ascendCopies(armor, ascend), costs[ascend]);
        assert.equal(equipment.equipmentDefense(armor, owned), bases[ascend]);
        assert.equal(equipment.equipmentDefense(armor, { ...owned, level: 2 }), bases[ascend] + perCopy);
        assert.equal(equipment.equipmentValuePerLevel(armor, owned), perCopy);
      }
      const threshold = costs[0];
      const owned = { itemId: armor.id, level: threshold + 3, ascend: 0 };
      assert.equal(equipment.equipmentAscendValue(armor, owned), bases[1] + 3 * perCopy);
      const restored = load({ ...fresh(), inventory: { ...fresh().inventory, items: { [armor.id]: owned } } });
      assert.equal(equipment.equipmentDefense(armor, restored.inventory.items[armor.id]), bases[0] + (threshold + 2) * perCopy);
    }
    const weapon = equipment.EQUIPMENT.find((item) => item.kind === 'weapon' && item.rarity === 'common');
    assert.equal(equipment.ascendCopies(weapon, 0), 100);
    assert.equal(equipment.ascendCopies(weapon, 3), 100);
  });
  await check('Commands and reset helpers mutate only the injected session', () => {
    const globalBefore = structuredClone(persistence.save), first = fresh(), second = fresh();
    const session = new GameSession(first, new GameEvents(), () => {}, clock, () => .99);
    equipment.applyEquipmentCopies(first, 'sword-common', 101);
    assert.equal(session.commands.execute({ type: 'equip', itemId: 'sword-common', slot: 'hand1' }), true);
    assert.equal(session.commands.execute({ type: 'ascend', itemId: 'sword-common' }), true);
    assert.equal(first.inventory.items['sword-common'].level, 2);
    first.stats.maxHp.additive.kills = 123;
    session.commands.execute({ type: 'resetHero', equipment: true });
    assert.deepEqual(first.inventory, second.inventory);
    assert.equal(first.stats.maxHp.additive.kills, 0);
    assert.deepEqual(persistence.save, globalBefore);
  });
  await check('Resetting attributes reapplies owned Soul bonuses before clamping and saving HP', () => {
    const state = fresh();
    const hpNode = SOUL_NODES.find(n => n.reward.effects.some(e => e.type === 'maxHpAdditive'));
    state.soulCatcher.nodeLevels[hpNode.id] = 1;
    state.stats.maxHp.additive.kills = 500;
    state.heroHp = 500;
    let storedHp = 0;
    const session = new GameSession(state, new GameEvents(), () => { storedHp = state.heroHp; }, clock, () => .99);
    session.commands.execute({ type: 'resetHero', equipment: false });
    const expected = persistence.statTotal(state.stats.maxHp);
    assert.ok(expected > config.BASE_HERO_MAX_HP);
    assert.equal(session.runtime.hero.hp, expected); assert.equal(storedHp, expected);
    session.commands.execute({ type: 'resetSoulCatcher' });
    assert.equal(storedHp, config.BASE_HERO_MAX_HP);
  });
  await check('Hand and orbit weapons keep independent cooldowns in the session', () => {
    const state = fresh(); state.unlockedAreas.push(2);
    for (const id of ['hammer-uncommon', 'sword-common', 'spear-common']) equipment.applyEquipmentCopies(state, id, 1);
    equipment.equip(state, 'hammer-uncommon', 'orbit1'); equipment.equip(state, 'sword-common', 'orbit2'); equipment.equip(state, 'spear-common', 'orbit3');
    const events = new GameEvents(), hits = [];
    const session = new GameSession(state, events, () => {}, clock, () => .99);
    const crystal = session.runtime.spawnById.get(spawnId); crystal.hp = 10000000;
    session.runtime.hero.position = { ...crystal.position };
    events.on('weaponAttacked', ({slot}) => hits.push(slot));
    session.update(.01, { x: 0, y: 0 }); assert.deepEqual(hits, ['hand1']);
    for (let i=0; i<40; i++) session.update(.05, { x:0, y:0 });
    for (const slot of ['hand1','orbit1','orbit2','orbit3']) assert.ok(hits.includes(slot));
    assert.ok(hits.filter(s=>s==='orbit2').length > hits.filter(s=>s==='orbit1').length);
  });
  await check('Only hostile combat suppresses the out-of-combat regeneration bonus', () => {
    const state = fresh(), events = new GameEvents();
    state.stats.evasion.directChance.other = 1;
    const session = new GameSession(state, events, () => {}, clock, () => 0);
    for (const spawn of session.runtime.spawns) session.runtime.setSpawnAlive(spawn.id, false);
    const regen = persistence.statTotal(state.stats.regen);
    session.runtime.hero.hp = 1;
    session.update(.05, { x: 0, y: 0 });
    near(session.runtime.hero.hp, 1 + regen * config.HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER * .05);
    assert.equal(session.progressionSnapshot().stats.regen.total, regen, 'The displayed stat must remain unmodified');

    session.runtime.hero.hp = 1;
    session.damageHero(100, 'blunt');
    assert.equal(session.runtime.hero.hp, 1, 'An evaded attack must not deal damage');
    assert.equal(session.runtime.hero.combatRemainingSeconds, config.HERO_COMBAT_EXIT_DELAY_SECONDS);
    session.update(.05, { x: 0, y: 0 }, config.HERO_COMBAT_EXIT_DELAY_SECONDS - .01);
    near(session.runtime.hero.hp, 1 + regen * .05);
    session.update(.05, { x: 0, y: 0 }, .01);
    near(session.runtime.hero.hp, 1 + regen * .05 + regen * config.HERO_OUT_OF_COMBAT_REGEN_MULTIPLIER * .05);
    assert.equal(session.runtime.hero.combatRemainingSeconds, 0);
    assert.equal('combatRemainingSeconds' in state, false, 'Transient combat state must not enter the save');
  });
  await check('Hero attacks enter combat for hostile enemies but not passive crystals', () => {
    const hostileState = fresh(), hostileSession = new GameSession(hostileState, new GameEvents(), () => {}, clock, () => .99);
    const hostile = hostileSession.runtime.spawns.find((spawn) => spawn.hostile);
    for (const spawn of hostileSession.runtime.spawns) hostileSession.runtime.setSpawnAlive(spawn.id, spawn === hostile);
    hostile.hp = 10000000; hostile.attackCooldown = 100;
    hostileSession.runtime.hero.position = { ...hostile.position };
    hostileSession.update(.01, { x: 0, y: 0 });
    assert.equal(hostileSession.runtime.hero.combatRemainingSeconds, config.HERO_COMBAT_EXIT_DELAY_SECONDS);

    const passiveState = fresh(), passiveSession = new GameSession(passiveState, new GameEvents(), () => {}, clock, () => .99);
    const crystal = passiveSession.runtime.spawnById.get(spawnId);
    for (const spawn of passiveSession.runtime.spawns) passiveSession.runtime.setSpawnAlive(spawn.id, spawn === crystal);
    crystal.hp = 10000000;
    passiveSession.runtime.hero.position = { ...crystal.position };
    passiveSession.update(.01, { x: 0, y: 0 });
    assert.equal(passiveSession.runtime.hero.combatRemainingSeconds, 0);
  });
  await check('One backup survives a corrupt primary and rotates only from valid saves', () => {
    const storage = memory(), state = fresh();
    state.stats.attack.blunt.additive.kills = 10;
    assert.equal(persistence.persist(state, storage, now), true);
    state.stats.attack.blunt.additive.kills = 20;
    persistence.persist(state, storage, now);
    assert.equal(JSON.parse(storage.getItem(backup)).stats.attack.blunt.additive.kills, 10);
    storage.setItem(primary, '{truncated');
    const recovered = persistence.loadSave(storage, now);
    assert.equal(recovered.stats.attack.blunt.additive.kills, 10);
    recovered.stats.attack.blunt.additive.kills = 15;
    persistence.persist(recovered, storage, now);
    assert.equal(JSON.parse(storage.getItem(backup)).stats.attack.blunt.additive.kills, 10);
    storage.setItem(backup, 'null');
    assert.equal(persistence.loadSave(storage, now).stats.attack.blunt.additive.kills, 15);
    assert.equal(storage.values.size, 2);
  });
  await check('Failed backup writes preserve the current save and non-finite states are rejected', () => {
    const storage = memory(), state = fresh(); persistence.persist(state, storage, now);
    const before = storage.getItem(primary);
    state.stats.maxHp.additive.kills = 10;
    assert.equal(persistence.persist(state, { ...storage, setItem: () => { throw new Error('Storage full'); } }, now), false);
    assert.equal(storage.getItem(primary), before);
    state.stats.maxHp.additive.kills = Infinity;
    assert.equal(persistence.persist(state, storage, now), false);
    assert.equal(storage.getItem(primary), before);
  }, 2);
  await check('Concurrent tabs deliberately allow the last valid writer to win', () => {
    const storage = memory(), first = fresh(), second = fresh();
    first.stats.attack.blunt.additive.kills = 50; second.stats.attack.blunt.additive.kills = 7;
    persistence.persist(first, storage, now); persistence.persist(second, storage, now);
    assert.equal(persistence.loadSave(storage, now).stats.attack.blunt.additive.kills, 7);
    assert.equal(JSON.parse(storage.getItem(backup)).stats.attack.blunt.additive.kills, 50);
  });
  await check('Defeat, boss gates, rewards, and revival run without a renderer', () => {
    const state = fresh(), events = new GameEvents(); let writes = 0, bossEvents = 0, defeatedEvents = 0;
    const session = new GameSession(state, events, () => writes++, clock, () => .99);
    const boss = session.runtime.spawnById.get(config.AREAS[0].bossSpawnId);
    session.runtime.hero.position = { ...boss.position }; state.stats.attack.blunt.additive.kills = 1000000;
    boss.hp = 1;
    events.on('bossDefeated', ({ openedGateIds }) => { bossEvents++; assert.ok(openedGateIds.length > 0); });
    events.on('enemyDefeated', () => defeatedEvents++);
    session.update(.05, { x: 0, y: 0 });
    assert.equal(boss.alive, false); assert.equal(bossEvents, 1); assert.equal(defeatedEvents, 1);
    assert.ok(state.defeatedBosses.includes(boss.id)); assert.ok(state.unlockedAreas.includes(2));
    assert.equal(state.spawns[boss.id].killsToday, 1); assert.ok(state.spawns[boss.id].respawnAt > now.getTime());
    const roll = structuredClone(state.spawns[boss.id].roll);
    session.update(.05, { x: 0, y: 0 }); assert.equal(bossEvents, 1); assert.deepEqual(state.spawns[boss.id].roll, roll);
    state.spawns[boss.id].respawnAt = now.getTime() - 1; session.reviveDueSpawns();
    assert.equal(boss.alive, true); assert.equal(boss.hp, state.spawns[boss.id].roll.maxHp); assert.ok(writes > 0);
  });
  await check('Death, regeneration and midnight reset preserve the session lifecycle', () => {
    const state = fresh(), events = new GameEvents(); let resurrected = 0;
    const session = new GameSession(state, events, () => {}, clock, () => .99);
    events.on('heroResurrected', () => resurrected++);
    session.damageHero(1000000, 'blunt'); assert.equal(session.runtime.hero.dead, true); assert.equal(state.heroHp, 0);
    session.update(.05, { x: 0, y: 0 }, 5);
    assert.equal(resurrected, 1); assert.equal(session.runtime.hero.hp, persistence.statTotal(state.stats.maxHp));
    session.runtime.hero.hp = 1; session.update(.05, { x: 0, y: 0 }); assert.ok(session.runtime.hero.hp > 1);
    state.spawns[spawnId].killsToday = 9; state.dailyKey = '2026-09-11';
    const owned = structuredClone(state.inventory); session.resetAtMidnightIfNeeded();
    assert.equal(state.spawns[spawnId].killsToday, 0); assert.deepEqual(state.inventory, owned);
    assert.equal(state.dailyKey, persistence.localDailyKey(now));
  });
  await check('Reduced water avoids transmission while switching back restores Full', () => {
    const water = new THREE.MeshPhysicalMaterial({ transmission: .16, side: THREE.DoubleSide, transparent: true, opacity: .84 });
    applyWorldMaterialQuality({ water }, .7); assert.equal(water.transmission, 0); assert.equal(water.side, THREE.FrontSide);
    applyWorldMaterialQuality({ water }, 1); assert.equal(water.transmission, .16); assert.equal(water.side, THREE.DoubleSide);
    assert.equal(water.opacity, .84); water.dispose();
  });
  await check('Rare LOD thresholds switch one detail level with hysteresis', () => {
    const model = new THREE.Group();
    for (const distance of [0, 26]) { const child = new THREE.Group(); child.userData.lodDistance = distance; model.add(child); }
    configureModelLod(model); const lod = model.getObjectByName('DistanceLOD');
    const camera = new THREE.PerspectiveCamera(); model.updateMatrixWorld(true);
    for (const [distance, level] of [[20, 0], [30, 1], [45, 1], [25, 1], [22, 0]]) {
      camera.position.z = distance; camera.updateMatrixWorld(true); lod.update(camera);
      assert.equal(lod.getCurrentLevel(), level); assert.equal(lod.children.filter((child) => child.visible).length, 1);
    }
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

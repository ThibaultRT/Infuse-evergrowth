import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
try {
  const [{ loadSave }, { GameSession }, { GameEvents }, minions, souls, config] = await Promise.all([
    vite.ssrLoadModule('/src/save.ts'), vite.ssrLoadModule('/src/game/GameSession.ts'), vite.ssrLoadModule('/src/game/GameEvents.ts'),
    vite.ssrLoadModule('/src/domain/minions.ts'), vite.ssrLoadModule('/src/data/soul-catcher/index.ts'), vite.ssrLoadModule('/src/config.ts')
  ]);
  const now = new Date(2026, 8, 24, 12);
  const fresh = () => loadSave({ getItem: () => null, setItem: () => {} }, now);
  const clock = { now: () => now.getTime(), date: () => now };
  const available = (state) => { state.defeatedBosses.push('area2-rare-01'); state.soulCatcher.highestUnlockedLayer = 3; };
  const sessionFor = (state, events = new GameEvents(), write = () => {}) => new GameSession(state, events, write, clock, () => .4);

  assert.equal(souls.SOUL_LAYERS[0].nodes.filter((node) => node.number).length, 30);
  assert.equal(souls.SOUL_LAYERS[1].nodes.length, 30);
  assert.equal(souls.SOUL_LAYERS[2].nodes.length, 30);
  assert.deepEqual([1, 2, 3].map((layer) => souls.soulNodes(layer).filter((node) => node.id.startsWith('SC-MINION')).length), [1, 1, 1]);
  assert.deepEqual([1, 2, 3].map((slot) => minions.summonCost(slot)), [
    { soulType: 'uncommon', amount: 30 }, { soulType: 'rare', amount: 40 }, { soulType: 'epic', amount: 30 }
  ]);

  const state = fresh(), events = new GameEvents(); available(state);
  state.soulCatcher.nodeLevels['SC-20'] = 1;
  state.soulCatcher.balances.uncommon = 100;
  state.soulCatcher.balances.rare = 100;
  state.soulCatcher.balances.epic = 50;
  let writes = 0, grants = 0, lastGrantWrite = 0;
  events.on('minionSlotUnlocked', ({ slotId, minionId }) => {
    grants++;
    assert.ok(writes > lastGrantWrite);
    lastGrantWrite = writes;
    assert.equal(state.minions.roster.find((member) => member.id === minionId)?.slotId, slotId);
  });
  const session = sessionFor(state, events, () => { writes++; });
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-01' }), true);
  assert.equal(state.soulCatcher.balances.uncommon, 70);
  assert.equal(state.minions.roster.length, 1);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-02' }), false);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-31' }), true);
  assert.equal(session.soulCatcher.soulYield('rare').unlocked, true);
  const beforeSecondXp = state.soulCatcher.xp;
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-02' }), true);
  assert.equal(state.soulCatcher.xp - beforeSecondXp, 3200);
  assert.equal(state.soulCatcher.balances.rare, 60);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-03' }), false);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-61' }), true);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-65' }), true);
  assert.equal(session.soulCatcher.soulYield('epic').unlocked, true);
  const beforeThirdXp = state.soulCatcher.xp;
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-03' }), true);
  assert.equal(state.soulCatcher.xp - beforeThirdXp, 10000);
  assert.equal(state.soulCatcher.balances.epic, 30, 'slot 3 unlock costs 20 Epic and its first summon is free');
  assert.deepEqual(state.minions.roster.map((member) => member.slotId), [1, 2, 3]);
  assert.equal(grants, 3);
  assert.equal(session.commands.execute({ type: 'summonMinion', slotId: 2 }), false, 'occupied slot rejects a summon');

  const [first, second, third] = state.minions.roster;
  second.stats.maxHp.additive.kills = 8;
  second.stats.evasion.raw.kills = .4;
  second.copiesEarned['hammer-common'] = 11;
  second.soulContributions.rare = 7;
  second.hp = 0;
  second.respawnAt = now.getTime() + 30000;
  const occupiedDead = JSON.stringify(state);
  assert.equal(session.commands.execute({ type: 'summonMinion', slotId: 2 }), false);
  assert.equal(JSON.stringify(state), occupiedDead, 'a respawning member still occupies the slot');
  const firstBefore = JSON.stringify(first), thirdBefore = JSON.stringify(third);
  const hammerBefore = state.inventory.items['hammer-common'].level;
  let infusionEvents = 0;
  events.on('minionInfused', ({ minionId, slotId, infusion }) => {
    if (minionId !== second.id) return;
    infusionEvents++;
    assert.equal(minionId, second.id);
    assert.equal(slotId, 2);
    assert.equal(infusion.stats.hp, 4);
    assert.equal(infusion.copies['hammer-common'], 11);
  });
  assert.equal(session.commands.execute({ type: 'sacrificeMinion', minionId: second.id }), true);
  assert.equal(session.commands.execute({ type: 'sacrificeMinion', minionId: second.id }), false);
  assert.equal(infusionEvents, 1);
  assert.equal(state.inventory.items['hammer-common'].level, hammerBefore + 11);
  assert.equal(state.soulCatcher.balances.rare, 5, 'sacrifice must not credit Souls again');
  assert.equal(JSON.stringify(first), firstBefore);
  assert.equal(JSON.stringify(third), thirdBefore);
  assert.deepEqual(state.minions.roster.map((member) => member.slotId), [1, 3]);
  const unchanged = JSON.stringify(state);
  assert.equal(session.commands.execute({ type: 'summonMinion', slotId: 2 }), false);
  assert.equal(JSON.stringify(state), unchanged, 'insufficient balance changes nothing');
  state.soulCatcher.balances.rare = 40;
  assert.equal(session.commands.execute({ type: 'summonMinion', slotId: 2 }), true);
  assert.equal(state.soulCatcher.balances.rare, 0);
  assert.equal(state.minions.roster.find((member) => member.slotId === 2).id, 'minion-4');
  session.commands.execute({ type: 'resetSoulCatcher' });
  assert.deepEqual(state.minions.unlockedSlots, { 1: true, 2: true, 3: true });
  assert.equal(state.minions.roster.length, 3);
  state.soulCatcher.nodeLevels['SC-20'] = 1;
  state.soulCatcher.balances.uncommon = 30;
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-01' }), true);
  assert.equal(state.minions.roster.length, 3, 'reset and repeat purchase cannot grant twice');
  assert.match(session.progressionSnapshot().soulCatcher.layers[0].nodes.find((node) => node.id === 'SC-MINION-01').description, /already permanently unlocked/);
  for (const [slotId, soulType, amount] of [[1, 'uncommon', 30], [2, 'rare', 40], [3, 'epic', 30]]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const member = state.minions.roster.find((entry) => entry.slotId === slotId);
      assert.equal(session.commands.execute({ type: 'sacrificeMinion', minionId: member.id }), true);
      state.soulCatcher.balances[soulType] = amount;
      assert.equal(session.commands.execute({ type: 'summonMinion', slotId }), true);
      assert.equal(state.soulCatcher.balances[soulType], 0, `slot ${slotId} replacement price stays fixed`);
    }
  }
  const slotOne = state.minions.roster.find((entry) => entry.slotId === 1);
  session.commands.execute({ type: 'sacrificeMinion', minionId: slotOne.id });
  session.commands.execute({ type: 'resetSoulCatcher' });
  state.soulCatcher.nodeLevels['SC-20'] = 1;
  state.soulCatcher.balances.uncommon = 30;
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-01' }), true);
  assert.equal(state.minions.roster.some((entry) => entry.slotId === 1), false, 're-purchase cannot restore a sacrificed free member');
  state.soulCatcher.balances.uncommon = 30;
  assert.equal(session.commands.execute({ type: 'summonMinion', slotId: 1 }), true);

  const independent = fresh(); available(independent);
  independent.soulCatcher.balances.rare = 55;
  independent.soulCatcher.balances.epic = 20;
  const independentSession = sessionFor(independent);
  assert.equal(independentSession.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-61' }), true);
  assert.equal(independentSession.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-65' }), true);
  assert.equal(independentSession.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-MINION-03' }), true);
  assert.deepEqual(independent.minions.unlockedSlots, { 1: false, 2: false, 3: true });
  assert.deepEqual(independent.minions.roster.map((member) => member.slotId), [3]);

  const legacy = fresh();
  legacy.version = 19;
  legacy.soulCatcher.nodeLevels['SC-M01'] = 1;
  legacy.minions = { nextSerial: 9, unlockedEver: true, paidSummonCount: 100000, roster: [minions.createMinion('minion-8', 1, () => .8)] };
  delete legacy.minions.roster[0].slotId;
  legacy.minions.roster[0].stats.maxHp.additive.kills = 13;
  legacy.minions.roster[0].copiesEarned['hammer-common'] = 17;
  legacy.minions.roster[0].inventory.items['hammer-common'] = { itemId: 'hammer-common', level: 3, ascend: 1 };
  legacy.minions.roster[0].soulContributions.uncommon = 6;
  legacy.minions.roster[0].respawnAt = now.getTime() + 30000;
  legacy.stats.maxHp.additive.minions = 9;
  legacy.soulCatcher.highestUnlockedLayer = 3;
  const stored = JSON.stringify(legacy);
  const restored = loadSave({ getItem: (key) => key.endsWith('v19') ? stored : null, setItem: () => {} }, now);
  assert.equal(restored.version, 20);
  assert.equal(restored.soulCatcher.nodeLevels['SC-MINION-01'], 1);
  assert.equal(restored.minions.roster.length, 1);
  assert.equal(restored.minions.roster[0].slotId, 1);
  assert.equal(restored.minions.roster[0].color, 'variant-3');
  assert.equal(restored.minions.roster[0].stats.maxHp.additive.kills, 13);
  assert.equal(restored.minions.roster[0].copiesEarned['hammer-common'], 17);
  assert.deepEqual(restored.minions.roster[0].inventory.items['hammer-common'], { itemId: 'hammer-common', level: 3, ascend: 1 });
  assert.equal(restored.minions.roster[0].soulContributions.uncommon, 6);
  assert.equal(restored.minions.roster[0].respawnAt, now.getTime() + 30000);
  assert.equal(restored.stats.maxHp.additive.minions, 9);
  assert.equal(restored.soulCatcher.highestUnlockedLayer, 3, 'changed thresholds cannot relock earned layers');
  assert.deepEqual(restored.minions.unlockedSlots, { 1: true, 2: false, 3: false });
  assert.equal(sessionFor(restored).commands.execute({ type: 'summonMinion', slotId: 2 }), false);
  const duplicate = JSON.parse(JSON.stringify(state));
  duplicate.minions.roster[1].slotId = 1;
  const repaired = loadSave({ getItem: (key) => key.endsWith('v20') ? JSON.stringify(duplicate) : null, setItem: () => {} }, now);
  assert.deepEqual(repaired.minions.roster.map((member) => member.slotId).sort(), [1, 2, 3]);

  for (const member of state.minions.roster) assert.equal(session.runtime.navigation.valid(1, member.position, state.unlockedAreas), true, `slot ${member.slotId} spawn is navigable`);

  const combat = fresh(); available(combat);
  combat.minions.unlockedSlots = { 1: true, 2: true, 3: true };
  combat.minions.roster = [1, 2, 3].map((slotId) => minions.createMinion(`minion-${slotId}`, slotId, () => .2));
  const target = config.SPAWNS.find((spawn) => spawn.areaId === 1 && spawn.tier === 'common');
  for (const spawn of config.SPAWNS) if (spawn.id !== target.id) combat.spawns[spawn.id].respawnAt = now.getTime() + 60000;
  for (const member of combat.minions.roster) member.position = { x: target.x + 1, z: target.z };
  let defeats = 0, rewards = 0;
  const combatEvents = new GameEvents();
  combatEvents.on('enemyDefeated', () => { defeats++; });
  combatEvents.on('minionProgressed', () => { rewards++; });
  const combatSession = sessionFor(combat, combatEvents);
  combatSession.runtime.hero.position = { x: target.x + 15, y: 0, z: target.z + 15 };
  combatSession.runtime.spawnById.get(target.id).hp = 1;
  combatSession.runtime.spawnById.get(target.id).attackCooldown = 100;
  combatSession.update(.05, { x: 0, y: 0 });
  assert.equal(defeats, 1);
  assert.equal(rewards, 1);
  assert.equal(combat.spawns[target.id].killsToday, 1);
  assert.equal(combat.minions.roster.filter((member) => Object.values(member.soulContributions).some(Boolean)).length, 1);
  assert.equal(combat.minions.roster.length, 3);
  {
    const state = fresh();
    available(state);
    state.minions.unlockedSlots[1] = true;
    state.minions.roster.push(minions.createMinion('minion-1', 1, () => .4));
    const session = sessionFor(state);
    // Save migration, remote position, death deadline, and private equipment ledger.
    const owned = state.minions.roster[0];
    state.unlockedAreas.push(2);
    const area2 = config.AREAS.find((area) => area.id === 2);
    owned.areaId = 2; owned.position = { x: area2.originX, z: area2.originZ };
    minions.applyMinionDrop(owned, 'hammer-common', 101, state.unlockedAreas);
    assert.equal(owned.copiesEarned['hammer-common'], 101);
    assert.equal(owned.inventory.items['hammer-common'].ascend, 1);
    owned.stats.maxHp.additive.kills = 3;
    const infusion = minions.calculateInfusion([owned]);
    assert.equal(infusion.stats.hp, 1.5);
    assert.equal(infusion.copies['hammer-common'], 101);
    assert.equal(Object.keys(infusion).includes('souls'), false);
    const saved = JSON.stringify(state);
    const restored = loadSave({ getItem: (key) => key.endsWith('v20') ? saved : null, setItem: () => {} }, now);
    assert.equal(restored.minions.roster[0].areaId, 2);
    assert.deepEqual(restored.minions.roster[0].position, owned.position);
    assert.equal(restored.minions.roster[0].copiesEarned['hammer-common'], 101);
    const partial = JSON.parse(saved);
    partial.minions.roster[0].color = 'missing-color';
    partial.minions.roster[0].inventory.items.unknown = { itemId: 'unknown', level: 9, ascend: 9 };
    partial.minions.roster[0].inventory.equipped.helmet = 'hammer-common';
    partial.minions.roster[0].copiesEarned.unknown = 20;
    partial.minions.roster.push({ ...partial.minions.roster[0], id: 'future-companion' });
    partial.minions.roster.push({ ...partial.minions.roster[0] });
    const repaired = loadSave({ getItem: (key) => key.endsWith('v20') ? JSON.stringify(partial) : null, setItem: () => {} }, now);
    assert.equal(repaired.minions.roster.length, 2, 'extra valid roster entries are assigned distinct slots');
    assert.equal(repaired.minions.roster[0].color, 'variant-1');
    assert.equal(repaired.minions.roster[0].inventory.items.unknown, undefined);
    assert.equal(repaired.minions.roster[0].inventory.equipped.helmet, null);
    assert.equal(repaired.minions.roster[0].copiesEarned.unknown, undefined);
    assert.equal(repaired.minions.roster[1].id, 'future-companion');
    restored.minions.roster[0].respawnAt = now.getTime() - 1;
    const revived = loadSave({ getItem: (key) => key.endsWith('v20') ? JSON.stringify(restored) : null, setItem: () => {} }, now);
    assert.equal(revived.minions.roster[0].respawnAt, null);
    assert.equal(revived.minions.roster[0].areaId, 1);
    assert.equal(revived.minions.roster[0].hp, 203);

    // A path across a gate must use authored crossing and change only the minion area.
    const navigationStart = performance.now();
    const route = session.runtime.navigation.nearestRoute(1, { x: 6, z: 4.5 }, [
      { id: 'remote', areaId: 2, position: { x: area2.originX, z: area2.originZ } }
    ], state.unlockedAreas);
    const navigationMs = performance.now() - navigationStart;
    assert.ok(route, 'unlocked Area 2 should be reachable');
    const traveler = state.minions.roster[0];
    traveler.areaId = 1; traveler.position = { x: 6, z: 4.5 };
    for (const waypoint of route.waypoints) {
      for (let step = 0; step < 100; step++) {
        const remaining = Math.hypot(waypoint.x - traveler.position.x, waypoint.z - traveler.position.z);
        if (remaining < .3) break;
        assert.equal(session.runtime.moveMinion(traveler, waypoint, .5), true, `blocked at ${traveler.position.x},${traveler.position.z}`);
      }
    }
    assert.equal(traveler.areaId, 2);
    assert.equal(session.runtime.currentAreaId, 1);
    for (const area of config.AREAS.filter((area) => area.id > 2)) {
      const allUnlocked = config.AREAS.map((entry) => entry.id);
      const targetSpawn = config.SPAWNS.find((spawn) => spawn.areaId === area.id);
      assert.ok(session.runtime.navigation.nearestRoute(1, { x: 6, z: 4.5 }, [
        { id: targetSpawn.id, areaId: area.id, position: { x: targetSpawn.x, z: targetSpawn.z } }
      ], allUnlocked), `Area ${area.id} should be reachable through opened crossings`);
    }

    const travelState = fresh();
    travelState.unlockedAreas.push(2);
    travelState.minions.unlockedSlots[1] = true;
    travelState.minions.roster.push(minions.createMinion('minion-1', 1, () => 0));
    const remoteCrystal = config.SPAWNS.find((spawn) => spawn.areaId === 2 && spawn.tier === 'crystal');
    assert.ok(remoteCrystal);
    for (const spawn of config.SPAWNS) if (spawn.id !== remoteCrystal.id) travelState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
    const travelSession = new GameSession(travelState, new GameEvents(), () => {}, clock, () => .99);
    travelSession.runtime.spawnById.get(remoteCrystal.id).hp = 1;
    for (let frame = 0; frame < 1000 && travelSession.runtime.spawnById.get(remoteCrystal.id).alive; frame++) travelSession.update(.05, { x: 0, y: 0 });
    assert.equal(travelState.minions.roster[0].areaId, 2, 'AI should cross the gate without moving the hero');
    assert.equal(travelSession.runtime.spawnById.get(remoteCrystal.id).alive, false, 'AI should clear the remote crystal');
    assert.equal(travelSession.runtime.currentAreaId, 1);

    // A distant, high-HP crystal keeps taking damage while the minion regenerates.
    // Neither change emits a damage-to-minion or kill event for the management panel.
    const distantState = fresh();
    distantState.currentAreaId = 4;
    distantState.unlockedAreas = config.AREAS.map((area) => area.id);
    distantState.minions.unlockedSlots[1] = true;
    const distantMinion = minions.createMinion('minion-1', 1, () => 0);
    distantMinion.areaId = 2;
    distantMinion.position = { x: remoteCrystal.x + 1, z: remoteCrystal.z };
    distantMinion.hp = 100;
    distantState.minions.roster.push(distantMinion);
    for (const spawn of config.SPAWNS) if (spawn.id !== remoteCrystal.id) distantState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
    let distantCombatEvents = 0;
    let distantRefreshEvents = 0;
    const distantEvents = new GameEvents();
    distantEvents.on('minionDamaged', () => { distantCombatEvents++; });
    distantEvents.on('minionProgressed', () => { distantCombatEvents++; });
    distantEvents.on('minionVitalsChanged', () => { distantRefreshEvents++; });
    const distantSession = new GameSession(distantState, distantEvents, () => {}, clock, () => .99);
    distantSession.runtime.spawnById.get(remoteCrystal.id).hp = 500;
    for (let frame = 0; frame < 120; frame++) distantSession.update(.05, { x: 0, y: 0 });
    assert.equal(distantSession.runtime.currentAreaId, 4);
    assert.equal(distantMinion.areaId, 2);
    assert.ok(distantSession.runtime.spawnById.get(remoteCrystal.id).hp < 500, 'offscreen crystal HP must keep falling');
    assert.ok(distantMinion.hp > 100, 'offscreen minion HP must keep regenerating');
    assert.equal(distantCombatEvents, 0, 'sustained crystal attacks and regeneration emit no combat event');
    assert.ok(distantRefreshEvents >= 5, 'the panel must receive periodic vitals refresh events');
    const distantActivity = distantSession.progressionSnapshot().minions.roster[0].activity;
    assert.equal(distantActivity.mode, 'attacking');
    assert.equal(distantActivity.target?.id, remoteCrystal.id);
    assert.equal(distantActivity.target?.hp, distantSession.runtime.spawnById.get(remoteCrystal.id).hp);

    // Death keeps private progression and uses a wall-clock deadline on reload.
    const deathState = fresh();
    deathState.minions.unlockedSlots[1] = true;
    const survivor = minions.createMinion('minion-1', 1, () => 0);
    survivor.copiesEarned['hammer-common'] = 8;
    deathState.minions.roster.push(survivor);
    let deathNow = now.getTime();
    const deathClock = { now: () => deathNow, date: () => new Date(deathNow) };
    const deathSession = new GameSession(deathState, new GameEvents(), () => {}, deathClock, () => .99);
    deathSession.damageMinion(survivor.id, 100000, 'blunt');
    assert.equal(survivor.respawnAt, deathNow + 30000);
    assert.equal(survivor.hp, 0);
    const savedDead = JSON.stringify(deathState);
    const beforeDeadline = loadSave({ getItem: (key) => key.endsWith('v20') ? savedDead : null, setItem: () => {} }, new Date(deathNow + 15000));
    assert.equal(beforeDeadline.minions.roster[0].respawnAt, deathNow + 30000);
    const afterDeadline = loadSave({ getItem: (key) => key.endsWith('v20') ? savedDead : null, setItem: () => {} }, new Date(deathNow + 30001));
    assert.equal(afterDeadline.minions.roster[0].respawnAt, null);
    assert.equal(afterDeadline.minions.roster[0].hp, 200);
    assert.equal(afterDeadline.minions.roster[0].copiesEarned['hammer-common'], 8);
    deathNow += 30001;
    deathSession.update(.05, { x: 0, y: 0 });
    assert.equal(survivor.respawnAt, null);
    survivor.hp = 50;
    deathSession.minionAI.afterKill(survivor);
    deathSession.minionAI.update(.05);
    assert.equal(deathSession.minionAI.mode(survivor.id), 'recovering');
    survivor.hp = 150;
    deathSession.minionAI.update(.05);
    assert.notEqual(deathSession.minionAI.mode(survivor.id), 'recovering');

    // A minion's hit takes aggro from a nearby hero; losing that minion restores normal targeting.
    const aggroState = fresh();
    aggroState.minions.unlockedSlots[1] = true;
    const defender = minions.createMinion('minion-1', 1, () => 0);
    aggroState.minions.roster.push(defender);
    const aggroSession = new GameSession(aggroState, new GameEvents(), () => {}, clock, () => .99);
    const aggroDefinition = config.SPAWNS.find((spawn) => spawn.areaId === 1 && spawn.tier === 'common');
    const hostile = aggroSession.runtime.spawnById.get(aggroDefinition.id);
    aggroSession.runtime.hero.position = { ...hostile.position };
    defender.position = { x: hostile.position.x + .1, z: hostile.position.z };
    const firstAttack = aggroSession.runtime.update(.05, { x: 0, y: 0 }, true).find((event) => event.type === 'enemyAttack' && event.spawnId === hostile.id);
    assert.equal(firstAttack?.target.kind, 'hero', 'the closer hero starts as the enemy target');
    hostile.attackCooldown = 0;
    assert.ok(aggroSession.runtime.damageSpawn(hostile.id, 1, { kind: 'minion', minionId: defender.id }));
    const retaliation = aggroSession.runtime.update(.05, { x: 0, y: 0 }, true).find((event) => event.type === 'enemyAttack' && event.spawnId === hostile.id);
    assert.deepEqual(retaliation?.target, { kind: 'minion', minionId: defender.id });
    hostile.attackCooldown = 0;
    const pausedTarget = aggroSession.runtime.update(.05, { x: 0, y: 0 }, true, .05, false)
      .find((event) => event.type === 'enemyAttack' && event.spawnId === hostile.id);
    assert.equal(pausedTarget?.target.kind, 'hero', 'paused minions are excluded from enemy targeting');
    defender.hp = 0; defender.respawnAt = now.getTime() + 30000;
    hostile.attackCooldown = 0;
    const fallback = aggroSession.runtime.update(.05, { x: 0, y: 0 }, true).find((event) => event.type === 'enemyAttack' && event.spawnId === hostile.id);
    assert.equal(fallback?.target.kind, 'hero', 'a dead minion cannot retain enemy aggro');

    // Remote lethal hits credit only their minion and persist a single owner.
    const combatState = fresh();
    combatState.defeatedBosses.push('area2-rare-01');
    combatState.unlockedAreas.push(2);
    combatState.minions.unlockedSlots[1] = true;
    const killer = minions.createMinion('minion-1', 1, () => 0);
    combatState.minions.roster.push(killer); combatState.minions.nextSerial = 2;
    const target = config.SPAWNS.find((spawn) => spawn.areaId === 2 && spawn.tier === 'common');
    assert.ok(target);
    killer.areaId = 2; killer.position = { x: target.x + 1, z: target.z };
    for (const spawn of config.SPAWNS) if (spawn.id !== target.id) combatState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
    let defeatWrites = 0, minionProgress = 0;
    const combatEvents = new GameEvents();
    combatEvents.on('minionProgressed', () => { minionProgress++; assert.equal(defeatWrites, 0, 'routine rewards wait for the autosave interval'); });
    const combatSession = new GameSession(combatState, combatEvents, () => { defeatWrites++; }, clock, () => .99);
    const beforeHero = JSON.stringify(combatState.stats);
    combatSession.runtime.spawnById.get(target.id).hp = 1;
    combatSession.runtime.spawnById.get(target.id).attackCooldown = 100;
    const pausedPosition = { ...killer.position };
    combatSession.update(.05, { x: 0, y: 0 }, .05, true);
    assert.deepEqual(killer.position, pausedPosition, 'idle pause keeps the minion in place');
    assert.equal(combatSession.runtime.spawnById.get(target.id).hp, 1, 'idle pause blocks minion attacks');
    assert.equal(combatSession.progressionSnapshot().minions.roster[0].activity.mode, 'paused');
    combatSession.update(.05, { x: 0, y: 0 });
    assert.equal(minionProgress, 1);
    combatSession.flushSave();
    assert.equal(defeatWrites, 1, 'a lifecycle flush saves the complete remote reward once');
    assert.deepEqual(JSON.stringify(combatState.stats), beforeHero);
    assert.equal(combatState.spawns[target.id].killsToday, 1);
    assert.equal(combatState.minions.roster[0].soulContributions.common, combatState.soulCatcher.balances.common);
    assert.equal(combatState.minions.roster[0].stats.maxHp.additive.kills + combatState.minions.roster[0].stats.regen.additive.kills
      + combatState.minions.roster[0].stats.speed.additive.kills + combatState.minions.roster[0].stats.evasion.raw.kills
      + Object.values(combatState.minions.roster[0].stats.attack).reduce((sum, stat) => sum + stat.additive.kills, 0) > 0, true);

    const simultaneousState = fresh();
    simultaneousState.minions.unlockedSlots[1] = true;
    const partner = minions.createMinion('minion-1', 1, () => 0);
    simultaneousState.minions.roster.push(partner);
    const localTarget = config.SPAWNS.find((spawn) => spawn.areaId === 1 && spawn.tier === 'common');
    for (const spawn of config.SPAWNS) if (spawn.id !== localTarget.id) simultaneousState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
    partner.position = { x: localTarget.x + 1, z: localTarget.z };
    let heroRewards = 0, partnerRewards = 0;
    const simultaneousEvents = new GameEvents();
    simultaneousEvents.on('statGained', () => { heroRewards++; });
    simultaneousEvents.on('minionProgressed', () => { partnerRewards++; });
    const simultaneous = new GameSession(simultaneousState, simultaneousEvents, () => {}, clock, () => .99);
    simultaneous.runtime.hero.position = { x: localTarget.x + 1, y: 0, z: localTarget.z };
    simultaneous.runtime.spawnById.get(localTarget.id).hp = 1;
    simultaneous.runtime.spawnById.get(localTarget.id).attackCooldown = 100;
    simultaneous.update(.05, { x: 0, y: 0 });
    assert.equal(simultaneousState.spawns[localTarget.id].killsToday, 1);
    assert.equal(heroRewards + partnerRewards, 1);

  }

  console.log('Minion validation passed: slots, fixed costs, isolated sacrifice, migration, formation, navigation, recovery, aggro, and single-owner combat.');
} finally { await vite.close(); }

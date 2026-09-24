import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
try {
  const [{ loadSave }, { GameSession }, { GameEvents }, config, minionRules] = await Promise.all([
    vite.ssrLoadModule('/src/save.ts'), vite.ssrLoadModule('/src/game/GameSession.ts'), vite.ssrLoadModule('/src/game/GameEvents.ts'),
    vite.ssrLoadModule('/src/config.ts'), vite.ssrLoadModule('/src/domain/minions.ts')
  ]);
  const now = new Date(2026, 8, 24, 12);
  const fresh = () => loadSave({ getItem: () => null, setItem: () => {} }, now);
  const clock = { now: () => now.getTime(), date: () => now };

  // Unlock and repeat purchase share the typed node path and grant once.
  const state = fresh(), events = new GameEvents();
  state.defeatedBosses.push('area2-rare-01');
  state.soulCatcher.nodeLevels['SC-20'] = 1;
  state.soulCatcher.balances.uncommon = 60;
  let writes = 0, unlocked = 0;
  events.on('minionsUnlocked', () => { unlocked++; assert.equal(writes, 1); assert.equal(state.minions.roster.length, 1); });
  const session = new GameSession(state, events, () => { writes++; }, clock, () => .4);
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-M01' }), true);
  assert.equal(unlocked, 1);
  assert.equal(state.soulCatcher.balances.uncommon, 30);
  assert.equal(state.soulCatcher.xp, 90);
  assert.equal(state.minions.roster[0].color, 'variant-2');
  assert.equal(session.progressionSnapshot().soulCatcher.nextLayerXp, 84292);
  session.commands.execute({ type: 'resetSoulCatcher' });
  state.soulCatcher.nodeLevels['SC-20'] = 1;
  state.soulCatcher.balances.uncommon = 30;
  assert.equal(session.commands.execute({ type: 'purchaseSoulNode', nodeId: 'SC-M01' }), true);
  assert.equal(state.minions.roster.length, 1);
  assert.equal(unlocked, 1);
  assert.equal(state.minions.paidSummonCount, 0);
  assert.match(session.progressionSnapshot().soulCatcher.layers[0].nodes.find((node) => node.id === 'SC-M01').description, /already permanently unlocked/);

  // Slice 7 commands persist once before events and cannot replay an unlock or infusion.
  const commandState = fresh(), commandEvents = new GameEvents();
  let commandWrites = 0, commandUnlocks = 0, infusions = 0;
  commandEvents.on('minionsUnlocked', () => { commandUnlocks++; assert.equal(commandWrites, 1); assert.equal(commandState.minions.roster.length, 1); });
  commandEvents.on('minionsInfused', ({ minionIds, infusion }) => {
    infusions++;
    assert.equal(commandWrites, 2);
    assert.deepEqual(minionIds, ['minion-1', 'future-companion']);
    assert.equal(infusion.stats.hp, 2);
    assert.equal(infusion.copies['hammer-common'], 109);
    assert.equal(commandState.minions.roster.length, 0);
  });
  const commandSession = new GameSession(commandState, commandEvents, () => { commandWrites++; }, clock, () => .4);
  assert.equal(commandSession.commands.execute({ type: 'debugUnlockMinions' }), true);
  assert.equal(commandSession.commands.execute({ type: 'debugUnlockMinions' }), false);
  assert.equal(commandUnlocks, 1);
  assert.equal(commandState.soulCatcher.xp, 0);
  assert.equal(commandState.soulCatcher.balances.uncommon, 0);
  assert.equal(commandSession.commands.execute({ type: 'summonMinion' }), false);
  assert.equal(commandWrites, 1);
  const first = commandState.minions.roster[0];
  first.stats.maxHp.additive.kills = 3;
  first.stats.evasion.raw.kills = .25;
  first.stats.attack.blunt.additive.kills = 5;
  first.copiesEarned['hammer-common'] = 101;
  first.inventory.items['hammer-common'] = { itemId: 'hammer-common', level: 1, ascend: 2 };
  first.soulContributions.common = 7;
  const respawning = minionRules.createMinion('future-companion', () => .8);
  respawning.stats.maxHp.additive.kills = 1;
  respawning.copiesEarned['hammer-common'] = 8;
  respawning.respawnAt = now.getTime() + 30000;
  commandState.minions.roster.push(respawning);
  const preview = commandSession.progressionSnapshot().minions.infusionPreview;
  assert.equal(preview.stats.hp, 2);
  assert.equal(preview.copies['hammer-common'], 109);
  const heroHammerBefore = commandState.inventory.items['hammer-common']?.level ?? 0;
  commandSession.runtime.hero.hp = 10;
  assert.equal(commandSession.commands.execute({ type: 'sacrificeMinions' }), true);
  assert.equal(commandSession.runtime.hero.hp, 12);
  assert.equal(commandState.stats.maxHp.additive.minions, 2);
  assert.equal(commandState.stats.evasion.raw.minions, .125);
  assert.equal(commandState.stats.attack.blunt.additive.minions, 2.5);
  assert.equal(commandState.inventory.items['hammer-common'].level, heroHammerBefore + 109);
  assert.equal(commandState.inventory.items['hammer-common'].ascend, 0);
  assert.equal(commandState.soulCatcher.balances.common, 0, 'sacrifice does not award Souls again');
  assert.equal(commandSession.commands.execute({ type: 'sacrificeMinions' }), false);
  assert.equal(infusions, 1);
  assert.equal(commandWrites, 2);
  commandState.soulCatcher.balances.uncommon = 29;
  assert.equal(commandSession.commands.execute({ type: 'summonMinion' }), false);
  assert.equal(commandState.minions.paidSummonCount, 0);
  commandState.soulCatcher.balances.uncommon = 30;
  assert.equal(commandSession.commands.execute({ type: 'summonMinion' }), true);
  assert.equal(commandState.soulCatcher.balances.uncommon, 0);
  assert.equal(commandState.minions.paidSummonCount, 1);
  assert.equal(commandState.minions.roster[0].id, 'minion-2');
  assert.equal(commandSession.progressionSnapshot().minions.nextSummonCost, 300);
  commandSession.commands.execute({ type: 'resetSoulCatcher' });
  assert.equal(commandState.minions.unlockedEver, true);
  assert.equal(commandState.minions.paidSummonCount, 1);

  // Save migration, remote position, death deadline, and private equipment ledger.
  const owned = state.minions.roster[0];
  state.unlockedAreas.push(2);
  const area2 = config.AREAS.find((area) => area.id === 2);
  owned.areaId = 2; owned.position = { x: area2.originX, z: area2.originZ };
  minionRules.applyMinionDrop(owned, 'hammer-common', 101, state.unlockedAreas);
  assert.equal(owned.copiesEarned['hammer-common'], 101);
  assert.equal(owned.inventory.items['hammer-common'].ascend, 1);
  assert.equal(minionRules.nextSummonCost(0), 30);
  assert.equal(minionRules.nextSummonCost(1), 300);
  assert.equal(minionRules.nextSummonCost(2), 3000);
  owned.stats.maxHp.additive.kills = 3;
  const infusion = minionRules.calculateInfusion([owned]);
  assert.equal(infusion.stats.hp, 1.5);
  assert.equal(infusion.copies['hammer-common'], 101);
  assert.equal(Object.keys(infusion).includes('souls'), false);
  const saved = JSON.stringify(state);
  const restored = loadSave({ getItem: (key) => key.endsWith('v19') ? saved : null, setItem: () => {} }, now);
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
  const repaired = loadSave({ getItem: (key) => key.endsWith('v19') ? JSON.stringify(partial) : null, setItem: () => {} }, now);
  assert.equal(repaired.minions.roster.length, 2, 'extra valid roster entries stay saved beyond current active capacity');
  assert.equal(repaired.minions.roster[0].color, 'variant-1');
  assert.equal(repaired.minions.roster[0].inventory.items.unknown, undefined);
  assert.equal(repaired.minions.roster[0].inventory.equipped.helmet, null);
  assert.equal(repaired.minions.roster[0].copiesEarned.unknown, undefined);
  assert.equal(repaired.minions.roster[1].id, 'future-companion');
  restored.minions.roster[0].respawnAt = now.getTime() - 1;
  const revived = loadSave({ getItem: (key) => key.endsWith('v19') ? JSON.stringify(restored) : null, setItem: () => {} }, now);
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
  travelState.minions.unlockedEver = true;
  travelState.minions.roster.push(minionRules.createMinion('minion-1', () => 0));
  const remoteCrystal = config.SPAWNS.find((spawn) => spawn.areaId === 2 && spawn.tier === 'crystal');
  assert.ok(remoteCrystal);
  for (const spawn of config.SPAWNS) if (spawn.id !== remoteCrystal.id) travelState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
  const travelSession = new GameSession(travelState, new GameEvents(), () => {}, clock, () => .99);
  travelSession.runtime.spawnById.get(remoteCrystal.id).hp = 1;
  for (let frame = 0; frame < 1000 && travelSession.runtime.spawnById.get(remoteCrystal.id).alive; frame++) travelSession.update(.05, { x: 0, y: 0 });
  assert.equal(travelState.minions.roster[0].areaId, 2, 'AI should cross the gate without moving the hero');
  assert.equal(travelSession.runtime.spawnById.get(remoteCrystal.id).alive, false, 'AI should clear the remote crystal');
  assert.equal(travelSession.runtime.currentAreaId, 1);

  // Death keeps private progression and uses a wall-clock deadline on reload.
  const deathState = fresh();
  deathState.minions.unlockedEver = true;
  const survivor = minionRules.createMinion('minion-1', () => 0);
  survivor.copiesEarned['hammer-common'] = 8;
  deathState.minions.roster.push(survivor);
  let deathNow = now.getTime();
  const deathClock = { now: () => deathNow, date: () => new Date(deathNow) };
  const deathSession = new GameSession(deathState, new GameEvents(), () => {}, deathClock, () => .99);
  deathSession.damageMinion(survivor.id, 100000, 'blunt');
  assert.equal(survivor.respawnAt, deathNow + 30000);
  assert.equal(survivor.hp, 0);
  const savedDead = JSON.stringify(deathState);
  const beforeDeadline = loadSave({ getItem: (key) => key.endsWith('v19') ? savedDead : null, setItem: () => {} }, new Date(deathNow + 15000));
  assert.equal(beforeDeadline.minions.roster[0].respawnAt, deathNow + 30000);
  const afterDeadline = loadSave({ getItem: (key) => key.endsWith('v19') ? savedDead : null, setItem: () => {} }, new Date(deathNow + 30001));
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

  // Remote lethal hits credit only their minion and persist a single owner.
  const combatState = fresh();
  combatState.defeatedBosses.push('area2-rare-01');
  combatState.unlockedAreas.push(2);
  combatState.minions.unlockedEver = true;
  const killer = minionRules.createMinion('minion-1', () => 0);
  combatState.minions.roster.push(killer); combatState.minions.nextSerial = 2;
  const target = config.SPAWNS.find((spawn) => spawn.areaId === 2 && spawn.tier === 'common');
  assert.ok(target);
  killer.areaId = 2; killer.position = { x: target.x + 1, z: target.z };
  for (const spawn of config.SPAWNS) if (spawn.id !== target.id) combatState.spawns[spawn.id].respawnAt = now.getTime() + 60000;
  let defeatWrites = 0, minionProgress = 0;
  const combatEvents = new GameEvents();
  combatEvents.on('minionProgressed', () => { minionProgress++; assert.equal(defeatWrites, 1); });
  const combatSession = new GameSession(combatState, combatEvents, () => { defeatWrites++; }, clock, () => .99);
  const beforeHero = JSON.stringify(combatState.stats);
  combatSession.runtime.spawnById.get(target.id).hp = 1;
  combatSession.runtime.spawnById.get(target.id).attackCooldown = 100;
  combatSession.update(.05, { x: 0, y: 0 });
  assert.equal(minionProgress, 1);
  assert.deepEqual(JSON.stringify(combatState.stats), beforeHero);
  assert.equal(combatState.spawns[target.id].killsToday, 1);
  assert.equal(combatState.minions.roster[0].soulContributions.common, combatState.soulCatcher.balances.common);
  assert.equal(combatState.minions.roster[0].stats.maxHp.additive.kills + combatState.minions.roster[0].stats.regen.additive.kills
    + combatState.minions.roster[0].stats.speed.additive.kills + combatState.minions.roster[0].stats.evasion.raw.kills
    + Object.values(combatState.minions.roster[0].stats.attack).reduce((sum, stat) => sum + stat.additive.kills, 0) > 0, true);

  const simultaneousState = fresh();
  simultaneousState.minions.unlockedEver = true;
  const partner = minionRules.createMinion('minion-1', () => 0);
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

  console.log(`Minion validation passed: unlock/reset, migration, infusion math, crossing, remote AI kill, equipment, death/recovery, and single-owner combat. Navigation initial graph: ${navigationMs.toFixed(1)} ms.`);
} finally { await vite.close(); }

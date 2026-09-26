import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
let passed = 0;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
try {
  let reads = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { reads++; throw new Error('Storage must not be read on import'); } });
  const { GameSession } = await vite.ssrLoadModule('/src/game/GameSession.ts');
  const persistence = await vite.ssrLoadModule('/src/save.ts');
  await check('Importing an injected session and persistence does not access browser storage', () => {
    assert.equal(reads, 0); assert.equal('save' in persistence, false);
  });
  const [{ GameEvents }, { heroSpeed }, { SimulationStepper }, { HudPresenter }, { createHudProjection, equipmentDropCopiesRequired }, { WorldAssetLibrary }, { WorldVisualStreamingManager }, { createLayoutVisualProvider }] = await Promise.all([
    vite.ssrLoadModule('/src/game/GameEvents.ts'), vite.ssrLoadModule('/src/systems/HeroStatProjection.ts'),
    vite.ssrLoadModule('/src/game/SimulationStepper.ts'), vite.ssrLoadModule('/src/ui/HudPresenter.ts'),
    vite.ssrLoadModule('/src/systems/HudProjection.ts'), vite.ssrLoadModule('/src/rendering/environment/WorldAssetLibrary.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldVisualStreamingManager.ts'), vite.ssrLoadModule('/src/rendering/environment/LayoutVisualProvider.ts'),
  ]);
  const now = new Date(2026, 8, 25, 12).getTime();
  let time = now;
  const clock = { now: () => time, date: () => new Date(time) };
  const fresh = () => persistence.createNewSave(new Date(now));
  const makeSession = (state = fresh(), write = () => {}) => new GameSession(state, new GameEvents(), write, clock, () => .99);

  await check('Infusion immediately changes measured hero movement speed', () => {
    const state = fresh(), session = makeSession(state);
    const minion = session.minions.unlockSlot(1);
    minion.stats.speed.additive.kills = 15000;
    const before = heroSpeed(state.stats);
    assert.equal(session.commands.execute({ type: 'sacrificeMinion', minionId: minion.id }), true);
    const after = heroSpeed(state.stats); assert.ok(after > before);
    session.runtime.hero.position = { x: 0, y: 0, z: 0 };
    session.runtime.update(.02, { x: 1, y: 0 }, true);
    near(session.runtime.hero.position.x, after * .02);
    session.dispose();
  });

  await check('Routine damage and updates save at most once per 30 seconds; critical commands and exits flush', () => {
    time = now;
    let writes = 0;
    const session = makeSession(fresh(), () => { writes++; });
    session.flushSave(); assert.equal(writes, 1);
    for (let second = 1; second < 30; second++) {
      time = now + second * 1000;
      session.damageHero(.001, 'blunt'); session.update(.01, { x: 0, y: 0 });
    }
    assert.equal(writes, 1);
    time = now + 30000; session.update(.01, { x: 0, y: 0 }); assert.equal(writes, 2);
    session.commands.execute({ type: 'resetHero', equipment: false }); assert.equal(writes, 3);
    time += 1000; session.update(.01, { x: 0, y: 0 }); session.flushSave(); assert.equal(writes, 4);
    session.flushSave(); assert.equal(writes, 4, 'duplicate lifecycle events do not rewrite clean state');
    session.dispose();
  });

  await check('Critical consequences within an update coalesce into one completed-state save', () => {
    time = now;
    let writes = 0;
    const session = makeSession(fresh(), () => { writes++; });
    session.flushSave();
    session.events.on('enemyDamaged', () => { session.persist(true); session.persist(true); });
    const crystal = session.runtime.spawns.find((spawn) => spawn.definition.tier === 'crystal');
    crystal.hp = crystal.maxHp = 1e12;
    session.runtime.hero.position = { ...crystal.position };
    session.update(.01, { x: 0, y: 0 });
    assert.equal(writes, 2);
    session.dispose();
  });

  await check('Failed saves remain dirty without retrying each frame', () => {
    time = now; let writes = 0;
    const session = makeSession(fresh(), () => { writes++; return false; });
    session.flushSave();
    for (let i = 0; i < 20; i++) session.update(.01, { x: 0, y: 0 });
    assert.equal(writes, 1);
    time += 30000; session.update(.01, { x: 0, y: 0 }); assert.equal(writes, 2);
    session.dispose();
  });

  await check('Known-valid previous saves avoid repeated JSON decoding and still validate external writes', () => {
    const values = new Map(), storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const state = fresh(); persistence.persist(state, storage);
    const originalParse = JSON.parse; let parses = 0;
    JSON.parse = (...args) => { parses++; return originalParse(...args); };
    try {
      state.heroHp = 19; persistence.persist(state, storage); assert.equal(parses, 0);
      values.set('infuse-evergrowth-save-v20', '{corrupt');
      persistence.persist(state, storage); assert.equal(parses, 1);
    } finally { JSON.parse = originalParse; }
    assert.ok(persistence.loadSave(storage).stats);
  });

  await check('10, 30 and 60 FPS advance identical movement, combat and regeneration', () => {
    function simulate(fps) {
      time = now;
      const state = fresh(), session = makeSession(state), stepper = new SimulationStepper();
      session.runtime.hero.hp = 1;
      let attacks = 0, simulated = 0;
      session.events.on('weaponAttacked', () => attacks++);
      const crystal = session.runtime.spawns.find((spawn) => spawn.definition.tier === 'crystal');
      crystal.hp = crystal.maxHp = 1e12;
      session.runtime.hero.position = { ...crystal.position };
      for (let frame = 0; frame < 2 * fps; frame++) {
        time = now + (frame + 1) / fps * 1000;
        stepper.advance(1 / fps, (dt) => { simulated += dt; session.update(dt, { x: 0, y: 0 }); });
      }
      const result = { attacks, hp: session.runtime.hero.hp, simulated };
      session.runtime.hero.position = { x: 0, y: 0, z: 0 };
      for (let frame = 0; frame < fps / 2; frame++) stepper.advance(1 / fps, (dt) => session.runtime.update(dt, { x: 1, y: 0 }, true));
      result.x = session.runtime.hero.position.x;
      session.dispose(); return result;
    }
    const reference = simulate(60);
    for (const fps of [30, 10]) {
      const result = simulate(fps); assert.equal(result.attacks, reference.attacks);
      near(result.hp, reference.hp); near(result.simulated, 2); near(result.x, reference.x);
    }
  });

  await check('Long stalls have bounded catch-up; background deadlines resume without offline attacks', () => {
    const stepper = new SimulationStepper(); let steps = 0;
    near(stepper.advance(120, () => steps++), 119.75); assert.equal(steps, 15);
    stepper.advance(.008, () => steps++); stepper.reset(); stepper.advance(.008, () => steps++); assert.equal(steps, 15);
    const session = makeSession(); let hits = 0;
    session.events.on('weaponAttacked', () => hits++);
    session.runtime.damageHero(1e9);
    session.resumeWallClock(120);
    assert.equal(hits, 0); assert.equal(session.runtime.hero.dead, false);
    session.dispose();
  });

  await check('HUD preserves unchanged nodes and recomputes only after relevant events', () => {
    const makeElement = () => { let html = '', writes = 0; return { style: {}, textContent: '', get writes() { return writes; }, get innerHTML() { return html; }, set innerHTML(value) { html = value; writes++; } }; };
    const elements = Object.fromEntries(['hpText', 'hpBar', 'hand1Stat', 'orbit1Stat', 'orbit2Stat', 'orbit3Stat'].map((key) => [key, makeElement()]));
    const events = new GameEvents(), state = fresh(); let projections = 0;
    const hud = new HudPresenter(elements, events, () => { projections++; return createHudProjection(state); });
    for (let frame = 0; frame < 100; frame++) hud.update(20);
    assert.equal(projections, 1); assert.equal(elements.hand1Stat.writes, 1);
    state.stats.attack.blunt.additive.kills = 100;
    events.emit('minionInfused', {}); hud.update(20); assert.equal(projections, 2); assert.equal(elements.hand1Stat.writes, 2);
    events.emit('equipmentDropped', {}); hud.update(20); assert.equal(projections, 3); assert.equal(elements.hand1Stat.writes, 2);
    assert.equal(equipmentDropCopiesRequired('hammer-common', 0), 100);
    hud.dispose(); events.emit('statGained', {}); hud.update(20); assert.equal(projections, 3);
  });

  const resolver = { resolve: () => ({ kind: 'model', url: '/test.glb' }) };
  function model() {
    const map = new THREE.Texture({ width: 256, height: 256 });
    const scene = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }));
    let disposed = 0; scene.geometry.addEventListener('dispose', () => disposed++);
    return { scene, get disposed() { return disposed; } };
  }
  await check('Shared live assets survive eviction; the last release frees geometry, materials and textures', async () => {
    const library = new WorldAssetLibrary(resolver, 0), source = model();
    let requests = 0; library.modelLoader.loadAsync = async () => { requests++; return { scene: source.scene }; };
    const a = library.retain(['test']), b = library.retain(['test']);
    await library.preload(['test']);
    assert.ok(library.snapshot.estimatedBytes > 0);
    await library.instantiate('test', 'one'); await library.instantiate('test', 'two');
    assert.equal(requests, 1); a(); library.trim(); assert.equal(source.disposed, 0);
    b(); assert.equal(source.disposed, 1); assert.equal(library.snapshot.entries, 0);
    a(); b(); assert.equal(source.disposed, 1);
    const c = library.retain(['test']); await library.preload(['test']); assert.equal(requests, 2); c(); library.dispose();
  });

  await check('Asset cache evicts least recently used unreferenced resources to its byte budget', async () => {
    const a = model(), b = model(), library = new WorldAssetLibrary(resolver, 400000);
    library.modelLoader.loadAsync = async (url) => ({ scene: url === '/a' ? a.scene : b.scene });
    library.resolver.resolve = (key) => ({ kind: 'model', url: `/${key}` });
    const releaseA = library.retain(['a']); await library.preload(['a']); releaseA();
    const releaseB = library.retain(['b']); await library.preload(['b']); releaseB();
    assert.equal(a.disposed, 1); assert.equal(b.disposed, 0); assert.ok(library.snapshot.estimatedBytes <= 400000);
    library.dispose(); assert.equal(b.disposed, 1);
  });

  await check('Late loads release resources after their owner disappears', async () => {
    const library = new WorldAssetLibrary(resolver, 0), source = model(); let finish;
    library.modelLoader.loadAsync = () => new Promise((resolve) => { finish = resolve; });
    const release = library.retain(['late']), loading = library.preload(['late']);
    release(); finish({ scene: source.scene }); await loading;
    assert.equal(source.disposed, 1); assert.equal(library.snapshot.entries, 0);
    library.dispose();
  });

  await check('Provider and streaming teardown dispose late mounts and release prefetch leases', async () => {
    let leases = 0, views = 0, finish;
    const builder = { retain: () => { leases++; return () => leases--; }, prefetch: async () => {},
      build: () => new Promise((resolve) => { finish = () => resolve({ root: new THREE.Group(), dispose: () => views++ }); }) };
    const provider = createLayoutVisualProvider({ kind: 'area', areaId: 1 }, builder);
    const streaming = new WorldVisualStreamingManager(new THREE.Scene(), [{ id: 1 }], [], [provider], { prefetchDistance: 1, mountDistance: 1, unmountDistance: 2 });
    streaming.update(1, { x: 0, z: 0 }); await new Promise(setImmediate);
    assert.equal(leases, 1); streaming.dispose(); finish(); await new Promise(setImmediate);
    assert.equal(leases, 0); assert.equal(views, 1); assert.equal(streaming.snapshot.mountedAreaIds.size, 0);
  });
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
  await vite.close();
}
console.log(`Review-fix regressions: ${passed} passed.`);

import { SimulationStepper } from './SimulationStepper';
import { Lifetime } from '../ui/Lifetime';
import { HudPresenter } from '../ui/HudPresenter';
import { createHudProjection } from '../systems/HudProjection';
import { SpawnPresentation } from '../rendering/presenters/SpawnPresentation';
import { GatePresentation } from '../rendering/presenters/GatePresentation';
import { BossPresentation } from '../rendering/presenters/BossPresentation';
import { RespawnIndicators } from '../rendering/presenters/RespawnIndicators';
import { CombatPresentation } from '../rendering/presenters/CombatPresentation';
import * as THREE from 'three';
import { AREAS, WORLD_CONNECTIONS, SPAWNS, areaById, VISUAL_STREAMING } from '../config';
import type { SaveData } from '../types';
import { GameSession } from './GameSession';
import { mountGameUi } from '../ui/GameUiController';
import { renderEnemyAffinities, showToast, ui } from '../ui';
import { InputController } from '../controllers/InputController';
import { MinionIdleController } from '../controllers/MinionIdleController';
import { CameraController, DEFAULT_CAMERA_DISTANCE } from '../controllers/CameraController';
import { GameEvents } from './GameEvents';
import { effectivePixelRatio, loadRenderingQuality, saveRenderingQuality, type RenderingQualitySettings } from '../rendering/RenderingQuality';
import { HeroView } from '../rendering/HeroView';
import { EffectManager } from '../rendering/EffectManager';
import { WorldUiManager } from '../rendering/WorldUiManager';
import { EnvironmentOcclusionManager } from '../rendering/EnvironmentOcclusionManager';
import { WorldVisualStreamingManager, type VisualChunkProvider } from '../rendering/environment/WorldVisualStreamingManager';
import { WORLD_LAYOUTS } from '../data/world';
import { WorldAssetLibrary } from '../rendering/environment/WorldAssetLibrary';
import { ProductionWorldAssetResolver } from '../rendering/environment/WorldVisualAssetCatalog';
import { createWorldMaterials, applyWorldMaterialQuality, disposeWorldMaterials } from '../rendering/environment/WorldMaterials';
import { WorldBuilder } from '../rendering/environment/WorldBuilder';
import { createLayoutVisualProvider } from '../rendering/environment/LayoutVisualProvider';
import { MinionPresentation } from '../rendering/MinionPresentation';

export class Game {
  private started = false;
  private teardown: (() => void) | null = null;
  dispose(): void { this.teardown?.(); this.teardown = null; this.started = false; }

  start(save: SaveData, writeSave: (state: SaveData) => boolean): void {
    if (this.started) return;
    this.started = true;
    const lifetime = new Lifetime();
    const stepper = new SimulationStepper();
    const events = new GameEvents();
    const input = new InputController(ui.joystick, ui.joystickKnob);
    const minionIdle = new MinionIdleController();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x93b8cf);
    scene.fog = new THREE.Fog(0x93b8cf, 42, 82);
    const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 180);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    let rendererContextAvailable = true;
    lifetime.listen(renderer.domElement, 'webglcontextlost', (event) => {
      event.preventDefault();
      rendererContextAvailable = false;
      showToast('Display recovering. Gameplay continues.');
    });
    lifetime.listen(renderer.domElement, 'webglcontextrestored', () => {
      rendererContextAvailable = true;
      resizeViewport();
      showToast('Graphics restored.');
    });
    const effects = new EffectManager(scene);
    const worldUi = new WorldUiManager(camera, renderer.domElement, ui.world);
    let saveFailureShown = false;
    const session = new GameSession(save, events, () => {
      const saved = writeSave(save);
      if (!saved && !saveFailureShown) {
        saveFailureShown = true;
        showToast('Saving is unavailable. Progress will be lost when this page closes.');
      }
      return saved;
    });
    const gameplay = session.runtime;
    const soulCatcher = session.soulCatcher;
    events.on('soulCatcherLayerUnlocked', ({ layer }) => showToast(`Soul Catcher Layer ${layer} unlocked!`));
    let renderingQuality = loadRenderingQuality();
    renderer.setPixelRatio(effectivePixelRatio(renderingQuality));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    ui.canvasHost.append(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.8);
    scene.add(sun, sun.target);

    let currentAreaId = gameplay.currentAreaId;
    const heroView = new HeroView();
    heroView.syncEquipment(save.inventory);
    const hero = heroView.root;
    hero.position.copy(gameplay.hero.position);
    scene.add(hero);

    const cameraController = new CameraController(camera, hero.position);
    ui.cameraDistance.value = DEFAULT_CAMERA_DISTANCE.toFixed(1);
    ui.cameraDistanceValue.value = ui.cameraDistance.value;
    lifetime.listen(ui.cameraDistance, 'input', () => {
      const distance = ui.cameraDistance.valueAsNumber;
      cameraController.setFollowDistance(distance);
      ui.cameraDistanceValue.value = distance.toFixed(1);
    });
    const environmentOcclusion = new EnvironmentOcclusionManager(camera);

    function syncLighting(): void {
      const area = areaById(currentAreaId);
      const sunlit = area.environmentTheme === 'sunlit-meadow';
      const sky = sunlit ? 0xadd8e6 : 0x93b8cf;
      scene.background = new THREE.Color(sky);
      scene.fog = new THREE.Fog(sky, sunlit ? 48 : 42, sunlit ? 88 : 82);
      hemisphere.color.setHex(sunlit ? 0xe9f8ff : 0xdaf2ff);
      hemisphere.groundColor.setHex(sunlit ? 0x567044 : 0x51613f);
      hemisphere.intensity = sunlit ? 2.45 : 2.2;
      sun.color.setHex(sunlit ? 0xfff2cc : 0xfff0d2);
      sun.intensity = sunlit ? 3.1 : 2.8;
      sun.position.set(area.originX - 12, 22, area.originZ + 8);
      sun.target.position.set(area.originX, 0, area.originZ);
    }
    syncLighting();
    cameraController.snapToHero();

    const entities = SPAWNS.map((spawn) => new SpawnPresentation(spawn, { runtime: gameplay, state: save, souls: soulCatcher, scene, host: ui.world, effects, worldUi }));

    const gateEntities = WORLD_CONNECTIONS.map((gate) => new GatePresentation(gate, save.unlockedAreas));

    const worldAssetLibrary = new WorldAssetLibrary(new ProductionWorldAssetResolver());
    const worldMaterials = createWorldMaterials(worldAssetLibrary).then((materials) => { applyWorldMaterialQuality(materials, renderingQuality.renderScale); return materials; });
    const worldBuilder = worldMaterials.then((materials) => new WorldBuilder(worldAssetLibrary, materials));
    const visualProviders: VisualChunkProvider[] = WORLD_LAYOUTS.map((layout) => {
      const gate = layout.kind === 'transition' ? gateEntities.find((candidate) => candidate.def.id === layout.connectionId) : undefined;
      return createLayoutVisualProvider(layout, worldBuilder, {
        onCreated: (view) => gate?.attachView(view),
        onDisposed: (view) => gate?.detachView(view),
      });
    });
    const visualStreaming = new WorldVisualStreamingManager(
      scene, AREAS, WORLD_CONNECTIONS, visualProviders, VISUAL_STREAMING,
      (root) => environmentOcclusion.register(root),
      (root) => environmentOcclusion.unregister(root)
    );
    visualStreaming.update(currentAreaId, gameplay.hero.position);
    const minionPresentation = new MinionPresentation(scene, ui.minionPitButton, worldUi, (areaId) => visualStreaming.areaIsMounted(areaId));

    function syncAreaVisibility(): void {
      entities.forEach((entity) => entity.syncAreaVisibility());
      syncLighting();
    }

    const respawnIndicators = new RespawnIndicators(entities, ui.world, save, worldUi);
    const bossPresentation = new BossPresentation({ entities, gates: gateEntities, input, camera: cameraController, effects, souls: soulCatcher });
    const hud = new HudPresenter(ui, events, () => createHudProjection(save));
    const combatPresentation = new CombatPresentation({ session, heroView, entities, gates: gateEntities, minions: minionPresentation,
      boss: bossPresentation, camera: cameraController, input, effects, worldUi });
    events.on('areaEntered', ({ areaId }) => completeContinuousAreaEntry(areaId));

    function applyRenderingQuality(next: RenderingQualitySettings): void {
      renderingQuality = next;
      saveRenderingQuality(next);
      void worldMaterials.then((materials) => applyWorldMaterialQuality(materials, renderingQuality.renderScale));
      resizeViewport();
      ui.rendererStats.classList.toggle('visible', import.meta.env.DEV && next.showStats);
      if (import.meta.env.DEV && next.showStats) {
        statsFrames = 0; statsStartedAt = performance.now(); ui.rendererStats.textContent = 'Measuring renderer…';
      }
    }
    const unmountUi = mountGameUi(session, { current: () => renderingQuality, apply: applyRenderingQuality },
      { enabled: () => minionIdle.enabled, setEnabled: (enabled) => minionIdle.setEnabled(enabled) }, updateHud);

    function completeContinuousAreaEntry(targetAreaId: number): void {
      currentAreaId = targetAreaId;
      renderEnemyAffinities(areaById(targetAreaId));
      syncAreaVisibility();
      showToast(areaById(targetAreaId).name);
    }

    function syncEnemyPresentations(): void {
      for (const entity of entities) {
        const areaRelevant = visualStreaming.areaIsMounted(entity.def.areaId);
        const limit = entity.presentationActive ? VISUAL_STREAMING.enemyDeactivateDistance : VISUAL_STREAMING.enemyActivateDistance;
        const required = entity.deathPresentationRemaining > 0;
        entity.setPresentationActive(areaRelevant && (required || entity.distanceToHero() <= limit));
      }
    }

    function updateGates(dt: number): void {
      gateEntities.forEach((gate) => gate.update(dt));
    }

    function updateTargetUi(): void {
      for (const entity of entities) {
        if (!entity.presentationActive || !entity.alive) {
          entity.targetUi.style.visibility = 'hidden';
          continue;
        }
        worldUi.project(entity.root.position, entity.targetUi, entity.def.tier === 'crystal' ? 2.05 : 3.05);
      }
    }

    function updateHud(): void {
      hud.update(gameplay.hero.hp);
      updateTargetUi();
      respawnIndicators.update(currentAreaId);
    }

    function resizeViewport(): void {
      const viewportHeight = window.visualViewport?.height ?? innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
      const width = ui.canvasHost.clientWidth;
      const height = ui.canvasHost.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(effectivePixelRatio(renderingQuality));
    }
    lifetime.listen(window, 'resize', resizeViewport);
    lifetime.listen(window.visualViewport, 'resize', resizeViewport);
    resizeViewport();
    let hiddenAt: number | null = document.hidden ? performance.now() : null;
    lifetime.listen(document, 'visibilitychange', () => {
      const now = performance.now();
      stepper.reset(); previous = now; lastRenderedAt = now;
      if (document.hidden) { hiddenAt = now; session.flushSave(); }
      else {
        session.resumeWallClock(hiddenAt === null ? 0 : (now - hiddenAt) / 1000);
        hiddenAt = null;
      }
    });
    lifetime.listen(window, 'pagehide', () => session.flushSave());

    syncAreaVisibility();
    syncEnemyPresentations();
    let previous = performance.now();
    let lastRenderedAt = previous;
    let statsStartedAt = performance.now();
    let statsFrames = 0;
    function frame(now: number): void {
      lifetime.frame(frame);
      const elapsedSeconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (document.hidden) return;
      const movement = input.movement;
      const minionsPaused = minionIdle.paused(now, movement);
      const skipped = stepper.advance(elapsedSeconds, (step) => session.update(step, movement, step, minionsPaused));
      if (skipped > 0) session.resumeWallClock(skipped);
      const minimumFrameMs = 1000 / renderingQuality.frameRateLimit;
      if (now - lastRenderedAt < minimumFrameMs - 1) return;
      const dt = Math.min((now - lastRenderedAt) / 1000, .25);
      lastRenderedAt = now;
      combatPresentation.update(dt);
      visualStreaming.update(currentAreaId, gameplay.hero.position);
      syncEnemyPresentations();
      updateGates(dt);
      entities.forEach((entity) => entity.syncTransform());
      entities.forEach((entity) => entity.updateView(dt));
      cameraController.update(dt, now);
      minionPresentation.update(dt, Object.values(save.minions.unlockedSlots).some(Boolean), save.minions.roster, gameplay.hero.position, (id) => !minionsPaused && session.minionAI.mode(id) === 'moving');
      environmentOcclusion.update(hero.position, dt);
      updateHud();
      worldUi.update(dt);
      effects.update(dt);
      if (rendererContextAvailable) renderer.render(scene, camera);
      if (import.meta.env.DEV && renderingQuality.showStats) {
        statsFrames += 1;
        const elapsed = now - statsStartedAt;
        if (elapsed >= 500) {
          const info = renderer.info.render;
          const visualResidency = visualStreaming.snapshot;
          const activeMixers = entities.filter((entity) => entity.presentationActive && entity.alive && entity.enemyView?.animationReady).length + (heroView.animationReady ? 1 : 0);
          const mountedAreas = [...visualResidency.mountedAreaIds].sort().join(', ') || 'none';
          const mountedTransitions = [...visualResidency.mountedTransitionIds].sort().join(', ') || 'none';
          const activeEnemies = entities.filter((entity) => entity.presentationActive).length;
          ui.rendererStats.textContent = `${Math.round(statsFrames * 1000 / elapsed)} FPS\n${info.calls} calls · ${info.triangles.toLocaleString()} triangles\narea ${currentAreaId} · hero ${gameplay.hero.position.x.toFixed(1)}, ${gameplay.hero.position.z.toFixed(1)}\nvisuals ${mountedAreas}\ntransitions ${mountedTransitions}\nloading ${visualResidency.pendingIds.join(', ') || 'none'}\n${activeEnemies} enemy presentations · ${activeMixers} mixers\n${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures\n${Math.round(worldAssetLibrary.snapshot.estimatedBytes / 1048576)} MiB estimated world assets (${Math.round(worldAssetLibrary.snapshot.unusedBytes / 1048576)} unused)\n${environmentOcclusion.diagnostic}\n${renderer.domElement.width}×${renderer.domElement.height} buffer`;
          statsFrames = 0;
          statsStartedAt = now;
        }
      }
    }

    renderEnemyAffinities(areaById(currentAreaId));
    updateHud();
    session.flushSave();
    if (soulCatcher.available && !save.soulCatcher.unlockAnnouncementSeen) lifetime.timeout(() => { if (soulCatcher.announceUnlock(2)) { showToast('Soul Catcher unlocked!'); lifetime.timeout(() => showToast('Infuse souls of the defeated enemies and unlock powerful upgrades!'), 1600); } }, 500);
    lifetime.frame(frame);

    this.teardown = () => {
      session.flushSave();
      lifetime.dispose(); unmountUi(); hud.dispose(); bossPresentation.dispose(); respawnIndicators.dispose();
      combatPresentation.dispose(); session.dispose(); events.clear(); input.dispose(); minionIdle.dispose();
      visualStreaming.dispose(); entities.forEach((entity) => entity.dispose());
      minionPresentation.dispose(); heroView.dispose(); effects.dispose(); worldUi.dispose();
      void worldMaterials.then((materials) => { disposeWorldMaterials(materials); worldAssetLibrary.dispose(); });
      renderer.dispose(); renderer.domElement.remove(); scene.clear();
    };
  }
}

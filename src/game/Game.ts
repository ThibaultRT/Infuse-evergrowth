import * as THREE from 'three';
import { AREAS, WORLD_CONNECTIONS, SPAWNS, TIER_CONFIG, areaById, VISUAL_STREAMING } from '../config';
import { combatAffinityIcon, damageTypeIcon, evasionIcon, heartIcon, heartRegenIcon, shieldIcon, weaponClassIcon } from '../icons';
import { persist, save } from '../save';
import { maxHeroHp } from '../systems/HeroStats';
import { GameSession } from './GameSession';
import { mountGameUi } from '../ui/GameUiController';
import type { CombatAffinity, DamageType, LootType, SpawnDefinition, TierConfig, WeaponSlotId, WorldConnection } from '../types';
import { renderEnemyAffinities, showBossProgression, showEquipmentDrop, showSoulDrop, showStatGain, showToast, ui } from '../ui';
import { makeTierRing } from '../visuals';
import { CrystalView } from '../rendering/CrystalView';
import { InputController } from '../controllers/InputController';
import { CameraController } from '../controllers/CameraController';
import { GameEvents } from './GameEvents';
import { EQUIPMENT_BY_ID, attackProfile } from '../systems/EquipmentSystem';
import { effectivePixelRatio, loadRenderingQuality, saveRenderingQuality, type RenderingQualitySettings } from '../rendering/RenderingQuality';
import { HeroView } from '../rendering/HeroView';
import { EnemyView } from '../rendering/EnemyView';
import { EffectManager } from '../rendering/EffectManager';
import { WorldUiManager } from '../rendering/WorldUiManager';
import { type RuntimeSpawn } from './GameplayRuntime';
import { EnvironmentOcclusionManager } from '../rendering/EnvironmentOcclusionManager';
import { browserClock } from './PlatformAdapters';
import { WorldVisualStreamingManager, type VisualChunkProvider } from '../rendering/environment/WorldVisualStreamingManager';
import { WORLD_LAYOUTS } from '../data/world';
import { WorldAssetLibrary } from '../rendering/environment/WorldAssetLibrary';
import { ProductionWorldAssetResolver } from '../rendering/environment/WorldVisualAssetCatalog';
import { createWorldMaterials, applyWorldMaterialQuality } from '../rendering/environment/WorldMaterials';
import { WorldBuilder, type WorldChunkView } from '../rendering/environment/WorldBuilder';
import { createLayoutVisualProvider } from '../rendering/environment/LayoutVisualProvider';

export class Game {
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
const events = new GameEvents();
const input = new InputController(ui.joystick, ui.joystickKnob);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b8cf);
scene.fog = new THREE.Fog(0x93b8cf, 42, 82);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let rendererContextAvailable = true;
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  rendererContextAvailable = false;
  showToast('Display recovering. Gameplay continues.');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  rendererContextAvailable = true;
  resizeViewport();
  showToast('Graphics restored.');
});
const effects = new EffectManager(scene);
const worldUi = new WorldUiManager(camera, renderer.domElement, ui.world);
let saveFailureShown = false;
const session = new GameSession(save, events, () => {
  if (!persist(save) && !saveFailureShown) {
    saveFailureShown = true;
    showToast('Saving is unavailable. Progress will be lost when this page closes.');
  }
});
const gameplay = session.runtime;
const soulCatcher = session.soulCatcher;
const persistGame = (): void => session.persist();
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
const initialArea = areaById(currentAreaId);
const heroView = new HeroView();
heroView.syncEquipment(save.inventory);
events.on('equipmentEquipped', () => heroView.syncEquipment(save.inventory));
events.on('equipmentUnequipped', () => heroView.syncEquipment(save.inventory));
const hero = heroView.root;
hero.position.copy(gameplay.hero.position);
scene.add(hero);
let heroDeathHidden = false;

const cameraController = new CameraController(camera, hero.position);
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
camera.position.set(initialArea.originX, 19, initialArea.originZ + 16.5);

function formatRewardAmount(amount: number): string {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function lootIcon(type: LootType, size = 9): string {
  return type === 'regen' ? heartRegenIcon(size) : type === 'hp' ? heartIcon(size) : type === 'speed' ? '<span aria-label="Speed">SPD</span>' : damageTypeIcon(type, size);
}

function showCombatText(position: THREE.Vector3, amount: number, type: CombatAffinity | DamageType, incoming = false, blocked = false): void {
  const icon = blocked ? shieldIcon(11) : incoming ? combatAffinityIcon(type as CombatAffinity, 10) : damageTypeIcon(type as DamageType, 10);
  worldUi.addCombatText(position, `${blocked ? icon : ''}<span>${incoming ? '-' : ''}${Math.round(amount)}</span>${blocked ? '' : icon}`, incoming);
}

function showEvadedCombatText(position: THREE.Vector3): void {
  worldUi.addCombatText(position, `<span>Evaded</span>${evasionIcon(11)}`, true);
}

function weaponCombatIcon(itemId: string): string {
  const item = EQUIPMENT_BY_ID.get(itemId);
  return item?.kind === 'weapon'
    ? `<span class="combat-weapon-icon rarity-${item.rarity}" aria-label="${item.name}">${weaponClassIcon(item.weaponClass, 10)}</span>`
    : damageTypeIcon('blunt', 10);
}

const WEAPON_DAMAGE_TEXT_OFFSET: Record<WeaponSlotId, { x: number; y: number }> = {
  hand1: { x: 0, y: 0 },
  orbit1: { x: 72, y: 0 },
  orbit2: { x: 0, y: 20 },
  orbit3: { x: 72, y: 20 }
};

class SpawnEntity {
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly weakness: CombatAffinity | null;
  readonly targetUi = document.createElement('div');
  readonly lootLabel = document.createElement('div');
  readonly healthBar = document.createElement('div');
  readonly healthFill = document.createElement('span');
  readonly healthValue = document.createElement('strong');
  enemyView: EnemyView | null = null;
  crystalView: CrystalView | null = null;
  presentationActive = false;
  deathPresentationRemaining = 0;
  readonly state: RuntimeSpawn;

  constructor(readonly def: SpawnDefinition) {
    this.state = gameplay.spawnById.get(def.id)!;
    this.config = TIER_CONFIG[def.tier];
    this.weakness = def.enemyWeakness === undefined ? areaById(def.areaId).enemyWeakness : def.enemyWeakness;
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.targetUi.className = `world-target-ui rarity-${def.tier}`;
    this.lootLabel.className = 'world-loot';
    this.healthBar.className = 'world-hp-bar';
    this.healthValue.className = 'world-hp-value';
    this.healthBar.append(this.healthFill, this.healthValue);
    this.targetUi.append(this.lootLabel, this.healthBar);
    this.renderLoot();
    this.renderHealth();
    this.syncAreaVisibility();
  }

  get alive(): boolean { return this.state.alive; }
  get hp(): number { return this.state.hp; }
  get maxHp(): number { return this.state.maxHp; }
  setPresentationActive(active: boolean): void {
    if (active === this.presentationActive) return;
    this.presentationActive = active;
    if (active) {
      this.enemyView = this.def.tier === 'crystal' ? null : new EnemyView(this.def.tier, this.config.color);
      this.crystalView = this.def.tier === 'crystal' ? new CrystalView(this.config.color, this.def.areaId) : null;
      this.root.add(this.enemyView?.root ?? this.crystalView!.root, makeTierRing(this.config.color));
      scene.add(this.root);
      ui.world.append(this.targetUi);
      this.syncTransform();
    } else {
      this.root.removeFromParent();
      this.enemyView?.dispose();
      this.crystalView?.dispose();
      this.root.clear();
      this.targetUi.remove();
      this.enemyView = null;
      this.crystalView = null;
    }
    this.syncAreaVisibility();
  }
  renderLoot(): void {
    const reward = save.spawns[this.def.id].roll.reward;
    const loot = reward.stat;
    this.lootLabel.className = `world-loot ${loot}`;
    const soul = soulCatcher.yieldFor(this.def);
    this.lootLabel.innerHTML = `<span>${formatRewardAmount(reward.amount)}</span>${lootIcon(loot)}${soul ? `<span class="world-soul-reward"><span>${soul.quantity}</span><i class="soul-icon soul-${soul.soulType}"></i></span>` : ''}`;
  }

  renderHealth(): void {
    const hp = Math.max(0, this.hp);
    this.healthFill.style.width = `${(hp / this.maxHp) * 100}%`;
    this.healthValue.textContent = String(Math.ceil(hp));
    this.healthBar.setAttribute('aria-label', `${Math.ceil(hp)} of ${this.maxHp} health`);
  }

  syncAreaVisibility(): void {
    const visible = this.presentationActive && (this.alive || this.deathPresentationRemaining > 0);
    this.root.visible = visible;
    this.targetUi.classList.toggle('hidden', !this.presentationActive || !this.alive);
  }

  presentRespawn(): void {
    this.deathPresentationRemaining = 0;
    this.crystalView?.reset();
    this.renderLoot();
    this.renderHealth();
    this.syncTransform();
    this.syncAreaVisibility();
  }

  resetAfterHeroDefeat(): void { this.renderHealth(); this.syncTransform(); }
  distanceToHero(): number { return gameplay.distanceFromHero(this.state.position); }

  presentDamage(amount: number, type: DamageType, itemId: string, slot: WeaponSlotId): void {
    effects.impact(this.root.position, type);
    this.enemyView?.playHit();
    worldUi.addCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), `<span>-${Math.round(amount)}</span>${weaponCombatIcon(itemId)}`, false, WEAPON_DAMAGE_TEXT_OFFSET[slot]);
    this.renderHealth();
  }

  presentDefeat(): void {
    this.enemyView?.playDeath();
    this.crystalView?.playDeath();
    this.deathPresentationRemaining = this.crystalView ? .45 : 1.1;
    this.syncAreaVisibility();
  }

  syncTransform(): void {
    const previousX = this.root.position.x;
    const previousZ = this.root.position.z;
    this.root.position.copy(this.state.position);
    if (this.state.moving) this.root.rotation.y = Math.atan2(this.root.position.x - previousX, this.root.position.z - previousZ);
  }

  updateView(dt: number): void {
    this.crystalView?.update(dt);
    if (this.deathPresentationRemaining > 0) {
      this.deathPresentationRemaining = Math.max(0, this.deathPresentationRemaining - dt);
      if (this.deathPresentationRemaining === 0) this.syncAreaVisibility();
    }
    this.enemyView?.update(dt, this.state.moving, this.def.areaId === currentAreaId && (this.alive || this.deathPresentationRemaining > 0));
  }
}

const entities = SPAWNS.map((spawn) => new SpawnEntity(spawn));

class GateEntity {
  readonly position: THREE.Vector3;
  private view: WorldChunkView | null = null;
  open: boolean;

  constructor(readonly def: WorldConnection) {
    this.position = new THREE.Vector3(def.x, 0, def.z);
    this.open = save.unlockedAreas.includes(def.requiredUnlockedAreaId);
  }

  attachView(view: WorldChunkView): void {
    this.view = view;
    view.setOpen(this.open);
  }

  detachView(view: WorldChunkView): void {
    if (this.view === view) this.view = null;
  }

  setOpen(value: boolean): void {
    this.open = value;
    this.view?.setOpen(value);
  }

  update(dt: number): void { this.view?.update(dt); }
}

const gateEntities = WORLD_CONNECTIONS.map((gate) => new GateEntity(gate));

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

function syncAreaVisibility(): void {
  entities.forEach((entity) => entity.syncAreaVisibility());
  syncLighting();
}

function startGateCinematic(gate: GateEntity): void {
  input.reset();
  cameraController.focus(gate.position, 2600);
}

function presentBossDefeat(result: { bossId: string; areaId: number; openedGateIds: string[] }): void {
  const bossEntity = entities.find((entity) => entity.def.id === result.bossId)!;
  bossEntity.setPresentationActive(true);
  effects.bossDefeat(bossEntity.spawnPosition);
  const openedGates = gateEntities.filter((gate) => result.openedGateIds.includes(gate.def.id));
  for (const gate of openedGates) gate.setOpen(true);
  if (openedGates[0]) {
    startGateCinematic(openedGates[0]);
    const destination = areaById(openedGates[0].def.requiredUnlockedAreaId).name;
    effects.gateOpening(openedGates[0].position);
    showBossProgression(`${bossEntity.config.label} guardian`, destination);
  } else {
    showBossProgression(`${bossEntity.config.label} guardian`);
  }
  if (result.areaId === 2) window.setTimeout(() => {
    ui.soulCatcherButton.classList.remove('locked');
    if (soulCatcher.announceUnlock(2)) { showToast('Soul Catcher unlocked!'); window.setTimeout(() => showToast('Infuse souls of the defeated enemies and unlock powerful upgrades!'), 1600); }
    entities.forEach((entity) => entity.renderLoot());
  }, 3300);
}

type RespawnIndicator = {
  members: SpawnEntity[];
  center: THREE.Vector3;
  element: HTMLDivElement;
  progress: SVGCircleElement;
  timer: HTMLSpanElement;
};
const GROUP_CIRCUMFERENCE = 2 * Math.PI * 14;
const groupMembers = new Map<string, SpawnEntity[]>();
for (const entity of entities) {
  if (!entity.def.group) continue;
  const members = groupMembers.get(entity.def.group) ?? [];
  members.push(entity);
  groupMembers.set(entity.def.group, members);
}
const respawnSpawnerMembers: SpawnEntity[][] = [
  ...Array.from(groupMembers.values()),
  ...entities.filter((entity) => entity.def.tier === 'crystal').map((entity) => [entity])
];
const respawnIndicators: RespawnIndicator[] = respawnSpawnerMembers.map((members) => {
  const center = members.reduce((sum, entity) => sum.add(entity.spawnPosition), new THREE.Vector3()).multiplyScalar(1 / members.length);
  const element = document.createElement('div');
  element.className = 'group-respawn hidden';
  element.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="respawn-track" cx="18" cy="18" r="14"/><circle class="respawn-progress" cx="18" cy="18" r="14"/></svg><span></span>`;
  const progress = element.querySelector<SVGCircleElement>('.respawn-progress')!;
  progress.style.strokeDasharray = `${GROUP_CIRCUMFERENCE}`;
  progress.style.strokeDashoffset = '0';
  const timer = element.querySelector<HTMLSpanElement>('span')!;
  ui.world.append(element);
  return { members, center, element, progress, timer };
});

const entityById = new Map(entities.map((entity) => [entity.def.id, entity]));
events.on('enemyDamaged', ({ enemyId, amount, damageType, itemId, slot }) => entityById.get(enemyId)?.presentDamage(amount, damageType, itemId, slot));
events.on('enemyDefeated', ({ enemyId }) => entityById.get(enemyId)?.presentDefeat());
events.on('enemyRespawned', ({ enemyId }) => entityById.get(enemyId)?.presentRespawn());
events.on('weaponAttacked', ({ slot, targetId }) => {
  const profile = attackProfile(save, slot as WeaponSlotId);
  const target = gameplay.spawnById.get(targetId);
  if (profile && target) heroView.playWeaponAttack(slot as WeaponSlotId, new THREE.Vector3().copy(target.position), profile.cooldownSeconds);
});
events.on('statGained', ({ stat, amount }) => showStatGain(amount, stat === 'hp' ? 'HP' : stat === 'regen' ? 'HP/S' : stat.toUpperCase()));
events.on('equipmentDropped', showEquipmentDrop);
events.on('soulDropped', ({ quantity, soulType }) => showSoulDrop(quantity, soulType));
events.on('bossDefeated', presentBossDefeat);
events.on('dailyReset', () => showToast('Daily reset · all spawns restored'));
events.on('heroEvaded', () => showEvadedCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0))));
events.on('heroDamaged', ({ amount, damageType, blocked }) => showCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), amount, damageType, true, blocked));
events.on('heroDefeated', () => {
  heroDeathHidden = false; hero.visible = true; heroView.playDeath(); input.reset();
  entities.forEach((entity) => entity.resetAfterHeroDefeat());
  showToast('Defeated · respawning in 5 seconds');
});
events.on('heroResurrected', () => {
  hero.position.copy(gameplay.hero.position); hero.visible = true; heroDeathHidden = false;
  cameraController.returnToHero(); effects.resurrection(hero.position);
});
events.on('heroProgressReset', () => heroView.syncEquipment(save.inventory));
events.on('areaEntered', ({ areaId }) => completeContinuousAreaEntry(areaId));
for (const event of ['soulNodePurchased', 'soulCatcherReset'] as const) events.on(event, () => entities.forEach((entity) => entity.renderLoot()));

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
mountGameUi(save, session, { current: () => renderingQuality, apply: applyRenderingQuality }, updateHud, () => entities.forEach((entity) => entity.renderLoot()));

function updateHero(dt: number): void {
  hero.position.copy(gameplay.hero.position);
  if (gameplay.hero.dead) {
    heroView.update(dt, false);
    if (!heroDeathHidden && heroView.deathAnimationFinished) {
      heroDeathHidden = true;
      hero.visible = false;
      const area = areaById(currentAreaId);
      cameraController.focus(new THREE.Vector3(area.originX, 0, area.originZ), gameplay.hero.respawnRemaining * 1000);
    }
    return;
  }
  heroView.setFacing(gameplay.hero.facing);
  heroView.update(dt, gameplay.hero.moving);
}

function completeContinuousAreaEntry(targetAreaId: number): void {
  currentAreaId = targetAreaId;
  renderEnemyAffinities(areaById(targetAreaId));
  syncAreaVisibility();
  persistGame();
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

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateRespawnIndicators(): void {
  const now = browserClock.now();
  for (const indicator of respawnIndicators) {
    if (indicator.members[0].def.areaId !== currentAreaId || !indicator.members.some((member) => member.presentationActive) || !indicator.members.every((member) => !member.alive && member.deathPresentationRemaining === 0)) {
      indicator.element.classList.add('hidden');
      continue;
    }
    const states = indicator.members.map((member) => save.spawns[member.def.id]);
    const ends = states.map((state) => state.respawnAt).filter((value): value is number => value !== null);
    const starts = states.map((state) => state.defeatedAt).filter((value): value is number => value !== null);
    if (!ends.length || !starts.length) { indicator.element.classList.add('hidden'); continue; }
    const end = Math.min(...ends);
    const start = Math.max(...starts);
    if (end <= now || end <= start) { indicator.element.classList.add('hidden'); continue; }
    indicator.element.classList.remove('hidden');
    const progress = THREE.MathUtils.clamp((end - now) / (end - start), 0, 1);
    indicator.progress.style.strokeDashoffset = `${GROUP_CIRCUMFERENCE * (1 - progress)}`;
    indicator.timer.textContent = formatCountdown(end - now);
    worldUi.project(indicator.center, indicator.element, indicator.members[0].def.tier === 'crystal' ? .9 : 1.1);
  }
}

function updateHud(): void {
  const maxHp = maxHeroHp(save.stats);
  ui.hpText.textContent = `${Math.round(gameplay.hero.hp)} / ${Math.round(maxHp)}`;
  ui.hpBar.style.width = `${gameplay.hero.hp / maxHp * 100}%`;
  const attackHud = { hand1: ui.hand1Stat, orbit1: ui.orbit1Stat, orbit2: ui.orbit2Stat, orbit3: ui.orbit3Stat };
  for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
    const profile = attackProfile(save, slot);
    attackHud[slot].innerHTML = profile
      ? `${Math.round(profile.damage)} ${damageTypeIcon(profile.damageType, 12)}`
      : '—';
  }
  updateTargetUi();
  updateRespawnIndicators();
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
addEventListener('resize', resizeViewport);
window.visualViewport?.addEventListener('resize', resizeViewport);
resizeViewport();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    session.resetAtMidnightIfNeeded();
    session.reviveDueSpawns();
  }
});

syncAreaVisibility();
syncEnemyPresentations();
let previous = performance.now();
let lastRenderedAt = 0;
let statsStartedAt = performance.now();
let statsFrames = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const minimumFrameMs = 1000 / renderingQuality.frameRateLimit;
  if (now - lastRenderedAt < minimumFrameMs - 1) return;
  lastRenderedAt = now;
  const elapsedSeconds = (now - previous) / 1000;
  const dt = Math.min(elapsedSeconds, .05);
  previous = now;
  session.update(dt, input.movement, elapsedSeconds);
  updateHero(dt);
  visualStreaming.update(currentAreaId, gameplay.hero.position);
  syncEnemyPresentations();
  updateGates(dt);
  entities.forEach((entity) => entity.syncTransform());
  entities.forEach((entity) => entity.updateView(dt));
  cameraController.update(dt, now);
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
      ui.rendererStats.textContent = `${Math.round(statsFrames * 1000 / elapsed)} FPS\n${info.calls} calls · ${info.triangles.toLocaleString()} triangles\narea ${currentAreaId} · hero ${gameplay.hero.position.x.toFixed(1)}, ${gameplay.hero.position.z.toFixed(1)}\nvisuals ${mountedAreas}\ntransitions ${mountedTransitions}\nloading ${visualResidency.pendingIds.join(', ') || 'none'}\n${activeEnemies} enemy presentations · ${activeMixers} mixers\n${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures\n${environmentOcclusion.diagnostic}\n${renderer.domElement.width}×${renderer.domElement.height} buffer`;
      statsFrames = 0;
      statsStartedAt = now;
    }
  }
}

renderEnemyAffinities(areaById(currentAreaId));
updateHud();
persistGame();
if (soulCatcher.available && !save.soulCatcher.unlockAnnouncementSeen) window.setTimeout(() => { if (soulCatcher.announceUnlock(2)) { showToast('Soul Catcher unlocked!'); window.setTimeout(() => showToast('Infuse souls of the defeated enemies and unlock powerful upgrades!'), 1600); } }, 500);
requestAnimationFrame(frame);

  }
}

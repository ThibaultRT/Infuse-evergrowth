import * as THREE from 'three';
import {
  AREAS,
  BASE_RESPAWN_MS,
  ENEMY_AGGRO_RADIUS_METERS,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_ATTACK_RANGE_METERS,
  ENEMY_POSITIONING_RANGE_METERS,
  ENEMY_LEASH_RADIUS_METERS,
  HERO_ATTACK_RANGE_METERS,
  HERO_RESPAWN_DELAY_MS,
  BLOCKED_DAMAGE_MULTIPLIER,
  WORLD_CONNECTIONS,
  SPAWNS,
  TIER_CONFIG,
  areaById,
  VISUAL_STREAMING,
} from '../config';
import { combatAffinityIcon, damageTypeIcon, evasionIcon, heartIcon, heartRegenIcon, shieldIcon, weaponClassIcon } from '../icons';
import { emptySpawnState, heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroEvasionChance, heroRegen, heroSpeed, localDailyKey, maxHeroHp, nextLocalMidnightMs, persist, save } from '../save';
import type { CombatAffinity, DamageType, EquipmentSlotId, LootType, SpawnDefinition, TierConfig, WeaponSlotId, WorldConnection } from '../types';
import { renderEnemyAffinities, renderInventory, renderItemDetail, renderSoulCatcher, renderStats, showBossProgression, showEquipmentDrop, showSoulDrop, showStatGain, showToast, ui } from '../ui';
import { makeTierRing } from '../visuals';
import { CrystalView } from '../rendering/CrystalView';
import { InputController } from '../controllers/InputController';
import { CameraController } from '../controllers/CameraController';
import { GameEvents } from './GameEvents';
import { EQUIPMENT_BY_ID, attackProfile, equipmentCombatSummary, equipmentSlot, equippedDefense } from '../systems/EquipmentSystem';
import { effectivePixelRatio, loadRenderingQuality, saveRenderingQuality, type RenderingQualitySettings } from '../rendering/RenderingQuality';
import { EnvironmentView, prefetchEnvironmentDetails } from '../rendering/EnvironmentView';
import { TransitionView, prefetchTransitionDetails } from '../rendering/TransitionView';
import { HeroView } from '../rendering/HeroView';
import { EnemyView } from '../rendering/EnemyView';
import { EffectManager } from '../rendering/EffectManager';
import { CombatSystem } from '../systems/CombatSystem';
import { RespawnSystem } from '../systems/RespawnSystem';
import { WorldUiManager } from '../rendering/WorldUiManager';
import { GameplayRuntime, type RuntimeSpawn } from './GameplayRuntime';
import { EnvironmentOcclusionManager } from '../rendering/EnvironmentOcclusionManager';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { GameCommands } from './GameCommands';
import { browserClock } from './PlatformAdapters';
import { SoulCatcherSystem } from '../systems/SoulCatcherSystem';
import { SOUL_LAYER_REGISTRY, soulEdges, soulLayer } from '../data/soul-catcher';
import { WorldVisualStreamingManager, type VisualChunkProvider } from '../rendering/environment/WorldVisualStreamingManager';

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
  showToast('Graphics paused while the display recovers. Progress is safe.');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  rendererContextAvailable = true;
  resizeViewport();
  showToast('Graphics restored.');
});
const effects = new EffectManager(scene);
const worldUi = new WorldUiManager(camera, renderer.domElement, ui.world);
const cooldown = (slot: 'hand1' | 'orbit1' | 'orbit2' | 'orbit3'): number => attackProfile(slot)?.cooldownSeconds ?? 0;
const combat = new CombatSystem({
  orbit1: cooldown('orbit1') * .25,
  orbit2: cooldown('orbit2') * .5,
  orbit3: cooldown('orbit3') * .75
});
const respawns = new RespawnSystem();
let normalizedExpiredSpawn = false;
for (const definition of SPAWNS) {
  const state = save.spawns[definition.id];
  if (state.respawnAt && state.respawnAt <= browserClock.now()) {
    respawns.reroll(state, definition);
    normalizedExpiredSpawn = true;
  }
}
if (normalizedExpiredSpawn) persist();
const gameplay = new GameplayRuntime({
  areas: AREAS,
  connections: WORLD_CONNECTIONS,
  unlockedAreas: save.unlockedAreas,
  spawns: SPAWNS.map((definition) => ({
    definition,
    tier: TIER_CONFIG[definition.tier],
    maxHp: save.spawns[definition.id].roll.maxHp,
    alive: !save.spawns[definition.id].respawnAt,
    damage: definition.attackDamage,
    damageType: areaById(definition.areaId).enemyWeapon
  })),
  currentAreaId: save.currentAreaId,
  heroHp: Math.min(save.heroHp, maxHeroHp()),
  heroSpeed: heroSpeed(),
  heroRespawnSeconds: HERO_RESPAWN_DELAY_MS / 1000,
  enemyAggroRadius: ENEMY_AGGRO_RADIUS_METERS,
  enemyLeashRadius: ENEMY_LEASH_RADIUS_METERS,
  enemyAttackRange: ENEMY_ATTACK_RANGE_METERS,
  enemyPositioningRange: ENEMY_POSITIONING_RANGE_METERS,
  enemyAttackCooldown: ENEMY_ATTACK_COOLDOWN
});
const persistGame = (): void => { save.heroHp = gameplay.hero.hp; persist(); };
const commands = new GameCommands(save, gameplay, events, persistGame);
const soulCatcher = new SoulCatcherSystem(save, events, persistGame);
const progression = new ProgressionSystem(save, events, persistGame, Math.random, (rarity) => soulCatcher.equipmentQuantity(rarity));
events.on('heroProgressReset', () => soulCatcher.syncEffects());
const syncHeroSpeed = (): void => gameplay.setHeroSpeed(heroSpeed());
events.on('statGained', ({ stat }) => { if (stat === 'speed') syncHeroSpeed(); });
for (const event of ['equipmentEquipped', 'equipmentUnequipped', 'weaponAscended', 'soulNodePurchased', 'soulCatcherReset', 'heroProgressReset'] as const) events.on(event, syncHeroSpeed);
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

  setAlive(value: boolean): void {
    gameplay.setSpawnAlive(this.def.id, value, value ? save.spawns[this.def.id].roll.maxHp : undefined);
    if (value) {
      this.deathPresentationRemaining = 0;
      this.crystalView?.reset();
      this.renderLoot();
    }
    this.renderHealth();
    this.syncTransform();
    this.syncAreaVisibility();
  }

  forceRespawn(): void { this.setAlive(true); }
  resetAfterHeroDefeat(): void {
    this.renderHealth();
    this.syncTransform();
  }
  distanceToHero(): number { return gameplay.distanceFromHero(this.state.position); }

  receiveDamage(amount: number, type: DamageType, itemId: string, slot: WeaponSlotId): void {
    if (!this.alive || this.def.areaId !== currentAreaId) return;
    const affinityAmount = combat.heroAttackDamage(amount, type, this.weakness);
    events.emit('enemyDamaged', { enemyId: this.def.id, amount: affinityAmount, damageType: type, itemId });
    effects.impact(this.root.position, type);
    this.enemyView?.playHit();
    worldUi.addCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), `<span>-${Math.round(affinityAmount)}</span>${weaponCombatIcon(itemId)}`, false, WEAPON_DAMAGE_TEXT_OFFSET[slot]);
    const result = gameplay.damageSpawn(this.def.id, affinityAmount);
    if (!result) return;
    this.renderHealth();
    if (result.defeated) this.defeat();
  }

  defeat(): void {
    this.enemyView?.playDeath();
    this.crystalView?.playDeath();
    this.deathPresentationRemaining = this.crystalView ? .45 : 1.1;
    const result = progression.defeat(this.def, this.config, gameplay.hero, AREAS, WORLD_CONNECTIONS, browserClock.now(), BASE_RESPAWN_MS / soulCatcher.respawnDivisor(this.def.tier), nextLocalMidnightMs(browserClock.date()));
    const { stat, amount } = result.reward;
    const soul = soulCatcher.grant(this.def);
    this.syncAreaVisibility();
    showStatGain(amount, stat === 'hp' ? 'HP' : stat === 'regen' ? 'HP/S' : stat.toUpperCase());
    if (soul) showSoulDrop(soul.quantity, soul.soulType);
    if (result.boss) presentBossDefeat(result.boss);
    if (result.drop) {
      showEquipmentDrop(result.drop);
      renderInventory(save.inventory, equipmentCombatSummary());
    }
    renderStats(save.stats);
  }

  update(): void {
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (respawns.reviveIfDue(state, this.def, browserClock.now())) {
        this.setAlive(true);
        events.emit('enemyRespawned', { enemyId: this.def.id });
        persistGame();
      }
      return;
    }
    this.syncTransform();
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
  private view: TransitionView | null = null;
  open: boolean;

  constructor(readonly def: WorldConnection) {
    this.position = new THREE.Vector3(def.x, 0, def.z);
    this.open = save.unlockedAreas.includes(def.requiredUnlockedAreaId);
  }

  attachView(view: TransitionView): void {
    this.view = view;
    view.setOpen(this.open);
  }

  detachView(view: TransitionView): void {
    if (this.view === view) this.view = null;
  }

  setOpen(value: boolean): void {
    this.open = value;
    this.view?.setOpen(value);
  }

  update(dt: number): void { this.view?.update(dt); }
}

const gateEntities = WORLD_CONNECTIONS.map((gate) => new GateEntity(gate));

const visualProviders: VisualChunkProvider[] = [
  ...AREAS.map((area): VisualChunkProvider => ({
    id: `area:${area.id}`,
    kind: 'area',
    prefetch: () => prefetchEnvironmentDetails(area),
    create: () => {
      const view = new EnvironmentView(area);
      return { root: view.root, dispose: () => view.dispose() };
    }
  })),
  ...gateEntities.map((gate): VisualChunkProvider => ({
    id: `transition:${gate.def.id}`,
    kind: 'transition',
    prefetch: () => prefetchTransitionDetails(gate.def),
    create: () => {
      const view = new TransitionView(gate.def);
      gate.attachView(view);
      return {
        root: view.root,
        dispose: () => { gate.detachView(view); view.dispose(); }
      };
    }
  }))
];
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

function resetAtMidnightIfNeeded(): void {
  const key = localDailyKey(browserClock.date());
  if (save.dailyKey === key) return;
  save.dailyKey = key;
  save.spawns = emptySpawnState();
  entities.forEach((entity) => entity.forceRespawn());
  persistGame();
  showToast('Daily reset · all spawns restored');
}

function resetSpawnCooldowns(): void {
  let resetCount = 0;
  entities.forEach((entity) => {
    const state = save.spawns[entity.def.id];
    if (!state.respawnAt) return;
    respawns.reroll(state, entity.def);
    entity.forceRespawn();
    events.emit('enemyRespawned', { enemyId: entity.def.id });
    resetCount += 1;
  });
  persistGame();
  showToast(resetCount === 0 ? 'No spawn cooldowns active' : `Spawned ${resetCount} target${resetCount === 1 ? '' : 's'}`);
}

function damageHero(amount: number, type: CombatAffinity): void {
  if (gameplay.hero.dead) return;
  if (combat.rollChance(heroEvasionChance())) {
    events.emit('heroEvaded', { damageType: type });
    showEvadedCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)));
    return;
  }
  const defendedAmount = combat.enemyAttackDamage(amount, type, equippedDefense, (damageType) => soulCatcher.resistance(damageType));
  const blocked = combat.rollChance(heroBlockChance());
  const reducedAmount = defendedAmount * (blocked ? BLOCKED_DAMAGE_MULTIPLIER : 1);
  events.emit('heroDamaged', { amount: reducedAmount, damageType: type, blocked });
  showCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), reducedAmount, type, true, blocked);
  const defeated = gameplay.damageHero(reducedAmount);
  persistGame();
  updateHud();
  if (!defeated) return;
  heroDeathHidden = false;
  hero.visible = true;
  heroView.playDeath();
  events.emit('heroDefeated', undefined);
  input.reset();
  entities.forEach((entity) => entity.resetAfterHeroDefeat());
  showToast('Defeated · respawning in 5 seconds');
}

function autoAttack(): void {
  if (gameplay.hero.dead || cameraController.isScripted) return;
  for (const hand of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
    if (!combat.ready(hand)) continue;
    const profile = attackProfile(hand);
    if (!profile) continue;
    const target = combat.nearestTarget(entities.filter((entity) => entity.def.areaId === currentAreaId), HERO_ATTACK_RANGE_METERS);
    if (!target) continue;
    combat.schedule(hand, profile.cooldownSeconds);
    heroView.playWeaponAttack(hand, target.root.position, profile.cooldownSeconds);
    events.emit('weaponAttacked', { slot: hand, targetId: target.def.id, damageType: profile.damageType, itemId: profile.itemId });
    const critical = combat.rollChance(heroCriticalChance());
    target.receiveDamage(profile.damage * (critical ? heroCriticalDamageMultiplier() : 1), profile.damageType, profile.itemId, hand);
    const direction = target.root.position.clone().sub(hero.position);
    if (hand === 'hand1' && direction.lengthSq() > 0) {
      gameplay.hero.facing = Math.atan2(direction.x, direction.z);
      heroView.setFacing(gameplay.hero.facing);
    }
  }
}

function setStatsPanel(open: boolean): void {
  if (open) closeOtherPanels('stats');
  ui.statsPanel.classList.toggle('visible', open);
  ui.statsPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderStats(save.stats);
}
function closeOtherPanels(except: 'stats' | 'inventory' | 'settings' | 'soul'): void {
  for (const [name, panel] of [['stats', ui.statsPanel], ['inventory', ui.inventoryPanel], ['settings', ui.settingsPanel], ['soul', ui.soulCatcherPanel]] as const) {
    if (name === except) continue;
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }
}
function setInventoryPanel(open: boolean): void {
  if (open) closeOtherPanels('inventory');
  ui.inventoryPanel.classList.toggle('visible', open);
  ui.inventoryPanel.setAttribute('aria-hidden', String(!open));
  if (open) { showInventoryOverview(0); renderInventory(save.inventory, equipmentCombatSummary()); }
}
function renderQualityControls(): void {
  const scale = ui.settingsPanel.querySelector<HTMLInputElement>(`input[name="render-scale"][value="${renderingQuality.renderScale}"]`);
  const frameRate = ui.settingsPanel.querySelector<HTMLInputElement>(`input[name="frame-rate"][value="${renderingQuality.frameRateLimit}"]`);
  if (scale) scale.checked = true;
  if (frameRate) frameRate.checked = true;
  ui.rendererStatsToggle.checked = renderingQuality.showStats;
  ui.rendererStatsOption.hidden = !import.meta.env.DEV;
  ui.rendererStats.classList.toggle('visible', import.meta.env.DEV && renderingQuality.showStats);
}
function setSettingsPanel(open: boolean): void {
  if (open) closeOtherPanels('settings');
  ui.settingsPanel.classList.toggle('visible', open);
  ui.settingsPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderQualityControls();
}
function applyRenderingQuality(next: RenderingQualitySettings): void {
  renderingQuality = next;
  saveRenderingQuality(next);
  resizeViewport();
  renderQualityControls();
  if (import.meta.env.DEV && next.showStats) {
    statsFrames = 0;
    statsStartedAt = performance.now();
    ui.rendererStats.textContent = 'Measuring renderer…';
  }
}
ui.statsButton.addEventListener('click', () => setStatsPanel(true));
ui.spawnButton.addEventListener('click', resetSpawnCooldowns);
ui.statsClose.addEventListener('click', () => setStatsPanel(false));
ui.statsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.statsPanel) setStatsPanel(false); });
ui.inventoryButton.addEventListener('click', () => setInventoryPanel(true));
ui.inventoryClose.addEventListener('click', () => setInventoryPanel(false));
ui.inventoryPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.inventoryPanel) setInventoryPanel(false); });
let selectedSoulNode: string | null = null;
let selectedSoulLayer = 1;
const refreshSoulTree = (): void => { const layer = soulLayer(selectedSoulLayer); renderSoulCatcher(layer?.nodes ?? [], soulEdges(selectedSoulLayer), (id) => soulCatcher.revealed(id), (id) => soulCatcher.canPurchase(id), selectedSoulNode, selectedSoulLayer, SOUL_LAYER_REGISTRY); };
function setSoulCatcherPanel(open: boolean): void {
  if (open && !soulCatcher.available) { showToast('Defeat area 2 boss to unlock Soul Catcher'); return; }
  if (open) closeOtherPanels('soul');
  ui.soulCatcherPanel.classList.toggle('visible', open); ui.soulCatcherPanel.setAttribute('aria-hidden', String(!open));
  if (open) refreshSoulTree();
}
ui.soulCatcherButton.classList.toggle('locked', !soulCatcher.available);
ui.soulCatcherButton.addEventListener('click', () => setSoulCatcherPanel(true));
ui.soulCatcherClose.addEventListener('click', () => setSoulCatcherPanel(false));
ui.soulCatcherPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.soulCatcherPanel) setSoulCatcherPanel(false); });
ui.soulLayerTabs.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-soul-layer]'); const layer = Number(button?.dataset.soulLayer); if (!layer || !soulCatcher.layerUnlocked(layer)) return; selectedSoulLayer = layer; selectedSoulNode = null; refreshSoulTree(); });
ui.soulNodes.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-soul-node]'); if (!button?.dataset.soulNode) return; selectedSoulNode = button.dataset.soulNode; refreshSoulTree(); });
ui.soulDetail.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-purchase-soul]'); if (!button?.dataset.purchaseSoul) return; if (soulCatcher.purchase(button.dataset.purchaseSoul)) { gameplay.hero.hp = Math.min(gameplay.hero.hp, maxHeroHp()); refreshSoulTree(); renderStats(save.stats); updateHud(); entities.forEach((entity) => entity.renderLoot()); } });
const treePointers = new Map<number, { x: number; y: number }>();
let treeX = -170, treeY = -190, treeScale = 1, pinchDistance = 0;
const transformTree = (): void => { ui.soulTree.style.transform = `translate(${treeX}px,${treeY}px) scale(${treeScale})`; };
ui.soulTreeViewport.addEventListener('pointerdown', (event) => { treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); ui.soulTreeViewport.setPointerCapture(event.pointerId); });
ui.soulTreeViewport.addEventListener('pointermove', (event) => {
  const previous = treePointers.get(event.pointerId); if (!previous) return;
  treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = [...treePointers.values()];
  if (points.length === 1) { treeX += event.clientX - previous.x; treeY += event.clientY - previous.y; }
  else { const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (pinchDistance) treeScale = THREE.MathUtils.clamp(treeScale * distance / pinchDistance, .55, 1.6); pinchDistance = distance; }
  transformTree();
});
const endTreePointer = (event: PointerEvent): void => { treePointers.delete(event.pointerId); pinchDistance = 0; };
ui.soulTreeViewport.addEventListener('pointerup', endTreePointer); ui.soulTreeViewport.addEventListener('pointercancel', endTreePointer); transformTree();
ui.settingsButton.addEventListener('click', () => setSettingsPanel(true));
ui.settingsClose.addEventListener('click', () => setSettingsPanel(false));
ui.settingsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.settingsPanel) setSettingsPanel(false); });
ui.resetAttributesButton.addEventListener('click', () => {
  if (!window.confirm('Reset all permanent hero attributes? Your equipment and its progress will be kept.')) return;
  commands.execute({ type: 'resetHero', equipment: false });
  renderStats(save.stats);
  updateHud();
  showToast('Permanent attributes reset · equipment kept');
});
ui.resetHeroButton.addEventListener('click', () => {
  if (!window.confirm('Reset all permanent hero attributes and equipment drops? World progression will be kept.')) return;
  commands.execute({ type: 'resetHero', equipment: true });
  heroView.syncEquipment(save.inventory);
  renderStats(save.stats);
  renderInventory(save.inventory, equipmentCombatSummary());
  updateHud();
  showToast('Hero reset · attributes and equipment drops removed');
});
ui.resetSoulCatcherButton.addEventListener('click', () => { if (!window.confirm('Reset all Soul balances and purchased Soul Catcher nodes?')) return; soulCatcher.reset(); selectedSoulNode = null; selectedSoulLayer = 1; refreshSoulTree(); renderStats(save.stats); updateHud(); entities.forEach((entity) => entity.renderLoot()); showToast('Soul Catcher reset'); });
ui.settingsPanel.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === 'render-scale') applyRenderingQuality({ ...renderingQuality, renderScale: input.value === '0.7' ? 0.7 : 1 });
  if (input.name === 'frame-rate') applyRenderingQuality({ ...renderingQuality, frameRateLimit: input.value === '30' ? 30 : 60 });
  if (input === ui.rendererStatsToggle) applyRenderingQuality({ ...renderingQuality, showStats: input.checked });
});
type InventoryViewState =
  | { view: 'overview'; scrollTop: number }
  | { view: 'detail'; itemId: string; overviewScrollTop: number };
let inventoryView: InventoryViewState = { view: 'overview', scrollTop: 0 };
const inventoryScroller = ui.inventoryOverview.closest<HTMLElement>('.inventory-sheet')!;

function showInventoryOverview(scrollTop: number): void {
  inventoryView = { view: 'overview', scrollTop };
  ui.inventoryOverview.hidden = false;
  ui.inventoryDetail.hidden = true;
  requestAnimationFrame(() => { inventoryScroller.scrollTop = scrollTop; });
}
function showInventoryDetail(itemId: string): void {
  const overviewScrollTop = inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : inventoryScroller.scrollTop;
  inventoryView = { view: 'detail', itemId, overviewScrollTop };
  renderItemDetail(save.inventory.items[itemId] ?? null);
  ui.inventoryOverview.hidden = true;
  ui.inventoryDetail.hidden = false;
  inventoryScroller.scrollTop = 0;
}
function refreshInventory(itemId?: string): void {
  renderInventory(save.inventory, equipmentCombatSummary());
  if (itemId) renderItemDetail(save.inventory.items[itemId] ?? null);
  updateHud();
}

ui.inventoryBag.addEventListener('click', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
});
ui.inventoryEquipped.addEventListener('click', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
});
ui.inventoryDetail.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.hasAttribute('data-inventory-back')) {
    showInventoryOverview(inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : 0);
    return;
  }
  const itemId = button.dataset.itemId;
  if (!itemId) return;
  let equipmentChanged = false;
  if (button.hasAttribute('data-equip')) {
    const armorSlot = equipmentSlot(itemId);
    if (armorSlot) { commands.execute({ type: 'equip', itemId, slot: armorSlot }); equipmentChanged = true; }
    else {
      const freeSlots = (['hand1', 'orbit1', 'orbit2', 'orbit3'] as const).filter((slot) => save.inventory.equipped[slot] === null && (slot !== 'orbit1' || save.unlockedAreas.includes(2)));
      if (freeSlots.length === 1) { commands.execute({ type: 'equip', itemId, slot: freeSlots[0] }); equipmentChanged = true; }
      else { ui.inventoryDetail.querySelector<HTMLElement>('[data-slot-picker]')!.hidden = false; return; }
    }
  }
  if (button.dataset.equipSlot) { commands.execute({ type: 'equip', itemId, slot: button.dataset.equipSlot as EquipmentSlotId }); equipmentChanged = true; }
  if (button.dataset.unequip) { commands.execute({ type: 'unequip', slot: button.dataset.unequip as EquipmentSlotId }); equipmentChanged = true; }
  if (button.hasAttribute('data-ascend')) commands.execute({ type: 'ascend', itemId });
  refreshInventory(equipmentChanged ? undefined : itemId);
  if (equipmentChanged) showInventoryOverview(inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : 0);
});

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
  if (cameraController.isScripted) { heroView.update(dt, false); return; }
  heroView.setFacing(gameplay.hero.facing);
  heroView.update(dt, gameplay.hero.moving);
}

function completeContinuousAreaEntry(targetAreaId: number, connectionId: string): void {
  currentAreaId = targetAreaId;
  commands.execute({ type: 'enterArea', areaId: targetAreaId, connectionId });
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
  const maxHp = maxHeroHp();
  ui.hpText.textContent = `${Math.round(gameplay.hero.hp)} / ${Math.round(maxHp)}`;
  ui.hpBar.style.width = `${gameplay.hero.hp / maxHp * 100}%`;
  const attackHud = { hand1: ui.hand1Stat, orbit1: ui.orbit1Stat, orbit2: ui.orbit2Stat, orbit3: ui.orbit3Stat };
  for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
    const profile = attackProfile(slot);
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
    resetAtMidnightIfNeeded();
    entities.forEach((entity) => entity.update());
  }
});

syncAreaVisibility();
syncEnemyPresentations();
let previous = performance.now();
let lastRenderedAt = 0;
let statsStartedAt = performance.now();
let statsFrames = 0;
let midnightAccumulator = 0;
let healthPersistAccumulator = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const minimumFrameMs = 1000 / renderingQuality.frameRateLimit;
  if (now - lastRenderedAt < minimumFrameMs - 1) return;
  lastRenderedAt = now;
  const elapsedSeconds = (now - previous) / 1000;
  const dt = Math.min(elapsedSeconds, .05);
  previous = now;
  combat.update(dt);
  midnightAccumulator += dt;
  healthPersistAccumulator += dt;
  if (midnightAccumulator >= 1) {
    midnightAccumulator = 0;
    resetAtMidnightIfNeeded();
  }
  if (healthPersistAccumulator >= 1) { healthPersistAccumulator = 0; persistGame(); }

  const runtimeEvents = gameplay.update(dt, commands.movement({ type: 'move', ...input.movement }), !cameraController.isScripted, elapsedSeconds);
  for (const event of runtimeEvents) {
    if (event.type === 'enemyAttack') damageHero(event.amount, event.damageType);
    else if (event.type === 'areaEntered') completeContinuousAreaEntry(event.areaId, event.connectionId);
    else {
      gameplay.hero.hp = maxHeroHp();
      hero.position.copy(gameplay.hero.position);
      hero.visible = true;
      heroDeathHidden = false;
      cameraController.returnToHero();
      effects.resurrection(hero.position);
      events.emit('heroResurrected', { areaId: event.areaId });
    }
  }
  updateHero(dt);
  visualStreaming.update(currentAreaId, gameplay.hero.position);
  syncEnemyPresentations();
  updateGates(dt);
  if (!cameraController.isScripted) entities.forEach((entity) => entity.update());
  autoAttack();
  entities.forEach((entity) => entity.updateView(dt));
  if (!gameplay.hero.dead) gameplay.hero.hp = Math.min(maxHeroHp(), gameplay.hero.hp + heroRegen() * dt);
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
      ui.rendererStats.textContent = `${Math.round(statsFrames * 1000 / elapsed)} FPS\n${info.calls} calls · ${info.triangles.toLocaleString()} triangles\narea ${currentAreaId} · visuals ${mountedAreas}\ntransitions ${mountedTransitions}\nloading ${visualResidency.pendingIds.join(', ') || 'none'}\n${activeEnemies} enemy presentations · ${activeMixers} mixers\n${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures\n${environmentOcclusion.diagnostic}\n${renderer.domElement.width}×${renderer.domElement.height} buffer`;
      statsFrames = 0;
      statsStartedAt = now;
    }
  }
}

renderStats(save.stats);
renderInventory(save.inventory, equipmentCombatSummary());
renderEnemyAffinities(areaById(currentAreaId));
updateHud();
persistGame();
if (soulCatcher.available && !save.soulCatcher.unlockAnnouncementSeen) window.setTimeout(() => { if (soulCatcher.announceUnlock(2)) { showToast('Soul Catcher unlocked!'); window.setTimeout(() => showToast('Infuse souls of the defeated enemies and unlock powerful upgrades!'), 1600); } }, 500);
requestAnimationFrame(frame);

  }
}

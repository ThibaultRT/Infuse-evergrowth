import * as THREE from 'three';
import {
  AREAS,
  BASE_RESPAWN_MS,
  ENEMY_AGGRO_RADIUS_METERS,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_ATTACK_RANGE_METERS,
  ENEMY_LEASH_RADIUS_METERS,
  HERO_ATTACK_RANGE_METERS,
  HERO_RESPAWN_DELAY_MS,
  BLOCKED_DAMAGE_MULTIPLIER,
  GATES,
  SPAWNS,
  TIER_CONFIG,
  areaById,
  enemyAttack
} from '../config';
import { combatAffinityIcon, damageTypeIcon, heartIcon, shieldIcon, weaponClassIcon } from '../icons';
import { emptySpawnState, heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroRegen, heroSpeed, localDailyKey, maxHeroHp, nextLocalMidnightMs, persist, resetHeroProgress, resetPermanentStats, save } from '../save';
import type { CombatAffinity, DamageType, EquipmentSlotId, GateDefinition, LootType, SpawnDefinition, TierConfig } from '../types';
import { renderEnemyAffinities, renderInventory, renderStats, renderWeaponDetail, showBossProgression, showEquipmentDrop, showStatGain, showToast, ui } from '../ui';
import { addRock, makeCrystal, makeTierRing } from '../visuals';
import { InputController } from '../controllers/InputController';
import { CameraController } from '../controllers/CameraController';
import { GameEvents } from './GameEvents';
import { EQUIPMENT_BY_ID, applyEquipmentCopies, ascend, attackProfile, equip, equipmentSlot, equippedDefense, unequip } from '../systems/EquipmentSystem';
import { rollEquipmentDrop } from '../systems/EquipmentDropSystem';
import { effectivePixelRatio, loadRenderingQuality, saveRenderingQuality, type RenderingQualitySettings } from '../rendering/RenderingQuality';
import { EnvironmentView } from '../rendering/EnvironmentView';
import { GateView } from '../rendering/GateView';
import { HeroView } from '../rendering/HeroView';
import { EnemyView } from '../rendering/EnemyView';
import { EffectManager } from '../rendering/EffectManager';
import { CombatSystem } from '../systems/CombatSystem';
import { RespawnSystem } from '../systems/RespawnSystem';
import { WorldUiManager } from '../rendering/WorldUiManager';
import { AreaFlowSystem } from '../systems/AreaFlowSystem';
import { GameplayRuntime, type RuntimeSpawn } from './GameplayRuntime';

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
const cooldown = (slot: 'hand1' | 'hand2' | 'orbit1' | 'orbit2'): number => attackProfile(slot)?.cooldownSeconds ?? 0;
const combat = new CombatSystem({
  hand2: cooldown('hand2') * .5,
  orbit1: cooldown('orbit1') * .25,
  orbit2: cooldown('orbit2') * .75
});
const respawns = new RespawnSystem();
const areaFlow = new AreaFlowSystem();
let normalizedExpiredSpawn = false;
for (const definition of SPAWNS) {
  const state = save.spawns[definition.id];
  if (state.respawnAt && state.respawnAt <= Date.now()) {
    respawns.reroll(state, definition);
    normalizedExpiredSpawn = true;
  }
}
if (normalizedExpiredSpawn) persist();
const gameplay = new GameplayRuntime({
  areas: AREAS,
  spawns: SPAWNS.map((definition) => ({
    definition,
    tier: TIER_CONFIG[definition.tier],
    maxHp: save.spawns[definition.id].roll.maxHp,
    alive: !save.spawns[definition.id].respawnAt,
    damage: enemyAttack(definition.areaId, definition.tier),
    damageType: areaById(definition.areaId).enemyWeapon
  })),
  currentAreaId: save.currentAreaId,
  heroHp: maxHeroHp(),
  heroSpeed: heroSpeed(),
  heroRespawnSeconds: HERO_RESPAWN_DELAY_MS / 1000,
  enemyAggroRadius: ENEMY_AGGRO_RADIUS_METERS,
  enemyLeashRadius: ENEMY_LEASH_RADIUS_METERS,
  enemyAttackRange: ENEMY_ATTACK_RANGE_METERS,
  enemyAttackCooldown: ENEMY_ATTACK_COOLDOWN
});
let renderingQuality = loadRenderingQuality();
renderer.setPixelRatio(effectivePixelRatio(renderingQuality));
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.canvasHost.append(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.8);
scene.add(sun, sun.target);

const ROCK_LAYOUT = [
  [-16, 5, 1.2], [-15, -3, .8], [16, 7, 1], [15, -4, 1.3], [-13, 10, .65], [13, 10, .7],
  [-16, -17, .85], [16, -16, .9], [-10, 23, .8], [10, 24, 1], [-5, -24, .8], [5, -25, 1.1]
] as const;

const environmentViews = AREAS.map((area) => {
  const view = new EnvironmentView(area);
  scene.add(view.root);
  if (area.environmentTheme === 'legacy') for (const [x, z, scale] of ROCK_LAYOUT) addRock(scene, area.originX + x, area.originZ + z, scale);
  return view;
});

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

let gateTransitionCooldown = 0;
const cameraController = new CameraController(camera, hero.position);

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
  return type === 'hp' || type === 'regen' ? heartIcon(size) : damageTypeIcon(type, size);
}

function showCombatText(position: THREE.Vector3, amount: number, type: CombatAffinity | DamageType, incoming = false, blocked = false): void {
  const icon = blocked ? shieldIcon(11) : incoming ? combatAffinityIcon(type as CombatAffinity, 10) : damageTypeIcon(type as DamageType, 10);
  worldUi.addCombatText(position, `${blocked ? icon : ''}<span>${incoming ? '-' : ''}${Math.round(amount)}</span>${blocked ? '' : icon}`, incoming);
}

function weaponCombatIcon(itemId: string): string {
  const item = EQUIPMENT_BY_ID.get(itemId);
  return item?.kind === 'weapon'
    ? `<span class="combat-weapon-icon rarity-${item.rarity}" aria-label="${item.name}">${weaponClassIcon(item.weaponClass, 10)}</span>`
    : damageTypeIcon('blunt', 10);
}

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
  readonly enemyView: EnemyView | null;
  deathPresentationRemaining = 0;
  readonly state: RuntimeSpawn;

  constructor(readonly def: SpawnDefinition) {
    this.state = gameplay.spawnById.get(def.id)!;
    this.config = TIER_CONFIG[def.tier];
    this.weakness = def.enemyWeakness === undefined ? areaById(def.areaId).enemyWeakness : def.enemyWeakness;
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.enemyView = def.tier === 'crystal' ? null : new EnemyView(def.tier, this.config.color);
    this.root.add(this.enemyView?.root ?? makeCrystal(this.config.color), makeTierRing(this.config.color));
    scene.add(this.root);

    this.targetUi.className = `world-target-ui rarity-${def.tier}`;
    this.lootLabel.className = 'world-loot';
    this.healthBar.className = 'world-hp-bar';
    this.healthValue.className = 'world-hp-value';
    this.healthBar.append(this.healthFill, this.healthValue);
    this.targetUi.append(this.lootLabel, this.healthBar);
    ui.world.append(this.targetUi);

    this.renderLoot();
    this.renderHealth();
    this.syncAreaVisibility();
  }

  get alive(): boolean { return this.state.alive; }
  get hp(): number { return this.state.hp; }
  get maxHp(): number { return this.state.maxHp; }
  renderLoot(): void {
    const reward = save.spawns[this.def.id].roll.reward;
    const loot = reward.stat;
    this.lootLabel.className = `world-loot ${loot}`;
    this.lootLabel.innerHTML = `<span>${formatRewardAmount(reward.amount)}</span>${lootIcon(loot)}`;
  }

  renderHealth(): void {
    const hp = Math.max(0, this.hp);
    this.healthFill.style.width = `${(hp / this.maxHp) * 100}%`;
    this.healthValue.textContent = String(Math.ceil(hp));
    this.healthBar.setAttribute('aria-label', `${Math.ceil(hp)} of ${this.maxHp} health`);
  }

  syncAreaVisibility(): void {
    const visible = (this.alive || this.deathPresentationRemaining > 0) && this.def.areaId === currentAreaId;
    this.root.visible = visible;
    this.targetUi.classList.toggle('hidden', !this.alive || this.def.areaId !== currentAreaId);
  }

  setAlive(value: boolean): void {
    gameplay.setSpawnAlive(this.def.id, value, value ? save.spawns[this.def.id].roll.maxHp : undefined);
    if (value) {
      this.deathPresentationRemaining = 0;
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

  receiveDamage(amount: number, type: DamageType, itemId: string): void {
    if (!this.alive || this.def.areaId !== currentAreaId) return;
    const affinityAmount = combat.heroAttackDamage(amount, type, this.weakness);
    events.emit('enemyDamaged', { enemyId: this.def.id, amount: affinityAmount, damageType: type, itemId });
    effects.impact(this.root.position, type);
    this.enemyView?.playHit();
    worldUi.addCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), `<span>-${Math.round(affinityAmount)}</span>${weaponCombatIcon(itemId)}`, false);
    const result = gameplay.damageSpawn(this.def.id, affinityAmount);
    if (!result) return;
    this.renderHealth();
    if (result.defeated) this.defeat();
  }

  defeat(): void {
    this.enemyView?.playDeath();
    this.deathPresentationRemaining = 1.1;
    const state = save.spawns[this.def.id];
    const now = Date.now();
    respawns.defeat(state, this.config, now, BASE_RESPAWN_MS, nextLocalMidnightMs());

    const { stat, amount } = state.roll.reward;
    events.emit('enemyDefeated', { enemyId: this.def.id });
    if (stat === 'hp') {
      const oldMax = maxHeroHp();
      save.stats.maxHp.additive.kills = (save.stats.maxHp.additive.kills ?? 0) + amount;
      gameplay.hero.hp = Math.min(maxHeroHp(), gameplay.hero.hp + maxHeroHp() - oldMax);
    } else if (stat === 'regen') {
      save.stats.regen.additive.kills = (save.stats.regen.additive.kills ?? 0) + amount;
    } else {
      const attack = save.stats.attack[stat];
      attack.additive.kills = (attack.additive.kills ?? 0) + amount;
    }

    this.syncAreaVisibility();
    events.emit('statGained', { sourceId: this.def.id, stat, amount });
    showStatGain(amount, stat === 'hp' ? 'HP' : stat === 'regen' ? 'HP/S' : stat.toUpperCase());
    handleBossDefeat(this.def.areaId, this.def.id);
    const itemId = rollEquipmentDrop(this.def.areaId, this.def.tier);
    if (itemId) {
      const result = applyEquipmentCopies(itemId, 1);
      const drop = { sourceId: this.def.id, areaId: this.def.areaId, itemId, quantity: 1, previousLevel: result.previousLevel, newLevel: result.owned.level, ascend: result.owned.ascend };
      events.emit('equipmentDropped', drop);
      showEquipmentDrop(drop);
      renderInventory(save.inventory);
    }
    persist();
    renderStats(save.stats);
  }

  update(): void {
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (respawns.reviveIfDue(state, this.def, Date.now())) {
        this.setAlive(true);
        events.emit('enemyRespawned', { enemyId: this.def.id });
        persist();
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
    if (this.deathPresentationRemaining > 0) {
      this.deathPresentationRemaining = Math.max(0, this.deathPresentationRemaining - dt);
      if (this.deathPresentationRemaining === 0) this.syncAreaVisibility();
    }
    this.enemyView?.update(dt, this.state.moving, this.def.areaId === currentAreaId && (this.alive || this.deathPresentationRemaining > 0));
  }
}

const entities = SPAWNS.map((spawn) => new SpawnEntity(spawn));

class GateEntity {
  readonly view = new GateView();
  readonly root = this.view.root;
  open = false;

  constructor(readonly def: GateDefinition) {
    this.root.position.set(def.x, 0, def.z);
    this.root.userData.gateId = def.id;
    this.root.userData.tag = def.tag;
    this.root.userData.targetAreaId = def.targetAreaId;
    scene.add(this.root);
    this.setOpen(save.unlockedAreas.includes(def.targetAreaId) || !def.requiresBossDefeated);
    this.syncAreaVisibility();
  }

  setOpen(value: boolean): void {
    this.open = value;
    this.view.setOpen(value);
  }

  update(dt: number): void { this.view.update(dt); }
  syncAreaVisibility(): void { this.root.visible = this.def.sourceAreaId === currentAreaId; }
  distanceToHero(): number { return gameplay.distanceFromHero({ x: this.def.x, y: 0, z: this.def.z }); }
}

const gateEntities = GATES.map((gate) => new GateEntity(gate));

function syncAreaVisibility(): void {
  entities.forEach((entity) => entity.syncAreaVisibility());
  gateEntities.forEach((gate) => gate.syncAreaVisibility());
  environmentViews.forEach((view) => { view.root.visible = view.area.id === currentAreaId; });
  syncLighting();
}

function startGateCinematic(gate: GateEntity): void {
  input.reset();
  cameraController.focus(gate.root.position, 2600);
}

function handleBossDefeat(areaId: number, spawnId: string): void {
  const area = areaById(areaId);
  const bossEntity = entities.find((entity) => entity.def.id === spawnId && entity.def.isBoss);
  if (!bossEntity || spawnId !== area.bossSpawnId || save.defeatedBosses.includes(spawnId)) return;
  save.defeatedBosses.push(spawnId);
  events.emit('bossDefeated', { bossId: spawnId, areaId });
  effects.bossDefeat(bossEntity.spawnPosition);

  const openedDefinitions = areaFlow.unlockBossGates(areaId, GATES, save.unlockedAreas);
  const openedGates = gateEntities.filter((gate) => openedDefinitions.includes(gate.def));
  for (const gate of openedGates) {
    gate.setOpen(true);
    events.emit('gateUnlocked', { gateId: gate.def.id });
  }
  if (openedGates[0]) {
    startGateCinematic(openedGates[0]);
    const destination = areaById(openedGates[0].def.targetAreaId).name;
    effects.gateOpening(openedGates[0].root.position);
    showBossProgression(`${bossEntity?.config.label ?? 'Area'} guardian`, destination);
  } else {
    showBossProgression(`${bossEntity?.config.label ?? 'Area'} guardian`);
  }
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
  const key = localDailyKey();
  if (save.dailyKey === key) return;
  save.dailyKey = key;
  save.spawns = emptySpawnState();
  entities.forEach((entity) => entity.forceRespawn());
  persist();
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
  persist();
  showToast(resetCount === 0 ? 'No spawn cooldowns active' : `Spawned ${resetCount} target${resetCount === 1 ? '' : 's'}`);
}

function damageHero(amount: number, type: CombatAffinity): void {
  if (gameplay.hero.dead) return;
  const defendedAmount = combat.enemyAttackDamage(amount, type, equippedDefense);
  const blocked = combat.rollChance(heroBlockChance());
  const reducedAmount = defendedAmount * (blocked ? BLOCKED_DAMAGE_MULTIPLIER : 1);
  events.emit('heroDamaged', { amount: reducedAmount, damageType: type, blocked });
  showCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), reducedAmount, type, true, blocked);
  const defeated = gameplay.damageHero(reducedAmount);
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
  for (const hand of ['hand1', 'hand2', 'orbit1', 'orbit2'] as const) {
    if (!combat.ready(hand)) continue;
    const profile = attackProfile(hand);
    if (!profile) continue;
    const target = combat.nearestTarget(entities.filter((entity) => entity.def.areaId === currentAreaId), HERO_ATTACK_RANGE_METERS);
    if (!target) continue;
    combat.schedule(hand, profile.cooldownSeconds);
    heroView.playWeaponAttack(hand, target.root.position, profile.cooldownSeconds);
    events.emit('weaponAttacked', { slot: hand, targetId: target.def.id, damageType: profile.damageType, itemId: profile.itemId });
    const critical = combat.rollChance(heroCriticalChance());
    target.receiveDamage(profile.damage * (critical ? heroCriticalDamageMultiplier() : 1), profile.damageType, profile.itemId);
    const direction = target.root.position.clone().sub(hero.position);
    if (direction.lengthSq() > 0) {
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
function closeOtherPanels(except: 'stats' | 'inventory' | 'settings'): void {
  for (const [name, panel] of [['stats', ui.statsPanel], ['inventory', ui.inventoryPanel], ['settings', ui.settingsPanel]] as const) {
    if (name === except) continue;
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }
}
function setInventoryPanel(open: boolean): void {
  if (open) closeOtherPanels('inventory');
  ui.inventoryPanel.classList.toggle('visible', open);
  ui.inventoryPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderInventory(save.inventory);
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
ui.settingsButton.addEventListener('click', () => setSettingsPanel(true));
ui.settingsClose.addEventListener('click', () => setSettingsPanel(false));
ui.settingsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.settingsPanel) setSettingsPanel(false); });
ui.resetAttributesButton.addEventListener('click', () => {
  if (!window.confirm('Reset all permanent hero attributes? Your equipment and its progress will be kept.')) return;
  resetPermanentStats();
  gameplay.hero.hp = Math.min(gameplay.hero.hp, maxHeroHp());
  persist();
  renderStats(save.stats);
  updateHud();
  showToast('Permanent attributes reset · equipment kept');
});
ui.resetHeroButton.addEventListener('click', () => {
  if (!window.confirm('Reset all permanent hero attributes and equipment drops? World progression will be kept.')) return;
  resetHeroProgress();
  gameplay.hero.hp = Math.min(gameplay.hero.hp, maxHeroHp());
  heroView.syncEquipment(save.inventory);
  persist();
  renderStats(save.stats);
  renderInventory(save.inventory);
  updateHud();
  showToast('Hero reset · attributes and equipment drops removed');
});
ui.settingsPanel.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === 'render-scale') applyRenderingQuality({ ...renderingQuality, renderScale: input.value === '0.7' ? 0.7 : 1 });
  if (input.name === 'frame-rate') applyRenderingQuality({ ...renderingQuality, frameRateLimit: input.value === '30' ? 30 : 60 });
  if (input === ui.rendererStatsToggle) applyRenderingQuality({ ...renderingQuality, showStats: input.checked });
});
let suppressInventoryClick = false;
ui.inventoryBag.addEventListener('click', (event) => {
  if (suppressInventoryClick) { suppressInventoryClick = false; return; }
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (button?.dataset.itemId) renderWeaponDetail(save.inventory.items[button.dataset.itemId] ?? null);
});
ui.inventoryEquipped.addEventListener('click', (event) => {
  const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (slot?.dataset.itemId) renderWeaponDetail(save.inventory.items[slot.dataset.itemId] ?? null);
});
ui.weaponDetail.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const itemId = button?.dataset.itemId;
  if (!button || !itemId) return;
  if (button.hasAttribute('data-equip')) {
    const armorSlot = equipmentSlot(itemId);
    const hand = armorSlot ?? (['hand1', 'hand2'] as const).find((slot) => save.inventory.equipped[slot] === null);
    if (!hand) { showToast('no free slots!'); return; }
    equip(itemId, hand); events.emit('equipmentEquipped', { itemId, hand });
  }
  if (button.dataset.unequip) { const hand = button.dataset.unequip as EquipmentSlotId; if (unequip(hand)) events.emit('equipmentUnequipped', { itemId, hand }); }
  if (button.hasAttribute('data-ascend')) { const previousAscend = save.inventory.items[itemId].ascend; if (ascend(itemId)) events.emit('weaponAscended', { itemId, previousAscend, newAscend: previousAscend + 1 }); }
  persist(); renderInventory(save.inventory); renderWeaponDetail(save.inventory.items[itemId]); updateHud();
});

type EquipmentDrag = { itemId: string; sourceHand: EquipmentSlotId | null };
function dragFrom(element: HTMLElement): EquipmentDrag | null {
  const itemId = element.dataset.itemId;
  if (!itemId) return null;
  const slot = element.closest<HTMLElement>('[data-slot]')?.dataset.slot;
  return { itemId, sourceHand: slot && ['hand1', 'hand2', 'orbit1', 'orbit2', 'helmet', 'armor', 'legs'].includes(slot) ? slot as EquipmentSlotId : null };
}
function completeEquipmentDrag(drag: EquipmentDrag, target: Element | null): void {
  const slot = target?.closest<HTMLElement>('.inventory-equip-slot:not(.locked)')?.dataset.slot;
  if (slot && ['hand1', 'hand2', 'orbit1', 'orbit2', 'helmet', 'armor', 'legs'].includes(slot)) {
    const equipmentSlotId = slot as EquipmentSlotId;
    equip(drag.itemId, equipmentSlotId);
    events.emit('equipmentEquipped', { itemId: drag.itemId, hand: equipmentSlotId });
  } else if (target?.closest('#inventory-bag') && drag.sourceHand) {
    unequip(drag.sourceHand);
    events.emit('equipmentUnequipped', { itemId: drag.itemId, hand: drag.sourceHand });
  } else return;
  persist(); renderInventory(save.inventory); renderWeaponDetail(save.inventory.items[drag.itemId]); updateHud();
}

ui.inventoryPanel.addEventListener('dragstart', (event) => {
  const source = (event.target as HTMLElement).closest<HTMLElement>('[draggable="true"]');
  const drag = source ? dragFrom(source) : null;
  if (!source || !drag || !event.dataTransfer) { event.preventDefault(); return; }
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-inventory-equipment', JSON.stringify(drag));
  source.classList.add('dragging');
});
ui.inventoryPanel.addEventListener('dragend', (event) => (event.target as HTMLElement).classList.remove('dragging'));
ui.inventoryPanel.addEventListener('dragover', (event) => {
  if ((event.target as Element).closest('.inventory-equip-slot:not(.locked), #inventory-bag')) event.preventDefault();
});
ui.inventoryPanel.addEventListener('drop', (event) => {
  event.preventDefault();
  const raw = event.dataTransfer?.getData('application/x-inventory-equipment');
  if (raw) completeEquipmentDrag(JSON.parse(raw) as EquipmentDrag, event.target as Element);
});

let pointerDrag: (EquipmentDrag & { startX: number; startY: number; active: boolean; source: HTMLElement }) | null = null;
ui.inventoryPanel.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  const source = (event.target as HTMLElement).closest<HTMLElement>('[draggable="true"]');
  const drag = source ? dragFrom(source) : null;
  if (source && drag) pointerDrag = { ...drag, startX: event.clientX, startY: event.clientY, active: false, source };
});
ui.inventoryPanel.addEventListener('pointermove', (event) => {
  if (!pointerDrag || pointerDrag.active) return;
  if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 8) return;
  pointerDrag.active = true;
  pointerDrag.source.classList.add('dragging');
});
ui.inventoryPanel.addEventListener('pointerup', (event) => {
  if (!pointerDrag) return;
  const drag = pointerDrag;
  pointerDrag = null;
  drag.source.classList.remove('dragging');
  if (!drag.active) return;
  suppressInventoryClick = true;
  completeEquipmentDrag(drag, document.elementFromPoint(event.clientX, event.clientY));
});
ui.inventoryPanel.addEventListener('pointercancel', () => { pointerDrag?.source.classList.remove('dragging'); pointerDrag = null; });

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

function enterArea(targetAreaId: number): void {
  if (!areaFlow.canEnter(targetAreaId, save.unlockedAreas)) return;
  const previous = areaById(currentAreaId);
  gameplay.enterArea(targetAreaId, areaFlow.crossesAdjacentBoundary(previous, areaById(targetAreaId)));
  currentAreaId = gameplay.currentAreaId;
  events.emit('areaEntered', { areaId: targetAreaId });
  save.currentAreaId = targetAreaId;
  const area = areaById(targetAreaId);
  renderEnemyAffinities(area);
  hero.position.copy(gameplay.hero.position);
  cameraController.returnToHero();
  gateTransitionCooldown = 1;
  input.reset();
  syncAreaVisibility();
  camera.position.set(area.originX, 19, area.originZ + 16.5);
  persist();
  showToast(area.name);
}

function updateGates(dt: number): void {
  gateEntities.forEach((gate) => gate.update(dt));
  gateTransitionCooldown = Math.max(0, gateTransitionCooldown - dt);
  if (gateTransitionCooldown > 0 || cameraController.isScripted || gameplay.hero.dead) return;
  const gate = gateEntities.find((candidate) => candidate.def.sourceAreaId === currentAreaId && candidate.open && candidate.distanceToHero() <= 1.45);
  if (gate) {
    events.emit('gateCrossed', { gateId: gate.def.id, destinationAreaId: gate.def.targetAreaId });
    enterArea(gate.def.targetAreaId);
  }
}

function updateTargetUi(): void {
  for (const entity of entities) {
    if (!entity.alive || entity.def.areaId !== currentAreaId) {
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
  const now = Date.now();
  for (const indicator of respawnIndicators) {
    if (indicator.members[0].def.areaId !== currentAreaId || !indicator.members.every((member) => !member.alive && member.deathPresentationRemaining === 0)) {
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
  for (const hand of ['hand1', 'hand2'] as const) {
    const profile = attackProfile(hand);
    ui[hand === 'hand1' ? 'hand1Stat' : 'hand2Stat'].innerHTML = profile
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
let previous = performance.now();
let lastRenderedAt = 0;
let statsStartedAt = performance.now();
let statsFrames = 0;
let midnightAccumulator = 0;
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
  if (midnightAccumulator >= 1) {
    midnightAccumulator = 0;
    resetAtMidnightIfNeeded();
  }

  const runtimeEvents = gameplay.update(dt, input.movement, !cameraController.isScripted, elapsedSeconds);
  for (const event of runtimeEvents) {
    if (event.type === 'enemyAttack') damageHero(event.amount, event.damageType);
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
  updateGates(dt);
  if (!cameraController.isScripted) entities.forEach((entity) => entity.update());
  autoAttack();
  entities.forEach((entity) => entity.updateView(dt));
  if (!gameplay.hero.dead) gameplay.hero.hp = Math.min(maxHeroHp(), gameplay.hero.hp + heroRegen() * dt);
  cameraController.update(dt, now);
  updateHud();
  worldUi.update(dt);
  effects.update(dt);
  if (rendererContextAvailable) renderer.render(scene, camera);
  if (import.meta.env.DEV && renderingQuality.showStats) {
    statsFrames += 1;
    const elapsed = now - statsStartedAt;
    if (elapsed >= 500) {
      const info = renderer.info.render;
      const activeMixers = entities.filter((entity) => entity.alive && entity.def.areaId === currentAreaId && entity.enemyView?.animationReady).length + (heroView.animationReady ? 1 : 0);
      ui.rendererStats.textContent = `${Math.round(statsFrames * 1000 / elapsed)} FPS\n${info.calls} calls · ${info.triangles.toLocaleString()} triangles\n${activeMixers} active character mixers\n${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures\n${renderer.domElement.width}×${renderer.domElement.height} buffer`;
      statsFrames = 0;
      statsStartedAt = now;
    }
  }
}

renderStats(save.stats);
renderInventory(save.inventory);
renderEnemyAffinities(areaById(currentAreaId));
updateHud();
persist();
requestAnimationFrame(frame);

  }
}

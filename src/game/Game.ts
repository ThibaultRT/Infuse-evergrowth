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
  HERO_SPEED,
  GATES,
  SPAWNS,
  TIER_CONFIG,
  areaById,
  enemyAttack,
  enemyMaxHp,
  enemyStatReward
} from '../config';
import { bluntHammerIcon, combatAffinityIcon, damageTypeIcon, heartIcon } from '../icons';
import { emptySpawnState, heroRegen, localDailyKey, maxHeroHp, nextLocalMidnightMs, persist, resetPermanentStats, rollLoot, save } from '../save';
import type { CombatAffinity, DamageType, EquipmentSlotId, GateDefinition, LootType, SpawnDefinition, TierConfig } from '../types';
import { renderEnemyAffinities, renderInventory, renderStats, renderWeaponDetail, showEquipmentDrop, showToast, ui } from '../ui';
import { addRock, makeCrystal, makeTierRing } from '../visuals';
import { InputController } from '../controllers/InputController';
import { CameraController } from '../controllers/CameraController';
import { GameEvents } from './GameEvents';
import { applyEquipmentCopies, ascend, attackProfile, equip, unequip } from '../systems/EquipmentSystem';
import { rollEquipmentDrop } from '../systems/EquipmentDropSystem';
import { effectivePixelRatio, loadRenderingQuality, saveRenderingQuality, type RenderingQualitySettings } from '../rendering/RenderingQuality';
import { EnvironmentView } from '../rendering/EnvironmentView';
import { GateView } from '../rendering/GateView';
import { HeroView } from '../rendering/HeroView';
import { EnemyView } from '../rendering/EnemyView';
import { EffectManager } from '../rendering/EffectManager';

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
const effects = new EffectManager(scene);
let renderingQuality = loadRenderingQuality();
renderer.setPixelRatio(effectivePixelRatio(renderingQuality));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.canvasHost.append(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
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

let currentAreaId = save.currentAreaId;
const initialArea = areaById(currentAreaId);
const heroView = new HeroView();
heroView.syncEquipment(save.inventory);
events.on('equipmentEquipped', () => heroView.syncEquipment(save.inventory));
events.on('equipmentUnequipped', () => heroView.syncEquipment(save.inventory));
const hero = heroView.root;
hero.position.set(initialArea.originX, 0, initialArea.originZ);
scene.add(hero);
let heroHp = maxHeroHp();
let heroDead = false;
const attackCooldowns: Record<EquipmentSlotId, number> = { hand1: 0, hand2: 0, orbit1: 0, orbit2: 0 };
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
  return type === 'hp' ? heartIcon(size) : bluntHammerIcon(size);
}

type FloatingCombatText = {
  element: HTMLDivElement;
  position: THREE.Vector3;
  age: number;
  duration: number;
};
const combatTexts: FloatingCombatText[] = [];

function showCombatText(position: THREE.Vector3, amount: number, type: CombatAffinity | DamageType, incoming = false): void {
  const element = document.createElement('div');
  element.className = `combat-text${incoming ? ' incoming' : ''}`;
  element.innerHTML = `<span>${incoming ? '-' : ''}${Math.round(amount)}</span>${incoming ? combatAffinityIcon(type as CombatAffinity, 10) : damageTypeIcon(type as DamageType, 10)}`;
  ui.world.append(element);
  combatTexts.push({ element, position: position.clone(), age: 0, duration: .9 });
}

class SpawnEntity {
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly maxHp: number;
  readonly damage: number;
  readonly statReward: number;
  readonly damageType: CombatAffinity;
  readonly targetUi = document.createElement('div');
  readonly lootLabel = document.createElement('div');
  readonly healthBar = document.createElement('div');
  readonly healthFill = document.createElement('span');
  hp: number;
  alive = true;
  provoked = false;
  attackCooldown = 0;
  readonly enemyView: EnemyView | null;
  moving = false;
  deathPresentationRemaining = 0;

  constructor(readonly def: SpawnDefinition) {
    this.config = TIER_CONFIG[def.tier];
    this.maxHp = enemyMaxHp(def.areaId, def.tier);
    this.hp = this.maxHp;
    this.damage = enemyAttack(def.areaId, def.tier);
    this.statReward = enemyStatReward(def.areaId, def.tier);
    this.damageType = areaById(def.areaId).enemyWeapon;
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.enemyView = def.tier === 'crystal' ? null : new EnemyView(def.tier, this.config.color);
    this.root.add(this.enemyView?.root ?? makeCrystal(this.config.color), makeTierRing(this.config.color));
    scene.add(this.root);

    this.targetUi.className = 'world-target-ui';
    this.lootLabel.className = 'world-loot';
    this.healthBar.className = 'world-hp-bar';
    this.healthFill.style.backgroundColor = `#${this.config.color.toString(16).padStart(6, '0')}`;
    this.healthBar.append(this.healthFill);
    this.targetUi.append(this.lootLabel, this.healthBar);
    ui.world.append(this.targetUi);

    const state = save.spawns[def.id];
    if (state?.respawnAt && state.respawnAt > Date.now()) this.setAlive(false);
    else if (state?.respawnAt) {
      state.respawnAt = null;
      state.defeatedAt = null;
      state.loot = rollLoot();
      this.setAlive(true);
      persist();
    } else this.renderLoot();
    this.syncAreaVisibility();
  }

  renderLoot(): void {
    const loot = save.spawns[this.def.id].loot;
    this.lootLabel.className = `world-loot ${loot}`;
    this.lootLabel.innerHTML = `<span>${formatRewardAmount(this.statReward)}</span>${lootIcon(loot)}`;
  }

  syncAreaVisibility(): void {
    const visible = (this.alive || this.deathPresentationRemaining > 0) && this.def.areaId === currentAreaId;
    this.root.visible = visible;
    this.targetUi.classList.toggle('hidden', !this.alive || this.def.areaId !== currentAreaId);
  }

  setAlive(value: boolean): void {
    this.alive = value;
    if (value) {
      this.deathPresentationRemaining = 0;
      this.hp = this.maxHp;
      this.healthFill.style.width = '100%';
      this.provoked = false;
      this.attackCooldown = 0;
      this.root.position.copy(this.spawnPosition);
      this.renderLoot();
    }
    this.syncAreaVisibility();
  }

  forceRespawn(): void { this.setAlive(true); }
  resetAfterHeroDefeat(): void {
    this.hp = this.maxHp;
    this.healthFill.style.width = '100%';
    this.provoked = false;
    this.attackCooldown = 0;
    this.root.position.copy(this.spawnPosition);
  }
  distanceToHero(): number { return this.root.position.distanceTo(hero.position); }

  receiveDamage(amount: number, type: DamageType): void {
    if (!this.alive || this.def.areaId !== currentAreaId) return;
    events.emit('enemyDamaged', { enemyId: this.def.id, amount, damageType: type });
    effects.impact(this.root.position, type);
    this.enemyView?.playHit();
    showCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), amount, type);
    this.hp = Math.max(0, this.hp - amount);
    this.healthFill.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (this.config.hostile) this.provoked = true;
    if (this.hp === 0) this.defeat();
  }

  defeat(): void {
    this.enemyView?.playDeath();
    this.deathPresentationRemaining = 1.1;
    const state = save.spawns[this.def.id];
    const now = Date.now();
    state.killsToday += 1;
    state.defeatedAt = now;
    const timer = BASE_RESPAWN_MS * this.config.respawnMultiplier * 2 ** (state.killsToday - 1);
    state.respawnAt = Math.min(now + timer, nextLocalMidnightMs());

    const stat = state.loot;
    const amount = this.statReward;
    events.emit('enemyDefeated', { enemyId: this.def.id });
    if (stat === 'hp') {
      const oldMax = maxHeroHp();
      save.stats.maxHp.additive.kills = (save.stats.maxHp.additive.kills ?? 0) + amount;
      heroHp = Math.min(maxHeroHp(), heroHp + maxHeroHp() - oldMax);
    } else {
      const blunt = save.stats.attack[stat];
      blunt.additive.kills = (blunt.additive.kills ?? 0) + amount;
    }

    this.setAlive(false);
    events.emit('statGained', { sourceId: this.def.id, stat, amount });
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
    showToast(`+${formatRewardAmount(amount)} ${stat === 'hp' ? 'HP' : 'BLUNT'} · ${this.config.label}`);
  }

  update(dt: number): void {
    this.moving = false;
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (state?.respawnAt && Date.now() >= state.respawnAt) {
        state.respawnAt = null;
        state.defeatedAt = null;
        state.loot = rollLoot();
        this.setAlive(true);
        events.emit('enemyRespawned', { enemyId: this.def.id });
        persist();
      }
      return;
    }
    if (this.def.areaId !== currentAreaId || !this.config.hostile || heroDead) return;

    const toHero = hero.position.clone().sub(this.root.position);
    const distance = toHero.length();
    const fromSpawn = this.root.position.distanceTo(this.spawnPosition);

    if (!this.provoked && distance <= ENEMY_AGGRO_RADIUS_METERS && fromSpawn < ENEMY_LEASH_RADIUS_METERS) this.provoked = true;
    if (this.provoked && fromSpawn >= ENEMY_LEASH_RADIUS_METERS) this.provoked = false;

    if (this.provoked) {
      if (distance >= HERO_ATTACK_RANGE_METERS * .95) {
        toHero.normalize();
        this.root.position.addScaledVector(toHero, Math.min(4.8, 2.4 + this.config.statMultiplier * .18) * dt);
        this.root.rotation.y = Math.atan2(toHero.x, toHero.z);
        this.moving = true;
      }
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      if (distance <= ENEMY_ATTACK_RANGE_METERS && this.attackCooldown === 0) {
        damageHero(this.damage, this.damageType);
        this.attackCooldown = ENEMY_ATTACK_COOLDOWN;
      }
      return;
    }

    const back = this.spawnPosition.clone().sub(this.root.position);
    if (back.length() > .08) { this.root.position.addScaledVector(back.normalize(), 3 * dt); this.moving = true; }
    else this.root.position.copy(this.spawnPosition);
  }

  updateView(dt: number): void {
    if (this.deathPresentationRemaining > 0) {
      this.deathPresentationRemaining = Math.max(0, this.deathPresentationRemaining - dt);
      if (this.deathPresentationRemaining === 0) this.syncAreaVisibility();
    }
    this.enemyView?.update(dt, this.moving, this.def.areaId === currentAreaId && (this.alive || this.deathPresentationRemaining > 0));
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
  distanceToHero(): number { return this.root.position.distanceTo(hero.position); }
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
  if (spawnId !== area.bossSpawnId || save.defeatedBosses.includes(spawnId)) return;
  save.defeatedBosses.push(spawnId);
  events.emit('bossDefeated', { bossId: spawnId, areaId });

  const openedGates = gateEntities.filter((gate) => gate.def.sourceAreaId === areaId && gate.def.requiresBossDefeated);
  for (const gate of openedGates) {
    if (!save.unlockedAreas.includes(gate.def.targetAreaId)) save.unlockedAreas.push(gate.def.targetAreaId);
    gate.setOpen(true);
    events.emit('gateUnlocked', { gateId: gate.def.id });
  }
  if (openedGates[0]) {
    startGateCinematic(openedGates[0]);
    showToast(`${areaById(openedGates[0].def.targetAreaId).name} unlocked`);
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
    state.respawnAt = null;
    state.defeatedAt = null;
    state.loot = rollLoot();
    entity.forceRespawn();
    events.emit('enemyRespawned', { enemyId: entity.def.id });
    resetCount += 1;
  });
  persist();
  showToast(resetCount === 0 ? 'No spawn cooldowns active' : `Spawned ${resetCount} target${resetCount === 1 ? '' : 's'}`);
}

function damageHero(amount: number, type: CombatAffinity): void {
  if (heroDead) return;
  events.emit('heroDamaged', { amount, damageType: type });
  heroView.playHit();
  showCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), amount, type, true);
  heroHp = Math.max(0, heroHp - amount);
  updateHud();
  if (heroHp !== 0) return;
  heroDead = true;
  heroView.playDeath();
  events.emit('heroDefeated', undefined);
  input.reset();
  entities.forEach((entity) => entity.resetAfterHeroDefeat());
  showToast('Defeated · respawning in 5 seconds');
  window.setTimeout(() => {
    const area = areaById(currentAreaId);
    hero.position.set(area.originX, 0, area.originZ);
    heroHp = maxHeroHp();
    heroDead = false;
    effects.resurrection(hero.position);
    events.emit('heroResurrected', { areaId: currentAreaId });
    updateHud();
  }, HERO_RESPAWN_DELAY_MS);
}

function nearestTarget(maxDistance = HERO_ATTACK_RANGE_METERS): SpawnEntity | null {
  let best: SpawnEntity | null = null;
  let distance = maxDistance;
  for (const entity of entities) {
    if (!entity.alive || entity.def.areaId !== currentAreaId) continue;
    const candidate = entity.distanceToHero();
    if (candidate < distance) { best = entity; distance = candidate; }
  }
  return best;
}

function autoAttack(): void {
  if (heroDead || cameraController.isScripted) return;
  for (const hand of ['hand1', 'hand2', 'orbit1', 'orbit2'] as const) {
    if (attackCooldowns[hand] > 0 || ((hand === 'orbit1' || hand === 'orbit2') && !save.inventory.equipped[hand])) continue;
    const target = nearestTarget();
    if (!target) continue;
    const profile = attackProfile(hand);
    attackCooldowns[hand] = profile.cooldownSeconds;
    heroView.playWeaponAttack(hand, profile.damageType, target.root.position);
    events.emit('weaponAttacked', { slot: hand, targetId: target.def.id, damageType: profile.damageType });
    target.receiveDamage(profile.damage, profile.damageType);
    const direction = target.root.position.clone().sub(hero.position);
    if (direction.lengthSq() > 0) heroView.setFacing(Math.atan2(direction.x, direction.z));
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
  heroHp = Math.min(heroHp, maxHeroHp());
  persist();
  renderStats(save.stats);
  updateHud();
  showToast('Permanent attributes reset · equipment kept');
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
    const hand = (['hand1', 'hand2'] as const).find((slot) => save.inventory.equipped[slot] === null);
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
  return { itemId, sourceHand: slot === 'hand1' || slot === 'hand2' || slot === 'orbit1' || slot === 'orbit2' ? slot : null };
}
function completeEquipmentDrag(drag: EquipmentDrag, target: Element | null): void {
  const slot = target?.closest<HTMLElement>('.inventory-equip-slot:not(.locked)')?.dataset.slot;
  if (slot === 'hand1' || slot === 'hand2' || slot === 'orbit1' || slot === 'orbit2') {
    equip(drag.itemId, slot);
    events.emit('equipmentEquipped', { itemId: drag.itemId, hand: slot });
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
  if (heroDead || cameraController.isScripted) { heroView.update(dt, false); return; }
  const move = input.movement;
  const moving = move.x !== 0 || move.y !== 0;
  if (moving) {
    hero.position.x += move.x * HERO_SPEED * dt;
    hero.position.z -= move.y * HERO_SPEED * dt;
    const area = areaById(currentAreaId);
    hero.position.x = THREE.MathUtils.clamp(hero.position.x, area.originX - 17.2, area.originX + 17.2);
    hero.position.z = THREE.MathUtils.clamp(hero.position.z, area.originZ - 27.2, area.originZ + 27.2);
    heroView.setFacing(Math.atan2(move.x, -move.y));
  }
  heroView.update(dt, moving);
}

function enterArea(targetAreaId: number): void {
  if (!save.unlockedAreas.includes(targetAreaId)) return;
  const previous = areaById(currentAreaId);
  currentAreaId = targetAreaId;
  events.emit('areaEntered', { areaId: targetAreaId });
  save.currentAreaId = targetAreaId;
  const area = areaById(targetAreaId);
  renderEnemyAffinities(area);
  const crossedAdjacentBoundary = previous.id !== area.id && Math.abs(previous.originZ - area.originZ) <= 60 && previous.originX === area.originX;
  if (crossedAdjacentBoundary) hero.position.z += area.originZ < previous.originZ ? -2.8 : 2.8;
  else hero.position.set(area.originX, 0, area.originZ);
  entities.forEach((entity) => { entity.provoked = false; });
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
  if (gateTransitionCooldown > 0 || cameraController.isScripted || heroDead) return;
  const gate = gateEntities.find((candidate) => candidate.def.sourceAreaId === currentAreaId && candidate.open && candidate.distanceToHero() <= 1.45);
  if (gate) {
    events.emit('gateCrossed', { gateId: gate.def.id, destinationAreaId: gate.def.targetAreaId });
    enterArea(gate.def.targetAreaId);
  }
}

const projected = new THREE.Vector3();
function projectWorldElement(position: THREE.Vector3, element: HTMLElement, yOffset = 0): boolean {
  projected.copy(position);
  projected.y += yOffset;
  projected.project(camera);
  const shown = projected.z >= -1 && projected.z <= 1 && projected.x >= -1.08 && projected.x <= 1.08 && projected.y >= -1.08 && projected.y <= 1.08;
  element.style.visibility = shown ? 'visible' : 'hidden';
  if (!shown) return false;
  element.style.left = `${(projected.x * .5 + .5) * renderer.domElement.clientWidth}px`;
  element.style.top = `${(-projected.y * .5 + .5) * renderer.domElement.clientHeight}px`;
  return true;
}

function updateTargetUi(): void {
  for (const entity of entities) {
    if (!entity.alive || entity.def.areaId !== currentAreaId) {
      entity.targetUi.style.visibility = 'hidden';
      continue;
    }
    projectWorldElement(entity.root.position, entity.targetUi, entity.def.tier === 'crystal' ? 2.05 : 3.05);
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
    if (indicator.members[0].def.areaId !== currentAreaId || !indicator.members.every((member) => !member.alive)) {
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
    projectWorldElement(indicator.center, indicator.element, indicator.members[0].def.tier === 'crystal' ? .9 : 1.1);
  }
}

function updateCombatTexts(dt: number): void {
  for (let index = combatTexts.length - 1; index >= 0; index--) {
    const item = combatTexts[index];
    item.age += dt;
    if (item.age >= item.duration) {
      item.element.remove();
      combatTexts.splice(index, 1);
      continue;
    }
    if (projectWorldElement(item.position, item.element)) {
      const progress = item.age / item.duration;
      item.element.style.transform = `translate(-50%, calc(-50% - ${progress * 24}px))`;
      item.element.style.opacity = String(1 - progress);
    }
  }
}

function updateHud(): void {
  const maxHp = maxHeroHp();
  ui.hpText.textContent = `${Math.round(heroHp)} / ${Math.round(maxHp)}`;
  ui.hpBar.style.width = `${heroHp / maxHp * 100}%`;
  for (const hand of ['hand1', 'hand2'] as const) {
    const profile = attackProfile(hand);
    ui[hand === 'hand1' ? 'hand1Stat' : 'hand2Stat'].innerHTML = `${Math.round(profile.damage)} ${damageTypeIcon(profile.damageType, 12)}`;
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
    entities.forEach((entity) => entity.update(0));
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
  const dt = Math.min((now - previous) / 1000, .05);
  previous = now;
  for (const slot of ['hand1', 'hand2', 'orbit1', 'orbit2'] as const) attackCooldowns[slot] = Math.max(0, attackCooldowns[slot] - dt);
  midnightAccumulator += dt;
  if (midnightAccumulator >= 1) {
    midnightAccumulator = 0;
    resetAtMidnightIfNeeded();
  }

  updateHero(dt);
  updateGates(dt);
  autoAttack();
  if (!cameraController.isScripted) entities.forEach((entity) => entity.update(dt));
  entities.forEach((entity) => entity.updateView(dt));
  if (!heroDead) heroHp = Math.min(maxHeroHp(), heroHp + heroRegen() * dt);
  cameraController.update(dt, now);
  updateHud();
  updateCombatTexts(dt);
  effects.update(dt);
  renderer.render(scene, camera);
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

import * as THREE from 'three';
import './style.css';
import {
  AREAS,
  BARE_HANDS_DAMAGE_TYPE,
  BASE_RESPAWN_MS,
  ENEMY_AGGRO_RADIUS,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_ATTACK_RANGE,
  ENEMY_LEASH_RADIUS,
  HERO_ATTACK_COOLDOWN,
  HERO_ATTACK_RANGE,
  HERO_SPEED,
  PORTALS,
  SPAWNS,
  TIER_CONFIG,
  areaById,
  enemyAttack,
  enemyMaxHp
} from './config';
import { bluntHammerIcon, heartIcon } from './icons';
import { emptySpawnState, heroDamage, heroRegen, localDailyKey, maxHeroHp, nextLocalMidnightMs, persist, rollLoot, save } from './save';
import type { DamageType, LootType, PortalDefinition, SpawnDefinition, TierConfig } from './types';
import { renderInventory, renderStats, showToast, ui } from './ui';
import { applyVersionTag } from './version';
import { addRock, makeCrystal, makeHumanoid, makePortal, makeTierRing } from './visuals';

applyVersionTag();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b8cf);
scene.fog = new THREE.Fog(0x93b8cf, 42, 82);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.canvasHost.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2));
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

for (const area of AREAS) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(38, 56), new THREE.MeshStandardMaterial({ color: area.id === 1 ? 0x668d52 : 0x5d8556, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(area.originX, 0, area.originZ);
  ground.receiveShadow = true;
  scene.add(ground);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 50), new THREE.MeshStandardMaterial({ color: area.id === 1 ? 0x9c906c : 0x879574, roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(area.originX, 0.012, area.originZ);
  path.receiveShadow = true;
  scene.add(path);

  for (const [x, z, scale] of ROCK_LAYOUT) addRock(scene, area.originX + x, area.originZ + z, scale);
}

let currentAreaId = save.currentAreaId;
const initialArea = areaById(currentAreaId);
const hero = makeHumanoid(0x2f3540, true);
hero.position.set(initialArea.originX, 0, initialArea.originZ);
scene.add(hero);
let heroHp = maxHeroHp();
let heroDead = false;
let heroAttackCooldown = 0;
let portalTransitionCooldown = 0;
const ENEMY_DAMAGE_TYPE: DamageType = 'blunt';

type CameraFocus = { point: THREE.Vector3; expiresAt: number };
let cameraFocus: CameraFocus | null = null;

function syncLighting(): void {
  const area = areaById(currentAreaId);
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

function showCombatText(position: THREE.Vector3, amount: number, type: DamageType, incoming = false): void {
  const element = document.createElement('div');
  element.className = `combat-text${incoming ? ' incoming' : ''}`;
  element.innerHTML = `<span>${incoming ? '-' : ''}${Math.round(amount)}</span>${type === 'blunt' ? bluntHammerIcon(10) : ''}`;
  ui.world.append(element);
  combatTexts.push({ element, position: position.clone(), age: 0, duration: .9 });
}

class SpawnEntity {
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly maxHp: number;
  readonly damage: number;
  readonly targetUi = document.createElement('div');
  readonly lootLabel = document.createElement('div');
  readonly healthBar = document.createElement('div');
  readonly healthFill = document.createElement('span');
  hp: number;
  alive = true;
  provoked = false;
  attackCooldown = 0;

  constructor(readonly def: SpawnDefinition) {
    this.config = TIER_CONFIG[def.tier];
    this.maxHp = enemyMaxHp(def.areaId, def.tier);
    this.hp = this.maxHp;
    this.damage = enemyAttack(def.areaId, def.tier);
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.root.add(def.tier === 'crystal' ? makeCrystal(this.config.color) : makeHumanoid(this.config.color), makeTierRing(this.config.color));
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
    this.lootLabel.innerHTML = `<span>${formatRewardAmount(this.config.statReward)}</span>${lootIcon(loot)}`;
  }

  syncAreaVisibility(): void {
    const visible = this.alive && this.def.areaId === currentAreaId;
    this.root.visible = visible;
    this.targetUi.classList.toggle('hidden', !visible);
  }

  setAlive(value: boolean): void {
    this.alive = value;
    if (value) {
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
  distanceToHero(): number { return this.root.position.distanceTo(hero.position); }

  receiveDamage(amount: number, type: DamageType): void {
    if (!this.alive || this.def.areaId !== currentAreaId) return;
    showCombatText(this.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)), amount, type);
    this.hp = Math.max(0, this.hp - amount);
    this.healthFill.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (this.config.hostile) this.provoked = true;
    if (this.hp === 0) this.defeat();
  }

  defeat(): void {
    const state = save.spawns[this.def.id];
    const now = Date.now();
    state.killsToday += 1;
    state.defeatedAt = now;
    const timer = BASE_RESPAWN_MS * this.config.respawnMultiplier * 2 ** (state.killsToday - 1);
    state.respawnAt = Math.min(now + timer, nextLocalMidnightMs());

    const stat = state.loot;
    const amount = this.config.statReward;
    if (stat === 'hp') {
      const oldMax = maxHeroHp();
      save.stats.maxHp.additive.kills = (save.stats.maxHp.additive.kills ?? 0) + amount;
      heroHp = Math.min(maxHeroHp(), heroHp + maxHeroHp() - oldMax);
    } else {
      const blunt = save.stats.attack[stat];
      blunt.additive.kills = (blunt.additive.kills ?? 0) + amount;
    }

    this.setAlive(false);
    handleBossDefeat(this.def.areaId, this.def.id);
    persist();
    renderStats(save.stats);
    showToast(`+${formatRewardAmount(amount)} ${stat === 'hp' ? 'HP' : 'BLUNT'} · ${this.config.label}`);
  }

  update(dt: number): void {
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (state?.respawnAt && Date.now() >= state.respawnAt) {
        state.respawnAt = null;
        state.defeatedAt = null;
        state.loot = rollLoot();
        this.setAlive(true);
        persist();
      }
      return;
    }
    if (this.def.areaId !== currentAreaId || !this.config.hostile || heroDead) return;

    const toHero = hero.position.clone().sub(this.root.position);
    const distance = toHero.length();
    const fromSpawn = this.root.position.distanceTo(this.spawnPosition);

    if (!this.provoked && distance <= ENEMY_AGGRO_RADIUS && fromSpawn < ENEMY_LEASH_RADIUS) this.provoked = true;
    if (this.provoked && fromSpawn >= ENEMY_LEASH_RADIUS) this.provoked = false;

    if (this.provoked) {
      if (distance > ENEMY_ATTACK_RANGE) {
        toHero.normalize();
        this.root.position.addScaledVector(toHero, Math.min(4.8, 2.4 + this.config.statMultiplier * .18) * dt);
        this.root.rotation.y = Math.atan2(toHero.x, toHero.z);
      }
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      if (distance <= ENEMY_ATTACK_RANGE && this.attackCooldown === 0) {
        damageHero(this.damage, ENEMY_DAMAGE_TYPE);
        this.attackCooldown = ENEMY_ATTACK_COOLDOWN;
      }
      return;
    }

    const back = this.spawnPosition.clone().sub(this.root.position);
    if (back.length() > .08) this.root.position.addScaledVector(back.normalize(), 3 * dt);
    else this.root.position.copy(this.spawnPosition);
  }
}

const entities = SPAWNS.map((spawn) => new SpawnEntity(spawn));

class PortalEntity {
  readonly root: THREE.Group;
  readonly barrier: THREE.Mesh;
  readonly glow: THREE.MeshStandardMaterial;
  open = false;

  constructor(readonly def: PortalDefinition) {
    const visual = makePortal();
    this.root = visual.root;
    this.barrier = visual.barrier;
    this.glow = visual.glow;
    this.root.position.set(def.x, 0, def.z);
    this.root.userData.portalId = def.id;
    this.root.userData.tag = def.tag;
    this.root.userData.targetAreaId = def.targetAreaId;
    scene.add(this.root);
    this.setOpen(save.unlockedAreas.includes(def.targetAreaId) || !def.requiresBossDefeated);
    this.syncAreaVisibility();
  }

  setOpen(value: boolean): void {
    this.open = value;
    this.barrier.visible = !value;
    this.glow.emissiveIntensity = value ? 1.25 : 0.12;
    this.glow.color.setHex(value ? 0x6ad8ff : 0x59636f);
  }

  syncAreaVisibility(): void { this.root.visible = this.def.sourceAreaId === currentAreaId; }
  distanceToHero(): number { return this.root.position.distanceTo(hero.position); }
}

const portalEntities = PORTALS.map((portal) => new PortalEntity(portal));

function syncAreaVisibility(): void {
  entities.forEach((entity) => entity.syncAreaVisibility());
  portalEntities.forEach((portal) => portal.syncAreaVisibility());
  syncLighting();
}

function startPortalCinematic(portal: PortalEntity): void {
  resetJoystick();
  cameraFocus = { point: portal.root.position.clone(), expiresAt: performance.now() + 2600 };
}

function handleBossDefeat(areaId: number, spawnId: string): void {
  const area = areaById(areaId);
  if (spawnId !== area.bossSpawnId || save.defeatedBosses.includes(spawnId)) return;
  save.defeatedBosses.push(spawnId);

  const openedPortals = portalEntities.filter((portal) => portal.def.sourceAreaId === areaId && portal.def.requiresBossDefeated);
  for (const portal of openedPortals) {
    if (!save.unlockedAreas.includes(portal.def.targetAreaId)) save.unlockedAreas.push(portal.def.targetAreaId);
    portal.setOpen(true);
  }
  if (openedPortals[0]) {
    startPortalCinematic(openedPortals[0]);
    showToast(`${areaById(openedPortals[0].def.targetAreaId).name} unlocked`);
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

function damageHero(amount: number, type: DamageType): void {
  if (heroDead) return;
  showCombatText(hero.position.clone().add(new THREE.Vector3(0, 2.9, 0)), amount, type, true);
  heroHp = Math.max(0, heroHp - amount);
  updateHud();
  if (heroHp !== 0) return;
  heroDead = true;
  showToast('Defeated · returning to the start');
  setTimeout(() => {
    const area = areaById(currentAreaId);
    hero.position.set(area.originX, 0, area.originZ);
    heroHp = maxHeroHp();
    heroDead = false;
    entities.forEach((entity) => { entity.provoked = false; });
    updateHud();
  }, 1200);
}

function nearestTarget(maxDistance = HERO_ATTACK_RANGE): SpawnEntity | null {
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
  if (heroDead || heroAttackCooldown > 0 || cameraFocus) return;
  const target = nearestTarget();
  if (!target) return;
  heroAttackCooldown = HERO_ATTACK_COOLDOWN;
  target.receiveDamage(heroDamage(BARE_HANDS_DAMAGE_TYPE), BARE_HANDS_DAMAGE_TYPE);
  const direction = target.root.position.clone().sub(hero.position);
  if (direction.lengthSq() > 0) hero.rotation.y = Math.atan2(direction.x, direction.z);
}

const keys = new Set<string>();
addEventListener('keydown', (event) => keys.add(event.code));
addEventListener('keyup', (event) => keys.delete(event.code));
const joystickVector = new THREE.Vector2();
let joystickPointer: number | null = null;
function resetJoystick(): void {
  joystickPointer = null;
  joystickVector.set(0, 0);
  ui.joystickKnob.style.transform = 'translate(-50%, -50%)';
}
ui.joystick.addEventListener('pointerdown', (event) => {
  joystickPointer = event.pointerId;
  ui.joystick.setPointerCapture(event.pointerId);
});
ui.joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return;
  const rect = ui.joystick.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const radius = rect.width * .34;
  const length = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(length, radius);
  const nx = dx / length * clamped;
  const ny = dy / length * clamped;
  joystickVector.set(nx / radius, ny / radius);
  ui.joystickKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
});
ui.joystick.addEventListener('pointerup', resetJoystick);
ui.joystick.addEventListener('pointercancel', resetJoystick);

function setStatsPanel(open: boolean): void {
  if (open) {
    ui.inventoryPanel.classList.remove('visible');
    ui.inventoryPanel.setAttribute('aria-hidden', 'true');
  }
  ui.statsPanel.classList.toggle('visible', open);
  ui.statsPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderStats(save.stats);
}
function setInventoryPanel(open: boolean): void {
  if (open) {
    ui.statsPanel.classList.remove('visible');
    ui.statsPanel.setAttribute('aria-hidden', 'true');
  }
  ui.inventoryPanel.classList.toggle('visible', open);
  ui.inventoryPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderInventory(save.inventory);
}
ui.statsButton.addEventListener('click', () => setStatsPanel(true));
ui.statsClose.addEventListener('click', () => setStatsPanel(false));
ui.statsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.statsPanel) setStatsPanel(false); });
ui.inventoryButton.addEventListener('click', () => setInventoryPanel(true));
ui.inventoryClose.addEventListener('click', () => setInventoryPanel(false));
ui.inventoryPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.inventoryPanel) setInventoryPanel(false); });

function movementVector(): THREE.Vector2 {
  let x = joystickVector.x;
  let y = -joystickVector.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y++;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y--;
  const vector = new THREE.Vector2(x, y);
  if (vector.lengthSq() > 1) vector.normalize();
  return vector;
}

function updateHero(dt: number): void {
  if (heroDead || cameraFocus) return;
  const move = movementVector();
  if (move.lengthSq() === 0) return;
  hero.position.x += move.x * HERO_SPEED * dt;
  hero.position.z -= move.y * HERO_SPEED * dt;
  const area = areaById(currentAreaId);
  hero.position.x = THREE.MathUtils.clamp(hero.position.x, area.originX - 17.2, area.originX + 17.2);
  hero.position.z = THREE.MathUtils.clamp(hero.position.z, area.originZ - 26.2, area.originZ + 26.2);
  hero.rotation.y = Math.atan2(move.x, -move.y);
}

function enterArea(targetAreaId: number): void {
  if (!save.unlockedAreas.includes(targetAreaId)) return;
  currentAreaId = targetAreaId;
  save.currentAreaId = targetAreaId;
  const area = areaById(targetAreaId);
  hero.position.set(area.originX, 0, area.originZ);
  entities.forEach((entity) => { entity.provoked = false; });
  cameraFocus = null;
  portalTransitionCooldown = 1;
  resetJoystick();
  syncAreaVisibility();
  camera.position.set(area.originX, 19, area.originZ + 16.5);
  persist();
  showToast(area.name);
}

function updatePortals(dt: number): void {
  portalTransitionCooldown = Math.max(0, portalTransitionCooldown - dt);
  if (portalTransitionCooldown > 0 || cameraFocus || heroDead) return;
  const portal = portalEntities.find((candidate) => candidate.def.sourceAreaId === currentAreaId && candidate.open && candidate.distanceToHero() <= 1.45);
  if (portal) enterArea(portal.def.targetAreaId);
}

function updateCamera(dt: number, now: number): void {
  if (cameraFocus && now < cameraFocus.expiresAt) {
    const desired = new THREE.Vector3(cameraFocus.point.x, 16, cameraFocus.point.z + 12);
    camera.position.lerp(desired, 1 - Math.exp(-3.2 * dt));
    camera.lookAt(cameraFocus.point.x, 1.25, cameraFocus.point.z);
    return;
  }
  if (cameraFocus) cameraFocus = null;
  camera.position.lerp(new THREE.Vector3(hero.position.x, 19, hero.position.z + 16.5), 1 - Math.exp(-5 * dt));
  camera.lookAt(hero.position.x, .9, hero.position.z - 2.5);
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
  ui.attackText.textContent = String(Math.round(heroDamage(BARE_HANDS_DAMAGE_TYPE)));
  updateTargetUi();
  updateRespawnIndicators();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    resetAtMidnightIfNeeded();
    entities.forEach((entity) => entity.update(0));
  }
});

syncAreaVisibility();
let previous = performance.now();
let midnightAccumulator = 0;
function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, .05);
  previous = now;
  heroAttackCooldown = Math.max(0, heroAttackCooldown - dt);
  midnightAccumulator += dt;
  if (midnightAccumulator >= 1) {
    midnightAccumulator = 0;
    resetAtMidnightIfNeeded();
  }

  updateHero(dt);
  updatePortals(dt);
  autoAttack();
  if (!cameraFocus) entities.forEach((entity) => entity.update(dt));
  if (!heroDead) heroHp = Math.min(maxHeroHp(), heroHp + heroRegen() * dt);
  updateCamera(dt, now);
  updateHud();
  updateCombatTexts(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

renderStats(save.stats);
renderInventory(save.inventory);
updateHud();
persist();
requestAnimationFrame(frame);

import * as THREE from 'three';
import './style.css';
import { BARE_HANDS_DAMAGE_TYPE, BASE_RESPAWN_MS, HERO_ATTACK_COOLDOWN, HERO_ATTACK_RANGE, HERO_SPEED, SPAWNS, TIER_CONFIG } from './config';
import { emptySpawnState, heroDamage, heroRegen, localDailyKey, maxHeroHp, nextLocalMidnightMs, persist, save } from './save';
import type { SpawnDefinition, TierConfig } from './types';
import { renderStats, showToast, ui } from './ui';
import { addRock, makeCrystal, makeHumanoid, makeTierRing } from './visuals';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b8cf);
scene.fog = new THREE.Fog(0x93b8cf, 42, 82);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 160);
camera.position.set(0, 20, 17);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.canvasHost.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.8); sun.position.set(-12, 22, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(38, 56), new THREE.MeshStandardMaterial({ color: 0x668d52, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 50), new THREE.MeshStandardMaterial({ color: 0x9c906c, roughness: 1 }));
path.rotation.x = -Math.PI / 2; path.position.y = 0.012; path.receiveShadow = true; scene.add(path);
[
  [-16, 5, 1.2], [-15, -3, .8], [16, 7, 1], [15, -4, 1.3], [-13, 10, .65], [13, 10, .7],
  [-16, -17, .85], [16, -16, .9], [-10, 23, .8], [10, 24, 1], [-5, -24, .8], [5, -25, 1.1]
].forEach(([x, z, s]) => addRock(scene, x, z, s));

const hero = makeHumanoid(0x2f3540, true); hero.position.set(0, 0, 0); scene.add(hero);
let heroHp = maxHeroHp(), heroDead = false, heroAttackCooldown = 0;

class SpawnEntity {
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly maxHp: number;
  readonly damage: number;
  readonly healthBar = document.createElement('div');
  readonly healthFill = document.createElement('span');
  hp: number;
  alive = true;
  provoked = false;
  attackCooldown = 0;

  constructor(readonly def: SpawnDefinition) {
    this.config = TIER_CONFIG[def.tier];
    this.maxHp = Math.max(1, Math.round(32 * this.config.statMultiplier)); this.hp = this.maxHp;
    this.damage = Math.max(1, Math.round(5 * this.config.statMultiplier)); this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.root.add(def.tier === 'crystal' ? makeCrystal(this.config.color) : makeHumanoid(this.config.color), makeTierRing(this.config.color)); scene.add(this.root);
    this.healthBar.className = 'world-hp-bar'; this.healthFill.style.backgroundColor = `#${this.config.color.toString(16).padStart(6, '0')}`;
    this.healthBar.append(this.healthFill); ui.world.append(this.healthBar);
    const state = save.spawns[def.id];
    if (state?.respawnAt && state.respawnAt > Date.now()) this.setAlive(false);
    else if (state?.respawnAt) { state.respawnAt = null; persist(); }
  }

  setAlive(value: boolean): void {
    this.alive = value; this.root.visible = value; this.healthBar.classList.toggle('hidden', !value);
    if (value) { this.hp = this.maxHp; this.healthFill.style.width = '100%'; this.provoked = false; this.attackCooldown = 0; this.root.position.copy(this.spawnPosition); }
  }
  forceRespawn(): void { this.setAlive(true); }
  distanceToHero(): number { return this.root.position.distanceTo(hero.position); }
  receiveDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount); this.healthFill.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (this.config.hostile) this.provoked = true;
    if (this.hp === 0) this.defeat();
  }
  defeat(): void {
    const state = save.spawns[this.def.id] ?? { killsToday: 0, respawnAt: null }; state.killsToday += 1;
    const timer = BASE_RESPAWN_MS * this.config.respawnMultiplier * 2 ** (state.killsToday - 1);
    state.respawnAt = Math.min(Date.now() + timer, nextLocalMidnightMs()); save.spawns[this.def.id] = state;
    const stat = Math.random() < .5 ? 'hp' : 'attack', amount = this.config.statReward;
    if (stat === 'hp') {
      const oldMax = maxHeroHp(); save.stats.maxHp.additive.kills = (save.stats.maxHp.additive.kills ?? 0) + amount;
      heroHp = Math.min(maxHeroHp(), heroHp + maxHeroHp() - oldMax);
    } else {
      const blunt = save.stats.attack[BARE_HANDS_DAMAGE_TYPE];
      blunt.additive.kills = (blunt.additive.kills ?? 0) + amount;
    }
    persist(); this.setAlive(false); renderStats(save.stats);
    showToast(`+${amount.toFixed(amount % 1 === 0 ? 0 : 2)} ${stat === 'hp' ? 'HP' : 'BLUNT'} · ${this.config.label}`);
  }
  update(dt: number): void {
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (state?.respawnAt && Date.now() >= state.respawnAt) { state.respawnAt = null; this.setAlive(true); persist(); }
      return;
    }
    if (!this.config.hostile || !this.provoked || heroDead) return;
    const toHero = hero.position.clone().sub(this.root.position), distance = toHero.length();
    const fromSpawn = this.root.position.distanceTo(this.spawnPosition), maxLeash = 7;
    if (distance > 1.35 && fromSpawn < maxLeash) {
      toHero.normalize(); this.root.position.addScaledVector(toHero, Math.min(4.8, 2.4 + this.config.statMultiplier * .18) * dt);
      this.root.rotation.y = Math.atan2(toHero.x, toHero.z);
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (distance <= 1.45 && this.attackCooldown === 0) { damageHero(this.damage); this.attackCooldown = 1.15; }
    if (fromSpawn >= maxLeash && distance > 3.5) this.provoked = false;
    if (!this.provoked) {
      const back = this.spawnPosition.clone().sub(this.root.position);
      if (back.length() > .08) this.root.position.addScaledVector(back.normalize(), 3 * dt); else this.root.position.copy(this.spawnPosition);
    }
  }
}

const entities = SPAWNS.map((spawn) => new SpawnEntity(spawn));

function resetAtMidnightIfNeeded(): void {
  const key = localDailyKey(); if (save.dailyKey === key) return;
  save.dailyKey = key; save.spawns = emptySpawnState(); entities.forEach((e) => e.forceRespawn()); persist(); showToast('Daily reset · all spawns restored');
}
function damageHero(amount: number): void {
  if (heroDead) return; heroHp = Math.max(0, heroHp - amount); updateHud();
  if (heroHp !== 0) return;
  heroDead = true; showToast('Defeated · returning to the start');
  setTimeout(() => { hero.position.set(0, 0, 0); heroHp = maxHeroHp(); heroDead = false; entities.forEach((e) => { e.provoked = false; }); updateHud(); }, 1200);
}
function nearestTarget(maxDistance = HERO_ATTACK_RANGE): SpawnEntity | null {
  let best: SpawnEntity | null = null, distance = maxDistance;
  for (const entity of entities) if (entity.alive) { const d = entity.distanceToHero(); if (d < distance) { best = entity; distance = d; } }
  return best;
}
function autoAttack(): void {
  if (heroDead || heroAttackCooldown > 0) return;
  const target = nearestTarget(); if (!target) return;
  heroAttackCooldown = HERO_ATTACK_COOLDOWN; target.receiveDamage(heroDamage(BARE_HANDS_DAMAGE_TYPE));
  const direction = target.root.position.clone().sub(hero.position); if (direction.lengthSq() > 0) hero.rotation.y = Math.atan2(direction.x, direction.z);
}

const keys = new Set<string>(); addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
const joystickVector = new THREE.Vector2(); let joystickPointer: number | null = null;
function resetJoystick(): void { joystickPointer = null; joystickVector.set(0, 0); ui.joystickKnob.style.transform = 'translate(-50%, -50%)'; }
ui.joystick.addEventListener('pointerdown', (e) => { joystickPointer = e.pointerId; ui.joystick.setPointerCapture(e.pointerId); });
ui.joystick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joystickPointer) return;
  const r = ui.joystick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const radius = r.width * .34, length = Math.hypot(dx, dy) || 1, clamp = Math.min(length, radius), nx = dx / length * clamp, ny = dy / length * clamp;
  joystickVector.set(nx / radius, ny / radius); ui.joystickKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
});
ui.joystick.addEventListener('pointerup', resetJoystick); ui.joystick.addEventListener('pointercancel', resetJoystick);

function setStatsPanel(open: boolean): void { ui.statsPanel.classList.toggle('visible', open); ui.statsPanel.setAttribute('aria-hidden', String(!open)); if (open) renderStats(save.stats); }
ui.statsButton.addEventListener('click', () => setStatsPanel(true)); ui.statsClose.addEventListener('click', () => setStatsPanel(false));
ui.statsPanel.addEventListener('pointerdown', (e) => { if (e.target === ui.statsPanel) setStatsPanel(false); });

function movementVector(): THREE.Vector2 {
  let x = joystickVector.x, y = -joystickVector.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--; if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y++; if (keys.has('KeyS') || keys.has('ArrowDown')) y--;
  const v = new THREE.Vector2(x, y); if (v.lengthSq() > 1) v.normalize(); return v;
}
function updateHero(dt: number): void {
  if (heroDead) return; const move = movementVector(); if (move.lengthSq() === 0) return;
  hero.position.x += move.x * HERO_SPEED * dt; hero.position.z -= move.y * HERO_SPEED * dt;
  hero.position.x = THREE.MathUtils.clamp(hero.position.x, -17.2, 17.2); hero.position.z = THREE.MathUtils.clamp(hero.position.z, -26.2, 26.2);
  hero.rotation.y = Math.atan2(move.x, -move.y);
}
function updateCamera(dt: number): void {
  camera.position.lerp(new THREE.Vector3(hero.position.x, 19, hero.position.z + 16.5), 1 - Math.exp(-5 * dt));
  camera.lookAt(hero.position.x, .9, hero.position.z - 2.5);
}
const projected = new THREE.Vector3();
function updateWorldBars(): void {
  const width = renderer.domElement.clientWidth, height = renderer.domElement.clientHeight;
  for (const entity of entities) {
    if (!entity.alive) continue; projected.copy(entity.root.position); projected.y += entity.def.tier === 'crystal' ? 2.05 : 3.05; projected.project(camera);
    const shown = projected.z >= -1 && projected.z <= 1 && projected.x >= -1.08 && projected.x <= 1.08 && projected.y >= -1.08 && projected.y <= 1.08;
    entity.healthBar.style.visibility = shown ? 'visible' : 'hidden'; if (!shown) continue;
    entity.healthBar.style.left = `${(projected.x * .5 + .5) * width}px`; entity.healthBar.style.top = `${(-projected.y * .5 + .5) * height}px`;
  }
}
function updateHud(): void {
  const maxHp = maxHeroHp(); ui.hpText.textContent = `${Math.round(heroHp)} / ${Math.round(maxHp)}`;
  ui.hpBar.style.width = `${heroHp / maxHp * 100}%`; ui.attackText.textContent = String(Math.round(heroDamage(BARE_HANDS_DAMAGE_TYPE))); updateWorldBars();
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { resetAtMidnightIfNeeded(); entities.forEach((e) => e.update(0)); } });

let previous = performance.now(), midnightAccumulator = 0;
function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, .05); previous = now; heroAttackCooldown = Math.max(0, heroAttackCooldown - dt); midnightAccumulator += dt;
  if (midnightAccumulator >= 1) { midnightAccumulator = 0; resetAtMidnightIfNeeded(); }
  updateHero(dt); autoAttack(); entities.forEach((e) => e.update(dt));
  if (!heroDead) heroHp = Math.min(maxHeroHp(), heroHp + heroRegen() * dt);
  updateCamera(dt); updateHud(); renderer.render(scene, camera); requestAnimationFrame(frame);
}

renderStats(save.stats); updateHud(); persist(); requestAnimationFrame(frame);

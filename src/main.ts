import * as THREE from 'three';
import './style.css';

type Tier = 'crystal' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
type StatReward = 'hp' | 'attack';

type SpawnDefinition = {
  id: string;
  tier: Tier;
  x: number;
  z: number;
  group?: string;
};

type SavedSpawnState = {
  killsToday: number;
  respawnAt: number | null;
};

type PlayerStats = {
  maxHp: number;
  attack: number;
  hpGained: number;
  attackGained: number;
};

type SaveData = {
  version: 2;
  dailyKey: string;
  stats: PlayerStats;
  spawns: Record<string, SavedSpawnState>;
};

type TierConfig = {
  label: string;
  statMultiplier: number;
  statReward: number;
  respawnMultiplier: number;
  color: number;
  hostile: boolean;
};

const TIER_CONFIG: Record<Tier, TierConfig> = {
  crystal: { label: 'Crystal', statMultiplier: 0.35, statReward: 0.5, respawnMultiplier: 1, color: 0x8dd9ff, hostile: false },
  common: { label: 'Common', statMultiplier: 1, statReward: 1, respawnMultiplier: 1, color: 0xb8bec8, hostile: true },
  uncommon: { label: 'Uncommon', statMultiplier: 2.25, statReward: 1.25, respawnMultiplier: 3, color: 0x64dc8c, hostile: true },
  rare: { label: 'Rare', statMultiplier: 4.5, statReward: 1.5, respawnMultiplier: 6, color: 0x5d98ff, hostile: true },
  epic: { label: 'Epic', statMultiplier: 8, statReward: 1.75, respawnMultiplier: 9, color: 0xbf75ff, hostile: true },
  legendary: { label: 'Legendary', statMultiplier: 14, statReward: 2, respawnMultiplier: 15, color: 0xffb33d, hostile: true }
};

const SPAWNS: SpawnDefinition[] = [
  { id: 'crystal-01', tier: 'crystal', x: -4, z: 7 },
  { id: 'crystal-02', tier: 'crystal', x: 4, z: 8 },
  { id: 'crystal-03', tier: 'crystal', x: -8, z: 2 },
  { id: 'crystal-04', tier: 'crystal', x: 8, z: 1 },
  { id: 'crystal-05', tier: 'crystal', x: -10, z: -6 },
  { id: 'crystal-06', tier: 'crystal', x: 10, z: -7 },

  { id: 'common-a1', tier: 'common', x: -8, z: 14, group: 'common-a' },
  { id: 'common-a2', tier: 'common', x: -6, z: 15, group: 'common-a' },
  { id: 'common-a3', tier: 'common', x: -4, z: 14, group: 'common-a' },
  { id: 'common-a4', tier: 'common', x: -7, z: 12, group: 'common-a' },
  { id: 'common-a5', tier: 'common', x: -5, z: 12, group: 'common-a' },
  { id: 'common-a6', tier: 'common', x: -3, z: 13, group: 'common-a' },

  { id: 'common-b1', tier: 'common', x: 5, z: -13, group: 'common-b' },
  { id: 'common-b2', tier: 'common', x: 7, z: -14, group: 'common-b' },
  { id: 'common-b3', tier: 'common', x: 9, z: -13, group: 'common-b' },
  { id: 'common-b4', tier: 'common', x: 4, z: -15, group: 'common-b' },
  { id: 'common-b5', tier: 'common', x: 6, z: -16, group: 'common-b' },
  { id: 'common-b6', tier: 'common', x: 8, z: -16, group: 'common-b' },
  { id: 'common-b7', tier: 'common', x: 10, z: -15, group: 'common-b' },
  { id: 'common-b8', tier: 'common', x: 11, z: -12, group: 'common-b' },

  { id: 'uncommon-a1', tier: 'uncommon', x: 9, z: 15, group: 'uncommon-a' },
  { id: 'uncommon-a2', tier: 'uncommon', x: 12, z: 14, group: 'uncommon-a' },
  { id: 'uncommon-b1', tier: 'uncommon', x: -12, z: -13, group: 'uncommon-b' },
  { id: 'uncommon-b2', tier: 'uncommon', x: -9, z: -15, group: 'uncommon-b' },

  { id: 'rare-01', tier: 'rare', x: -14, z: 19 },
  { id: 'rare-02', tier: 'rare', x: 14, z: 20 },
  { id: 'rare-03', tier: 'rare', x: 0, z: -21 },
  { id: 'epic-01', tier: 'epic', x: -14, z: -21 },
  { id: 'epic-02', tier: 'epic', x: 14, z: -20 },
  { id: 'legendary-01', tier: 'legendary', x: 0, z: 23 }
];

const BASE_RESPAWN_MS = 3 * 60 * 1000;
const SAVE_KEY = 'infuse-evergrowth-save-v2';
const BASE_HERO_MAX_HP = 120;
const BASE_HERO_ATTACK = 20;
const HERO_SPEED = 7.6;
const HERO_ATTACK_RANGE = 2.45;
const HERO_ATTACK_COOLDOWN = 0.5;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div id="game-shell">
    <div id="canvas-host"></div>
    <div class="hud">
      <div class="topbar">
        <div class="card hp-wrap">
          <div class="brand">Infuse: Evergrowth · v0.1</div>
          <div class="stats">
            <div style="flex:1">
              <div class="hp-label"><span>HP</span><span id="hp-text">120 / 120</span></div>
              <div class="bar"><span id="hp-bar"></span></div>
            </div>
            <div>ATK <span id="attack-stat">20</span></div>
          </div>
        </div>
        <div class="hud-actions">
          <button id="stats-button" class="card stats-button" type="button">STATS</button>
          <div class="card weapon-slots" aria-label="weapon slots">
            <div class="slot">HAND 1<br>EMPTY</div>
            <div class="slot">HAND 2<br>EMPTY</div>
            <div class="slot locked">ORBIT 1<br>LOCKED</div>
            <div class="slot locked">ORBIT 2<br>LOCKED</div>
          </div>
        </div>
      </div>
      <div class="reset-note">Daily spawn reset: local midnight</div>
      <div id="target-card" class="card target-card">
        <div class="target-label"><span id="target-name">Target</span><span id="target-hp-text"></span></div>
        <div class="bar"><span id="target-hp-bar"></span></div>
      </div>
      <div class="controls">
        <div id="joystick" class="joystick-zone"><div id="joystick-knob" class="joystick-knob"></div></div>
        <button id="attack" class="attack-button" type="button">ATTACK</button>
      </div>
      <div id="toast" class="toast"></div>
      <div id="stats-panel" class="stats-panel" aria-hidden="true">
        <div class="card stats-sheet">
          <div class="stats-sheet-header">
            <div><div class="brand">Permanent growth</div><h2>Hero stats</h2></div>
            <button id="stats-close" class="stats-close" type="button">CLOSE</button>
          </div>
          <div class="stat-row"><span>Max HP</span><strong id="stat-hp-value">120.00</strong></div>
          <div class="stat-subrow"><span>Base 120.00</span><span>+<span id="stat-hp-gained">0.00</span> gained</span></div>
          <div class="stat-row"><span>Attack</span><strong id="stat-attack-value">20.00</strong></div>
          <div class="stat-subrow"><span>Base 20.00</span><span>+<span id="stat-attack-gained">0.00</span> gained</span></div>
          <p class="stats-help">Stats keep decimal precision here. Combat HUD values are rounded to whole numbers.</p>
        </div>
      </div>
    </div>
  </div>
`;

const hpText = document.querySelector<HTMLSpanElement>('#hp-text')!;
const hpBar = document.querySelector<HTMLSpanElement>('#hp-bar')!;
const attackStatText = document.querySelector<HTMLSpanElement>('#attack-stat')!;
const targetCard = document.querySelector<HTMLDivElement>('#target-card')!;
const targetName = document.querySelector<HTMLSpanElement>('#target-name')!;
const targetHpText = document.querySelector<HTMLSpanElement>('#target-hp-text')!;
const targetHpBar = document.querySelector<HTMLSpanElement>('#target-hp-bar')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;
const joystick = document.querySelector<HTMLDivElement>('#joystick')!;
const joystickKnob = document.querySelector<HTMLDivElement>('#joystick-knob')!;
const attackButton = document.querySelector<HTMLButtonElement>('#attack')!;
const statsButton = document.querySelector<HTMLButtonElement>('#stats-button')!;
const statsPanel = document.querySelector<HTMLDivElement>('#stats-panel')!;
const statsClose = document.querySelector<HTMLButtonElement>('#stats-close')!;
const statHpValue = document.querySelector<HTMLElement>('#stat-hp-value')!;
const statAttackValue = document.querySelector<HTMLElement>('#stat-attack-value')!;
const statHpGained = document.querySelector<HTMLElement>('#stat-hp-gained')!;
const statAttackGained = document.querySelector<HTMLElement>('#stat-attack-gained')!;
const canvasHost = document.querySelector<HTMLDivElement>('#canvas-host')!;

function localDailyKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextLocalMidnightMs(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).getTime();
}

function emptySpawnState(): Record<string, SavedSpawnState> {
  return Object.fromEntries(SPAWNS.map((spawn) => [spawn.id, { killsToday: 0, respawnAt: null }])) as Record<string, SavedSpawnState>;
}

function freshStats(): PlayerStats {
  return { maxHp: BASE_HERO_MAX_HP, attack: BASE_HERO_ATTACK, hpGained: 0, attackGained: 0 };
}

function loadSave(): SaveData {
  const fresh: SaveData = { version: 2, dailyKey: localDailyKey(), stats: freshStats(), spawns: emptySpawnState() };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 2 || !parsed.stats) return fresh;
    return {
      version: 2,
      dailyKey: localDailyKey(),
      stats: { ...freshStats(), ...parsed.stats },
      spawns: parsed.dailyKey === localDailyKey() ? { ...emptySpawnState(), ...(parsed.spawns ?? {}) } : emptySpawnState()
    };
  } catch {
    return fresh;
  }
}

let save = loadSave();
let heroHp = save.stats.maxHp;
let heroDead = false;
let heroAttackCooldown = 0;
let toastTimer: number | null = null;

function persist(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function updateStatsPanel(): void {
  statHpValue.textContent = save.stats.maxHp.toFixed(2);
  statAttackValue.textContent = save.stats.attack.toFixed(2);
  statHpGained.textContent = save.stats.hpGained.toFixed(2);
  statAttackGained.textContent = save.stats.attackGained.toFixed(2);
}

function showToast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 1500);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b8cf);
scene.fog = new THREE.Fog(0x93b8cf, 28, 55);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 13, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x51613f, 2.2));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.8);
sun.position.set(-12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(38, 56),
  new THREE.MeshStandardMaterial({ color: 0x668d52, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const path = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 50),
  new THREE.MeshStandardMaterial({ color: 0x9c906c, roughness: 1 })
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.012;
path.receiveShadow = true;
scene.add(path);

function addRock(x: number, z: number, scale: number): void {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x68706e, roughness: 1 })
  );
  rock.position.set(x, scale * 0.55, z);
  rock.scale.y = 0.72;
  rock.rotation.set(x * 0.17, z * 0.11, x * z * 0.01);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}

[
  [-16, 5, 1.2], [-15, -3, 0.8], [16, 7, 1], [15, -4, 1.3],
  [-13, 10, 0.65], [13, 10, 0.7], [-16, -17, 0.85], [16, -16, 0.9],
  [-10, 23, 0.8], [10, 24, 1], [-5, -24, 0.8], [5, -25, 1.1]
].forEach(([x, z, scale]) => addRock(x, z, scale));

function makeHumanoid(primary: number, hero = false): THREE.Group {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: hero ? 0xf0bd96 : 0xd8ae89, roughness: 0.82 });
  const cloth = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.78 });
  const hair = new THREE.MeshStandardMaterial({ color: hero ? 0x1c2330 : 0x3a2c27, roughness: 0.9 });
  const underwear = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.88 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(hero ? 0.72 : 0.7, 1, 0.38), hero ? skin : cloth);
  torso.position.y = 1.65;
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.4), hero ? underwear : cloth);
  pelvis.position.y = 1.04;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), skin);
  head.position.y = 2.42;
  head.scale.y = 1.08;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  hairCap.position.set(0, 2.52, 0);
  root.add(torso, pelvis, head, hairCap);

  const armGeometry = new THREE.CylinderGeometry(0.11, 0.095, 0.9, 8);
  const legGeometry = new THREE.CylinderGeometry(0.13, 0.115, 0.92, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, skin);
    arm.position.set(side * 0.48, 1.6, 0);
    arm.rotation.z = side * 0.08;
    root.add(arm);

    const leg = new THREE.Mesh(legGeometry, skin);
    leg.position.set(side * 0.2, 0.5, 0);
    root.add(leg);
  }

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return root;
}

function makeCrystal(color: number): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.15 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), material);
  core.scale.y = 1.55;
  core.position.y = 0.9;
  core.castShadow = true;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.62, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: 0x53616a, roughness: 1 })
  );
  base.position.y = 0.14;
  base.castShadow = true;
  root.add(core, base);
  return root;
}

function makeTierRing(color: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.9, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  return ring;
}

const hero = makeHumanoid(0x2f3540, true);
hero.position.set(0, 0, 0);
scene.add(hero);

class SpawnEntity {
  readonly def: SpawnDefinition;
  readonly config: TierConfig;
  readonly root = new THREE.Group();
  readonly spawnPosition: THREE.Vector3;
  readonly maxHp: number;
  readonly damage: number;
  hp: number;
  alive = true;
  provoked = false;
  attackCooldown = 0;

  constructor(def: SpawnDefinition) {
    this.def = def;
    this.config = TIER_CONFIG[def.tier];
    this.maxHp = Math.max(1, Math.round(32 * this.config.statMultiplier));
    this.hp = this.maxHp;
    this.damage = Math.max(1, Math.round(5 * this.config.statMultiplier));
    this.spawnPosition = new THREE.Vector3(def.x, 0, def.z);
    this.root.position.copy(this.spawnPosition);
    this.root.add(def.tier === 'crystal' ? makeCrystal(this.config.color) : makeHumanoid(this.config.color));
    this.root.add(makeTierRing(this.config.color));
    scene.add(this.root);

    const state = save.spawns[def.id];
    if (state?.respawnAt && state.respawnAt > Date.now()) this.setAlive(false);
    else if (state?.respawnAt) state.respawnAt = null;
  }

  setAlive(value: boolean): void {
    this.alive = value;
    this.root.visible = value;
    if (value) {
      this.hp = this.maxHp;
      this.provoked = false;
      this.attackCooldown = 0;
      this.root.position.copy(this.spawnPosition);
    }
  }

  forceRespawn(): void {
    this.setAlive(true);
  }

  distanceToHero(): number {
    return this.root.position.distanceTo(hero.position);
  }

  receiveDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.config.hostile) this.provoked = true;
    if (this.hp === 0) this.defeat();
  }

  defeat(): void {
    const state = save.spawns[this.def.id] ?? { killsToday: 0, respawnAt: null };
    state.killsToday += 1;
    const timerMs = BASE_RESPAWN_MS * this.config.respawnMultiplier * 2 ** (state.killsToday - 1);
    state.respawnAt = Math.min(Date.now() + timerMs, nextLocalMidnightMs());
    save.spawns[this.def.id] = state;

    const reward: StatReward = Math.random() < 0.5 ? 'hp' : 'attack';
    const amount = this.config.statReward;
    if (reward === 'hp') {
      save.stats.maxHp += amount;
      save.stats.hpGained += amount;
      heroHp = Math.min(save.stats.maxHp, heroHp + amount);
    } else {
      save.stats.attack += amount;
      save.stats.attackGained += amount;
    }

    persist();
    this.setAlive(false);
    updateStatsPanel();
    const displayedAmount = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
    showToast(`+${displayedAmount} ${reward === 'hp' ? 'HP' : 'ATK'} · ${this.config.label}`);
  }

  update(dt: number): void {
    if (!this.alive) {
      const state = save.spawns[this.def.id];
      if (state?.respawnAt && Date.now() >= state.respawnAt) {
        state.respawnAt = null;
        this.setAlive(true);
        persist();
      }
      return;
    }

    if (!this.config.hostile || !this.provoked || heroDead) return;
    const toHero = hero.position.clone().sub(this.root.position);
    const distance = toHero.length();
    const fromSpawn = this.root.position.distanceTo(this.spawnPosition);
    const maxLeash = 7;

    if (distance > 1.35 && fromSpawn < maxLeash) {
      toHero.normalize();
      const speed = Math.min(4.8, 2.4 + this.config.statMultiplier * 0.18);
      this.root.position.addScaledVector(toHero, speed * dt);
      this.root.rotation.y = Math.atan2(toHero.x, toHero.z);
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (distance <= 1.45 && this.attackCooldown === 0) {
      damageHero(this.damage);
      this.attackCooldown = 1.15;
    }

    if (fromSpawn >= maxLeash && distance > 3.5) this.provoked = false;
    if (!this.provoked) {
      const back = this.spawnPosition.clone().sub(this.root.position);
      if (back.length() > 0.08) this.root.position.addScaledVector(back.normalize(), 3 * dt);
      else this.root.position.copy(this.spawnPosition);
    }
  }
}

const entities = SPAWNS.map((spawn) => new SpawnEntity(spawn));
persist();

function resetAtMidnightIfNeeded(): void {
  const key = localDailyKey();
  if (save.dailyKey === key) return;
  save.dailyKey = key;
  save.spawns = emptySpawnState();
  for (const entity of entities) entity.forceRespawn();
  persist();
  showToast('Daily reset · all spawns restored');
}

function damageHero(amount: number): void {
  if (heroDead) return;
  heroHp = Math.max(0, heroHp - amount);
  updateHud();
  if (heroHp !== 0) return;
  heroDead = true;
  showToast('Defeated · returning to the start');
  window.setTimeout(() => {
    hero.position.set(0, 0, 0);
    heroHp = save.stats.maxHp;
    heroDead = false;
    for (const entity of entities) entity.provoked = false;
    updateHud();
  }, 1200);
}

function nearestTarget(maxDistance = HERO_ATTACK_RANGE): SpawnEntity | null {
  let best: SpawnEntity | null = null;
  let bestDistance = maxDistance;
  for (const entity of entities) {
    if (!entity.alive) continue;
    const distance = entity.distanceToHero();
    if (distance < bestDistance) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

function attack(): void {
  if (heroDead || heroAttackCooldown > 0) return;
  const target = nearestTarget();
  if (!target) {
    showToast('Move closer to a target');
    heroAttackCooldown = 0.2;
    return;
  }

  heroAttackCooldown = HERO_ATTACK_COOLDOWN;
  target.receiveDamage(save.stats.attack);
  const direction = target.root.position.clone().sub(hero.position);
  hero.rotation.y = Math.atan2(direction.x, direction.z);
  if (direction.lengthSq() > 0) hero.position.addScaledVector(direction.normalize(), 0.08);
}

const keys = new Set<string>();
window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space') {
    event.preventDefault();
    attack();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));

const joystickVector = new THREE.Vector2();
let joystickPointer: number | null = null;

function resetJoystick(): void {
  joystickPointer = null;
  joystickVector.set(0, 0);
  joystickKnob.style.transform = 'translate(-50%, -50%)';
}

joystick.addEventListener('pointerdown', (event) => {
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
});

joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return;
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const radius = rect.width * 0.34;
  const length = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(length, radius);
  const nx = (dx / length) * clamped;
  const ny = (dy / length) * clamped;
  joystickVector.set(nx / radius, ny / radius);
  joystickKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
});
joystick.addEventListener('pointerup', resetJoystick);
joystick.addEventListener('pointercancel', resetJoystick);

attackButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  attack();
});

function setStatsPanel(open: boolean): void {
  statsPanel.classList.toggle('visible', open);
  statsPanel.setAttribute('aria-hidden', String(!open));
  if (open) updateStatsPanel();
}

statsButton.addEventListener('click', () => setStatsPanel(true));
statsClose.addEventListener('click', () => setStatsPanel(false));
statsPanel.addEventListener('pointerdown', (event) => {
  if (event.target === statsPanel) setStatsPanel(false);
});

function movementVector(): THREE.Vector2 {
  let x = joystickVector.x;
  let y = -joystickVector.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  const vector = new THREE.Vector2(x, y);
  if (vector.lengthSq() > 1) vector.normalize();
  return vector;
}

function updateHero(dt: number): void {
  if (heroDead) return;
  const move = movementVector();
  if (move.lengthSq() === 0) return;
  hero.position.x += move.x * HERO_SPEED * dt;
  hero.position.z -= move.y * HERO_SPEED * dt;
  hero.position.x = THREE.MathUtils.clamp(hero.position.x, -17.2, 17.2);
  hero.position.z = THREE.MathUtils.clamp(hero.position.z, -26.2, 26.2);
  hero.rotation.y = Math.atan2(move.x, -move.y);
}

function updateCamera(dt: number): void {
  const desired = new THREE.Vector3(hero.position.x, 12.5, hero.position.z + 10.5);
  camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
  camera.lookAt(hero.position.x, 1.15, hero.position.z - 1.8);
}

function updateHud(): void {
  hpText.textContent = `${Math.round(heroHp)} / ${Math.round(save.stats.maxHp)}`;
  hpBar.style.width = `${(heroHp / save.stats.maxHp) * 100}%`;
  attackStatText.textContent = String(Math.round(save.stats.attack));

  const target = nearestTarget(4.5);
  if (!target) {
    targetCard.classList.remove('visible');
    return;
  }

  targetCard.classList.add('visible');
  const suffix = target.def.group ? ` · ${target.def.group}` : '';
  targetName.textContent = `${target.config.label}${suffix}`;
  targetName.style.color = `#${target.config.color.toString(16).padStart(6, '0')}`;
  targetHpText.textContent = `${Math.round(target.hp)} / ${Math.round(target.maxHp)}`;
  targetHpBar.style.width = `${(target.hp / target.maxHp) * 100}%`;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  resetAtMidnightIfNeeded();
  for (const entity of entities) entity.update(0);
});

let previous = performance.now();
let midnightCheckAccumulator = 0;

function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  heroAttackCooldown = Math.max(0, heroAttackCooldown - dt);
  midnightCheckAccumulator += dt;

  if (midnightCheckAccumulator >= 1) {
    midnightCheckAccumulator = 0;
    resetAtMidnightIfNeeded();
  }

  updateHero(dt);
  for (const entity of entities) entity.update(dt);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

updateStatsPanel();
updateHud();
requestAnimationFrame(frame);

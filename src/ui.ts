import './reward-popups.css';
import { combatAffinityIcon, damageTypeDefenseIcon, damageTypeIcon, evasionIcon, heartIcon, heartRegenIcon } from './icons';
import { EQUIPMENT_BY_ID } from './domain/items/EquipmentCatalog';
import { equipmentIcon } from './equipment-icons';
import type { AreaDefinition, DamageType, EquipmentSlotId, LootType, SoulType } from './types';
import type { EquipmentSnapshot, ProgressionSnapshot, SoulNodeSnapshot, StatSnapshot } from './systems/ProgressionSnapshot';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div id="game-shell">
  <div id="loading-screen" class="loading-screen" role="status" aria-live="polite">
    <div class="loading-mark" aria-hidden="true"><span></span></div>
    <div class="loading-title">Infuse: Evergrowth</div>
    <div id="loading-subtitle" class="loading-subtitle">Preparing the realm</div>
    <div id="loading-version" class="loading-version"></div>
    <div class="loading-track"><span id="loading-progress"></span></div>
    <div id="loading-percent" class="loading-percent">0%</div>
  </div>
  <div id="canvas-host"></div>
  <div class="hud boot-hidden">
    <div class="version-tag">0.31</div>
    <div class="topbar">
      <div class="card hp-wrap">
        <div class="brand">Infuse: Evergrowth</div>
        <div class="stats">
          <div style="flex:1">
            <div class="hp-label"><span>HP</span><span id="hp-text">20 / 20</span></div>
            <div class="bar"><span id="hp-bar"></span></div>
          </div>
          <div class="hand-hud"><span id="hand1-stat"></span><span id="orbit1-stat"></span><span id="orbit2-stat"></span><span id="orbit3-stat"></span></div>
        </div>
        <div id="enemy-affinities" class="enemy-affinities"></div>
      </div>
      <div class="debug-actions">
        <button id="stats-button" class="card stats-button" type="button">STATS</button>
        <button id="spawn-button" class="card stats-button" type="button" title="Reset active respawn cooldowns">SPAWN</button>
        ${import.meta.env.DEV ? '<button id="debug-unlock-minions" class="card stats-button" type="button">UNLOCK IMP</button>' : ''}
      </div>
    </div>
    <div class="edge-actions">
      <button id="soul-catcher-button" class="edge-button soul-catcher-button" type="button"><span class="edge-icon soul-catcher-icon"></span><small>SOUL<br>CATCHER</small></button>
      <button id="inventory-button" class="edge-button" type="button"><span class="edge-icon bag-icon"></span><small>BAG</small></button>
    </div>
    <button id="settings-button" class="settings-button card" type="button" aria-label="Settings" title="Settings">&#9881;</button>
    <div class="camera-distance-control card">
      <input id="camera-distance" type="range" min="10" max="35" step="0.1" aria-label="Camera distance">
      <div class="camera-distance-readout"><span>DIST</span><output id="camera-distance-value" for="camera-distance"></output></div>
    </div>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
    <button id="minion-pit-button" class="minion-pit-button card" type="button" hidden disabled>Manage minions</button>
    <div class="controls"><div id="joystick" class="joystick-zone"><div id="joystick-knob" class="joystick-knob"></div></div></div>
    <div class="bottom-dock card">
      <div class="quick-slots" aria-label="equipped weapon slots">
        <div class="quick-slot" data-slot="hand1"><span>H1</span></div>
        <div class="quick-slot" data-slot="orbit1"><span>O1</span></div>
        <div class="quick-slot" data-slot="orbit2"><span>O2</span></div>
        <div class="quick-slot" data-slot="orbit3"><span>O3</span></div>
      </div>
    </div>
    <div id="gain-stack" class="gain-stack" aria-live="polite"></div>
    <div id="soul-gain-stack" class="soul-gain-stack" aria-live="polite"></div>
    <div id="equipment-drop-layer" class="equipment-drop-layer" aria-live="polite"></div>
    <div id="progression-layer" class="progression-layer" aria-live="assertive"></div>
    <div id="toast" class="toast"></div>
    <div id="stats-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet stats-sheet">
        <div class="modal-header">
          <div><div class="brand">Permanent growth</div><h2>Hero stats</h2></div>
          <button id="stats-close" class="modal-close" type="button">CLOSE</button>
        </div>
        <div id="stats-content"></div>
        <p class="stats-help">Speed, critical, block, and evasion stats keep decimal precision. Other values are rounded to whole numbers.</p>
      </div>
    </div>
    <div id="inventory-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet inventory-sheet">
        <div class="modal-header">
          <div><div class="brand">Equipment</div><h2>Inventory</h2></div>
          <button id="inventory-close" class="modal-close" type="button">CLOSE</button>
        </div>
        <div id="inventory-overview" class="inventory-overview">
          <div id="inventory-summary" class="inventory-summary"></div>
          <div class="inventory-section-title">Equipped</div>
          <div id="inventory-equipped" class="inventory-equipped"></div>
          <div class="inventory-section-title">Bag</div>
          <div id="inventory-bag" class="inventory-bag"></div>
        </div>
        <div id="inventory-detail" class="inventory-detail" hidden></div>
      </div>
    </div>
    <div id="soul-catcher-panel" class="modal-panel soul-catcher-panel" aria-hidden="true">
      <div class="card modal-sheet soul-sheet">
        <div class="modal-header"><div><div class="brand">Infuse the defeated</div><h2>Soul Catcher</h2></div><button id="soul-catcher-close" class="modal-close" type="button">CLOSE</button></div>
        <div id="soul-balances" class="soul-balances"></div>
        <div id="soul-xp" class="soul-xp"></div>
        <div id="soul-tree-viewport" class="soul-tree-viewport"><div id="soul-tree" class="soul-tree"><svg id="soul-connections" viewBox="0 0 720 720" aria-hidden="true"></svg><div id="soul-nodes"></div></div></div>
        <div id="soul-detail" class="soul-detail"><p>Select a revealed node to inspect it.</p></div>
        <div id="soul-layer-tabs" class="soul-layer-tabs" aria-label="Soul Catcher layers"></div>
      </div>
    </div>
    <div id="minion-panel" class="modal-panel minion-panel" aria-hidden="true">
      <div class="card modal-sheet minion-sheet">
        <div class="modal-header"><div><div class="brand">Summoning Pit</div><h2>Minions</h2></div><button id="minion-close" class="modal-close" type="button">CLOSE</button></div>
        <div id="minion-cards" class="minion-cards"></div>
      </div>
    </div>
    <div id="settings-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet settings-sheet">
        <div class="modal-header">
          <div><div class="brand">Preferences</div><h2>Settings</h2></div>
          <button id="settings-close" class="modal-close" type="button">CLOSE</button>
        </div>
        <fieldset class="settings-group">
          <legend>Rendering resolution</legend>
          <label><input type="radio" name="render-scale" value="1"> <span><strong>Full</strong><small>Sharpest image</small></span></label>
          <label><input type="radio" name="render-scale" value="0.7"> <span><strong>Reduced</strong><small>Lower GPU load</small></span></label>
        </fieldset>
        <fieldset class="settings-group">
          <legend>Frame rate</legend>
          <label><input type="radio" name="frame-rate" value="60"> <span><strong>Smooth</strong><small>Up to 60 FPS</small></span></label>
          <label><input type="radio" name="frame-rate" value="30"> <span><strong>Battery saver</strong><small>Target 30 FPS</small></span></label>
        </fieldset>
        <label id="renderer-stats-option" class="settings-stats"><input id="renderer-stats-toggle" type="checkbox"> Show renderer statistics</label>
        ${import.meta.env.DEV ? '<label class="settings-stats"><input id="minion-anti-idle-toggle" type="checkbox"> Pause minions after 5 minutes without input (debug)</label>' : ''}
        <p class="settings-help">Changes apply immediately and are kept on this device.</p>
        <div class="settings-danger">
          <div><strong>Reset attributes</strong><small>Remove all permanent stat gains. Equipment and its progress are kept.</small></div>
          <button id="reset-attributes-button" type="button">RESET ATTRIBUTES</button>
          <div><strong>Reset hero</strong><small>Remove all permanent stat gains and equipment drops. World progression is kept.</small></div>
          <button id="reset-hero-button" type="button">RESET HERO</button>
          <div><strong>Reset Soul Catcher</strong><small>Remove Souls and purchased nodes. World progression is kept.</small></div>
          <button id="reset-soul-catcher-button" type="button">RESET SOUL CATCHER</button>
        </div>
      </div>
    </div>
    <dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-message">
      <p id="confirm-message"></p>
      <form method="dialog"><button value="cancel" autofocus>Cancel</button><button id="confirm-action" value="confirm">Reset</button></form>
    </dialog>
    <output id="renderer-stats" class="renderer-stats" aria-live="off"></output>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  confirmDialog: q<HTMLDialogElement>('#confirm-dialog'), confirmMessage: q<HTMLParagraphElement>('#confirm-message'),
  confirmAction: q<HTMLButtonElement>('#confirm-action'),
  loadingScreen: q<HTMLDivElement>('#loading-screen'), loadingSubtitle: q<HTMLDivElement>('#loading-subtitle'), loadingVersion: q<HTMLDivElement>('#loading-version'), loadingProgress: q<HTMLSpanElement>('#loading-progress'), loadingPercent: q<HTMLDivElement>('#loading-percent'),
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), hand1Stat: q<HTMLSpanElement>('#hand1-stat'), orbit1Stat: q<HTMLSpanElement>('#orbit1-stat'), orbit2Stat: q<HTMLSpanElement>('#orbit2-stat'), orbit3Stat: q<HTMLSpanElement>('#orbit3-stat'),
  enemyAffinities: q<HTMLDivElement>('#enemy-affinities'),
  world: q<HTMLDivElement>('#world-ui'), minionPitButton: q<HTMLButtonElement>('#minion-pit-button'), toast: q<HTMLDivElement>('#toast'), gainStack: q<HTMLDivElement>('#gain-stack'), soulGainStack: q<HTMLDivElement>('#soul-gain-stack'),
  joystick: q<HTMLDivElement>('#joystick'), joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  spawnButton: q<HTMLButtonElement>('#spawn-button'),
  debugUnlockMinions: document.querySelector<HTMLButtonElement>('#debug-unlock-minions'),
  cameraDistance: q<HTMLInputElement>('#camera-distance'), cameraDistanceValue: q<HTMLOutputElement>('#camera-distance-value'),
  settingsButton: q<HTMLButtonElement>('#settings-button'), settingsPanel: q<HTMLDivElement>('#settings-panel'),
  renderScaleInputs: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="render-scale"]')),
  frameRateInputs: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="frame-rate"]')),
  inventoryScroller: q<HTMLElement>('.inventory-sheet'),
  inventorySlotPicker: (): HTMLElement | null => document.querySelector<HTMLElement>('[data-slot-picker]'),
  settingsClose: q<HTMLButtonElement>('#settings-close'), rendererStatsOption: q<HTMLLabelElement>('#renderer-stats-option'),
  rendererStatsToggle: q<HTMLInputElement>('#renderer-stats-toggle'), rendererStats: q<HTMLOutputElement>('#renderer-stats'),
  minionAntiIdleToggle: document.querySelector<HTMLInputElement>('#minion-anti-idle-toggle'),
  resetAttributesButton: q<HTMLButtonElement>('#reset-attributes-button'),
  resetHeroButton: q<HTMLButtonElement>('#reset-hero-button'),
  resetSoulCatcherButton: q<HTMLButtonElement>('#reset-soul-catcher-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host'),
  inventoryButton: q<HTMLButtonElement>('#inventory-button'), inventoryPanel: q<HTMLDivElement>('#inventory-panel'),
  soulCatcherButton: q<HTMLButtonElement>('#soul-catcher-button'), soulCatcherPanel: q<HTMLDivElement>('#soul-catcher-panel'), soulCatcherClose: q<HTMLButtonElement>('#soul-catcher-close'),
  minionPanel: q<HTMLDivElement>('#minion-panel'), minionClose: q<HTMLButtonElement>('#minion-close'), minionCards: q<HTMLDivElement>('#minion-cards'),
  soulBalances: q<HTMLDivElement>('#soul-balances'), soulXp: q<HTMLDivElement>('#soul-xp'), soulLayerTabs: q<HTMLDivElement>('#soul-layer-tabs'), soulTreeViewport: q<HTMLDivElement>('#soul-tree-viewport'), soulTree: q<HTMLDivElement>('#soul-tree'), soulConnections: q<SVGElement>('#soul-connections'), soulNodes: q<HTMLDivElement>('#soul-nodes'), soulDetail: q<HTMLDivElement>('#soul-detail'),
  inventoryClose: q<HTMLButtonElement>('#inventory-close'), inventoryOverview: q<HTMLDivElement>('#inventory-overview'),
  inventorySummary: q<HTMLDivElement>('#inventory-summary'), inventoryEquipped: q<HTMLDivElement>('#inventory-equipped'),
  inventoryBag: q<HTMLDivElement>('#inventory-bag'), inventoryDetail: q<HTMLDivElement>('#inventory-detail'), equipmentDropLayer: q<HTMLDivElement>('#equipment-drop-layer'),
  progressionLayer: q<HTMLDivElement>('#progression-layer'), quickSlots: Array.from(document.querySelectorAll<HTMLDivElement>('.quick-slot'))
};

/** A DOM dialog leaves the render loop and simulation running during confirmation. */
export function confirmReset(message: string, actionLabel = 'Reset'): Promise<boolean> {
  if (ui.confirmDialog.open) return Promise.resolve(false);
  ui.confirmMessage.textContent = message;
  ui.confirmAction.textContent = actionLabel;
  ui.confirmDialog.returnValue = '';
  ui.confirmDialog.showModal();
  return new Promise((resolve) => ui.confirmDialog.addEventListener('close', () => resolve(ui.confirmDialog.returnValue === 'confirm'), { once: true }));
}

export function setLoadingProgress(progress: number): void {
  const percent = Math.round(progress * 100);
  ui.loadingProgress.style.width = `${percent}%`;
  ui.loadingPercent.textContent = `${percent}%`;
}

export function finishLoading(): void {
  document.querySelector('.hud')?.classList.remove('boot-hidden');
  ui.loadingScreen.classList.add('finished');
  window.setTimeout(() => ui.loadingScreen.remove(), 450);
}

export function renderEnemyAffinities(area: AreaDefinition): void {
  const weapon = combatAffinityIcon(area.enemyWeapon, 11);
  const weakness = combatAffinityIcon(area.enemyWeakness, 11);
  ui.enemyAffinities.innerHTML = `<span>Enemy attack ${weapon}</span><span>Weakness to ${weakness}</span>`;
  ui.enemyAffinities.setAttribute('aria-label', `Enemy attack ${area.enemyWeapon}; weakness to ${area.enemyWeakness}`);
}

const gainItems: HTMLDivElement[] = [];
function layoutGainItems(): void { gainItems.forEach((element, index) => { element.style.transform = `translateY(${-index * 27}px)`; }); }
function showGain(amount: string, stat: string): void {
  const element = document.createElement('div');
  const healthStat = stat === 'HP' || stat === 'HP/S';
  const evasionStat = stat === 'EVASION';
  const gainIcon = stat === 'HP/S' ? heartRegenIcon(13) : stat === 'HP' ? heartIcon(13) : evasionStat ? evasionIcon(13)
    : stat === 'SPEED' ? '<span aria-label="Speed">SPD</span>' : damageTypeIcon(stat === 'SLASH' ? 'slash' : stat === 'PIERCING' ? 'piercing' : 'blunt', 13);
  element.className = `gain-pop ${healthStat ? 'hp' : stat.toLowerCase()}`;
  element.innerHTML = `<strong>+${amount}</strong>${gainIcon}`;
  element.style.opacity = '0'; element.style.transform = 'translateY(8px)'; ui.gainStack.append(element); gainItems.unshift(element);
  requestAnimationFrame(() => { layoutGainItems(); element.style.opacity = '1'; });
  window.setTimeout(() => { const index = gainItems.indexOf(element); if (index >= 0) gainItems.splice(index, 1); element.classList.add('leaving'); layoutGainItems(); window.setTimeout(() => element.remove(), 180); }, 1600);
}

export function showStatGain(amount: number, stat: string): void {
  showGain(Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''), stat);
}

let toastTimer: number | null = null;
export function showToast(message: string): void {
  const gain = message.match(/^\+([0-9]+(?:\.[0-9]+)?) (HP|BLUNT)\b/);
  if (gain) { showGain(gain[1], gain[2] as 'HP' | 'BLUNT'); return; }
  ui.toast.textContent = message; ui.toast.classList.add('visible');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 1500);
}

function sourceLabel(source: string): string { return source.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()); }
function renderBreakdown(label: string, stat: StatSnapshot, suffix = '', decimals = false, scale = 1, minionSource = false): string {
  const additiveTotal = stat.additiveTotal, total = stat.total;
  const format = (value: number): string => decimals || minionSource ? (value * scale).toLocaleString(undefined, { maximumFractionDigits: 6 }) : Math.round(value * scale).toLocaleString();
  const adds = Object.entries(stat.additive).filter(([source, value]) => value !== 0 || (source === 'minions' && minionSource)).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>${format(v)}${suffix}</span></div>`).join('');
  const mults = Object.entries(stat.multiplicative).filter(([, value]) => value !== 1).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>x${v.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>`).join('');
  const base = stat.base !== 0 ? `<div class="stat-group-title">Base</div><div class="stat-line"><span>Base</span><span>${format(stat.base)}${suffix}</span></div>` : '';
  return `<section class="stat-breakdown"><div class="stat-row"><span>${label}</span><strong>${format(total)}${suffix}</strong></div>${base}${adds ? `<div class="stat-group-title">Additive</div>${adds}` : ''}<div class="stat-line stat-subtotal"><span>Total</span><span>${format(additiveTotal)}${suffix}</span></div>${mults ? `<div class="stat-group-title">Multiplicative</div>${mults}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${format(total)}${suffix}</strong></div></section>`;
}

export function renderStats(snapshot: ProgressionSnapshot): void {
  const { stats } = snapshot;
  const maxHpLabel = `<span class="stat-title-with-icon">${heartIcon(14)} Max HP</span>`;
  const regenLabel = `<span class="stat-title-with-icon">${heartRegenIcon(14)} Health regeneration</span>`;
  const evasionRawChance = stats.evasion.rawChance;
  const evasionTotal = stats.evasion.total;
  const percent = (chance: number): string => `${(chance * 100).toFixed(2)}%`;
  const rawSources = Object.entries(stats.evasion.raw).filter(([source, value]) => value !== 0 || source === 'minions').map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>${value.toFixed(2)}</span></div>`).join('');
  const directSources = Object.entries(stats.evasion.directChance).filter(([, value]) => value !== 0).map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>+${percent(value)}</span></div>`).join('');
  const evasion = `<section class="stat-breakdown"><div class="stat-row"><span class="stat-title-with-icon">${evasionIcon(14)} Evasion</span><strong>${percent(evasionTotal)}</strong></div>${rawSources ? `<div class="stat-group-title">Raw Evasion</div>${rawSources}` : ''}<div class="stat-line stat-subtotal"><span>Raw total</span><span>${percent(evasionRawChance)}</span></div>${directSources ? `<div class="stat-group-title">Direct Evasion</div>${directSources}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${percent(evasionTotal)}</strong></div></section>`;
  const scaled = (label: string, stat: StatSnapshot, effective: number, suffix: string): string => `${renderBreakdown(`${label} (raw)`, stat, '', true)}<div class="stat-line stat-total"><span>Effective ${label.toLowerCase()}</span><strong>${effective.toFixed(2)}${suffix}</strong></div>`;
  const effectiveSpeedMultiplier = stats.speed.multiplier;
  const speed = `${renderBreakdown('Speed (raw)', stats.speed, '', true, 1, true)}<div class="stat-line stat-subtotal"><span>Speed multiplier</span><strong>x${effectiveSpeedMultiplier.toFixed(2)}</strong></div><div class="stat-line stat-total"><span>Effective speed</span><strong>${stats.speed.metersPerSecond.toFixed(2)} m/s</strong></div>`;
  const attacks = (['blunt', 'slash', 'piercing'] as const).map((type) => {
    const profiles = stats.attacks.filter((profile) => profile.damageType === type);
    const label = `${sourceLabel(type)} attack`;
    if (!profiles.length) return renderBreakdown(`${label} · no weapon equipped`, stats.attack[type], '', true, 1, true);
    return profiles.map(({ slot, sources }) => renderBreakdown(`${SLOT_LABELS[slot]} · ${label}`, sources, '', true, 1, true)).join('');
  }).join('');
  const souls = snapshot.soulCatcher.yields.filter(({ total }) => total > 0).map(({ type, base, additional: additions }) => `<div class="stat-line"><span>${sourceLabel(type)}</span><strong>${base} base + ${additions} Soul Catcher</strong></div>`).join('');
  ui.statsContent.innerHTML = [renderBreakdown(maxHpLabel, stats.maxHp, '', false, 1, true), attacks, renderBreakdown('Blunt defence', stats.defense.blunt, '', true), renderBreakdown('Slash defence', stats.defense.slash, '', true), renderBreakdown('Piercing defence', stats.defense.piercing, '', true), renderBreakdown('Blunt resistance', stats.damageResistance.blunt, '%', false, 100), renderBreakdown('Slash resistance', stats.damageResistance.slash, '%', false, 100), renderBreakdown('Piercing resistance', stats.damageResistance.piercing, '%', false, 100), renderBreakdown(regenLabel, stats.regen, ' HP/s', false, 1, true), speed, scaled('Critical hit chance', stats.criticalChance, stats.criticalChance.percent, '%'), scaled('Critical damage', stats.criticalDamage, stats.criticalDamage.bonusPercent, '%'), scaled('Block chance', stats.blockChance, stats.blockChance.percent, '%'), evasion, `<section class="stat-breakdown"><div class="stat-row"><span>Soul Drops</span></div>${souls}</section>`].join('');
}

const soulIcon = (type: SoulType): string => `<span class="soul-icon soul-${type}" aria-hidden="true"></span>`;

const minionNumber = (value: number): string => value.toLocaleString(undefined, { maximumFractionDigits: 3 });
const minionStatIcons: Record<LootType, string> = {
  hp: heartIcon(17), regen: heartRegenIcon(17), speed: '<span aria-hidden="true">SPD</span>', evasion: evasionIcon(17),
  blunt: damageTypeIcon('blunt', 17), slash: damageTypeIcon('slash', 17), piercing: damageTypeIcon('piercing', 17)
};
const minionStatLabels: Record<LootType, string> = {
  hp: 'Max HP', regen: 'Health regeneration', speed: 'Movement speed', evasion: 'Evasion',
  blunt: 'Blunt attack', slash: 'Slash attack', piercing: 'Piercing attack'
};
const minionStatCell = (label: string, icon: string, value: string): string =>
  `<div class="minion-stat-cell" aria-label="${label}: ${value}"><span aria-hidden="true">${icon}</span><strong>${value}</strong></div>`;

export function updateMinionCountdown(now = Date.now()): void {
  for (const element of ui.minionCards.querySelectorAll<HTMLElement>('[data-respawn-at]')) {
    const remaining = Math.max(0, Math.ceil((Number(element.dataset.respawnAt) - now) / 1000));
    element.textContent = remaining ? `Respawning in ${remaining}s` : 'Reviving';
  }
}

export function renderMinions(snapshot: ProgressionSnapshot): void {
  const { minions, soulCatcher } = snapshot;
  const expanded = new Set(Array.from(ui.minionCards.querySelectorAll<HTMLDetailsElement>('details[open]')).map((node) => node.closest<HTMLElement>('[data-minion-id]')?.dataset.minionId));
  ui.minionCards.innerHTML = minions.slots.map((slot) => {
    const minion = minions.roster.find((entry) => entry.slotId === slot.slotId);
    if (!minion) {
      const unlock = slot.slotId === 1 ? 'Layer 1 · Minion Covenant · 30 Uncommon Souls' : slot.slotId === 2
        ? 'Layer 2 · Second Covenant · 40 Rare Souls' : 'Layer 3 · Third Covenant · 20 Epic Souls';
      if (!slot.unlocked) return `<article class="minion-card"><div class="minion-card-heading"><strong>Slot ${slot.slotId}</strong><small>Locked</small></div><p>Unlock in Soul Catcher: ${unlock}. The first Imp is included with that purchase.</p></article>`;
      const affordable = soulCatcher.balances[slot.cost.soulType] >= slot.cost.amount;
      return `<article class="minion-card"><div class="minion-card-heading"><strong>Slot ${slot.slotId}</strong><small>Empty</small></div><button class="minion-summon" data-summon-slot="${slot.slotId}" aria-label="Summon Imp in slot ${slot.slotId} for ${slot.cost.amount} ${sourceLabel(slot.cost.soulType)} Souls" ${affordable ? '' : 'disabled'}>Summon · ${slot.cost.amount} ${soulIcon(slot.cost.soulType)}</button>${affordable ? '' : `<p class="minion-summon-reason">Not enough ${sourceLabel(slot.cost.soulType)} Souls</p>`}</article>`;
    }
    const statCells = [
      minionStatCell('HP', heartIcon(17), `${minionNumber(minion.hp)} / ${minionNumber(minion.maxHp)}`),
      minionStatCell('Health regeneration', heartRegenIcon(17), `${minionNumber(minion.stats.regenPerSecond)}/s`),
      minionStatCell('Movement speed', minionStatIcons.speed, `${minionNumber(minion.stats.speedMetersPerSecond)} m/s`),
      minionStatCell('Evasion', evasionIcon(17), `${minionNumber(minion.stats.evasionChancePercent)}%`),
      ...(['blunt', 'slash', 'piercing'] as DamageType[]).flatMap((type) => [
        minion.stats.attackByType[type] > 0 ? minionStatCell(`${sourceLabel(type)} attack`, damageTypeIcon(type, 17), minionNumber(minion.stats.attackByType[type])) : '',
        minion.stats.defenseByType[type] > 0 ? minionStatCell(`${sourceLabel(type)} defence`, damageTypeDefenseIcon(type, 17), minionNumber(minion.stats.defenseByType[type])) : ''
      ]).filter(Boolean)
    ].join('');
    const equipped = Object.entries(minion.equipment.equipped).flatMap(([slot, itemId]) => {
      if (!itemId) return [];
      const definition = EQUIPMENT_BY_ID.get(itemId), owned = minion.equipment.items.find((entry) => entry.itemId === itemId);
      if (!definition || !owned) return [];
      const icon = equipmentIcon(definition, { itemId, level: owned.level, ascend: owned.ascend }, 'slot') ?? damageTypeIcon(definition.damageType, 24);
      return [`<div class="minion-equipment-item rarity-${definition.rarity}" aria-label="${SLOT_LABELS[slot as EquipmentSlotId]}: ${definition.name}, Level ${owned.level}, Ascend ${owned.ascend}">${icon}</div>`];
    }).join('');
    const souls = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as SoulType[]).map((type) =>
      minionStatCell(`${sourceLabel(type)} Souls contributed`, soulIcon(type), minionNumber(minion.soulContributions[type]))).join('');
    const status = minion.respawnAt === null ? `Area ${minion.areaId} · ${minion.activity.mode === 'paused' ? 'Paused' : 'Active'}` : `<span data-respawn-at="${minion.respawnAt}"></span>`;
    const { mode, target } = minion.activity;
    const targetKind = target ? target.tier === 'crystal' ? 'crystal' : `${target.tier} enemy` : '';
    const activity = minion.respawnAt !== null ? 'Waiting to respawn' : mode === 'paused' ? 'Paused · provide input to resume' : mode === 'recovering' ? 'Recovering'
      : mode === 'attacking' && target ? `Attacking ${targetKind}` : mode === 'moving' && target ? `Moving toward ${targetKind}` : 'Seeking target';
    const targetProgress = target && minion.respawnAt === null ? `<span aria-label="Target ${target.id} HP: ${minionNumber(target.hp)} of ${minionNumber(target.maxHp)}">${minionNumber(target.hp)} / ${minionNumber(target.maxHp)} HP</span>` : '';
    const { stats, copies } = minion.infusionPreview;
    const statPreview = (Object.keys(minionStatLabels) as LootType[]).filter((type) => stats[type] !== 0).map((type) =>
      minionStatCell(minionStatLabels[type], minionStatIcons[type], `+${minionNumber(stats[type])}`)).join('');
    const copyPreview = Object.entries(copies).map(([itemId, quantity]) => {
      const definition = EQUIPMENT_BY_ID.get(itemId);
      if (!definition) return '';
      const icon = equipmentIcon(definition, { itemId, level: quantity, ascend: 0 }, 'bag') ?? damageTypeIcon(definition.damageType, 20);
      return `<div class="minion-copy-item" aria-label="${quantity} ${definition.name} copies transferred"><span aria-hidden="true">${icon}</span><strong>×${minionNumber(quantity)}</strong></div>`;
    }).join('');
    return `<article class="minion-card" data-minion-id="${minion.id}"><div class="minion-card-heading"><span class="minion-color minion-color-${minion.color}" aria-hidden="true"></span><strong>Slot ${slot.slotId} · Imp ${minion.id.replace(/^minion-/, '#')}</strong><small>${status}</small></div><div class="minion-activity"><span>${activity}</span>${targetProgress}</div><div class="minion-stat-grid">${statCells}</div><div class="minion-card-subtitle">Equipped</div><div class="minion-equipment-grid">${equipped || '<span class="minion-empty">None</span>'}</div><div class="minion-card-subtitle">Souls contributed</div><div class="minion-soul-grid">${souls}</div><details class="minion-infusion-preview" ${expanded.has(minion.id) ? 'open' : ''}><summary>Hero infusion preview</summary><p>50% of kill-earned stats</p><div class="minion-stat-grid">${statPreview || '<span class="minion-empty">No stat gains yet</span>'}</div><p>100% of earned equipment copies</p><div class="minion-copy-grid">${copyPreview || '<span class="minion-empty">No copies earned yet</span>'}</div></details><button class="minion-sacrifice" data-sacrifice-minion="${minion.id}" aria-label="Sacrifice Imp ${minion.id} in slot ${slot.slotId}">Sacrifice this Imp</button></article>`;
  }).join('');
  updateMinionCountdown();
}

export function renderSoulCatcher(snapshot: ProgressionSnapshot, selectedId: string | null, currentLayer: number): void {
  const { soulCatcher } = snapshot, { layers } = soulCatcher;
  const layer = layers.find((entry) => entry.layer === currentLayer);
  const nodes = layer?.nodes ?? [], edges = layer?.edges ?? [];
  const revealed = (id: string): boolean => nodes.find((node) => node.id === id)?.revealed ?? false;
  const position = (node: SoulNodeSnapshot): [number, number] => { const angle = node.position.angleDeg * Math.PI / 180; const radius = node.position.radius * 92; return [360 + Math.cos(angle) * radius, 360 + Math.sin(angle) * radius]; };
  ui.soulBalances.innerHTML = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as SoulType[]).map((type) => `<div aria-label="${sourceLabel(type)} souls: ${soulCatcher.balances[type]}">${soulIcon(type)}<strong>${soulCatcher.balances[type]}</strong></div>`).join('');
  const target = soulCatcher.nextLayerXp, progress = soulCatcher.progressPercent;
  ui.soulXp.innerHTML = `<div><span>Soul Catcher XP</span><strong>${target === null ? 'MAX LAYER' : `${soulCatcher.xp.toLocaleString()} / ${target.toLocaleString()}`}</strong></div><div class="soul-xp-track"><span style="width:${progress}%"></span></div>`;
  ui.soulLayerTabs.innerHTML = layers.map((entry) => `<button type="button" data-soul-layer="${entry.layer}" class="${entry.layer === currentLayer ? 'current' : ''}" ${!entry.unlocked ? 'disabled' : ''}>${!entry.unlocked ? '🔒 ' : ''}Layer ${entry.layer}</button>`).join('');
  const authored = layers.find((entry) => entry.layer === currentLayer)?.authored;
  ui.soulTreeViewport.hidden = !authored; ui.soulDetail.hidden = !authored;
  if (!authored) { ui.soulDetail.hidden = false; ui.soulDetail.innerHTML = '<p class="soul-placeholder">Feature is coming soon!</p>'; ui.soulConnections.innerHTML = ''; ui.soulNodes.innerHTML = ''; return; }
  ui.soulConnections.innerHTML = edges.map(([a, b]) => { const [x1,y1] = position(nodes.find((n) => n.id === a)!); const [x2,y2] = position(nodes.find((n) => n.id === b)!); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${revealed(a) && revealed(b) ? 'revealed' : ''}"/>`; }).join('');
  ui.soulNodes.innerHTML = nodes.map((node) => { const [x,y] = position(node), isRevealed = revealed(node.id), level = node.level, purchasable = node.purchasable; return `<button type="button" class="soul-node ${isRevealed ? 'revealed' : 'mystery'} ${level ? 'purchased' : ''} ${purchasable ? 'purchasable' : ''} ${selectedId === node.id ? 'selected' : ''}" style="left:${x}px;top:${y}px" data-soul-node="${isRevealed ? node.id : ''}" aria-label="${isRevealed ? node.name : 'Hidden Soul Catcher node'}">${isRevealed ? `<span class="soul-node-icon">${soulIcon(node.soulType)}</span>${purchasable ? '<span class="soul-upgrade">↑</span>' : ''}<span class="soul-level">${level}/${node.maxLevel}</span>` : '?'}</button>`; }).join('');
  const node = nodes.find((candidate) => candidate.id === selectedId);
  if (!node || !revealed(node.id)) { ui.soulDetail.innerHTML = '<p>Select a revealed node to inspect it.</p>'; return; }
  const level = node.level, maxed = node.nextCost === null, cost = node.nextCost;
  ui.soulDetail.innerHTML = `<div><small>${node.id}</small><h3>${node.name}</h3><strong>Level ${level} / ${node.maxLevel}</strong><p>${node.description}</p></div><button type="button" data-purchase-soul="${node.id}" ${!node.purchasable ? 'disabled' : ''}>${maxed ? 'MAX LEVEL' : `Purchase · ${cost} ${soulIcon(node.soulType)}`}</button>`;
}

export function showSoulDrop(quantity: number, type: SoulType): void {
  const element = document.createElement('div'); element.className = 'gain-pop soul-gain'; element.innerHTML = `<strong>+${quantity}</strong>${soulIcon(type)}`;
  ui.soulGainStack.append(element); window.setTimeout(() => { element.classList.add('leaving'); window.setTimeout(() => element.remove(), 180); }, 1600);
}

const SLOT_LABELS: Record<EquipmentSlotId, string> = { hand1: 'Weapon', orbit1: 'Orbit 1', orbit2: 'Orbit 2', orbit3: 'Orbit 3', helmet: 'Helmet', armor: 'Armor', legs: 'Legs', ring: 'Ring' };
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'] as const;
const DAMAGE_TYPE_ORDER = ['blunt', 'slash', 'piercing'] as const;
const formatInventoryValue = (value: number): string => value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(value % 1 ? 1 : 0);

function sortInventoryItems(items: EquipmentSnapshot[]): EquipmentSnapshot[] {
  return items.sort((left, right) => {
    const leftItem = left.definition, rightItem = right.definition;
    const rarityDifference = RARITY_ORDER.indexOf(leftItem?.rarity ?? 'common') - RARITY_ORDER.indexOf(rightItem?.rarity ?? 'common');
    if (rarityDifference) return rarityDifference;
    const typeDifference = DAMAGE_TYPE_ORDER.indexOf(leftItem?.damageType ?? 'blunt') - DAMAGE_TYPE_ORDER.indexOf(rightItem?.damageType ?? 'blunt');
    return typeDifference || (leftItem?.name ?? left.owned.itemId).localeCompare(rightItem?.name ?? right.owned.itemId);
  });
}

export function renderProgressionHud(snapshot: ProgressionSnapshot): void {
  const { items: inventoryItems, slots } = snapshot.equipment;
  ui.soulCatcherButton.classList.toggle('locked', !snapshot.soulCatcher.available);
  ui.quickSlots.forEach((slotEl) => {
    const slot = slotEl.dataset.slot as EquipmentSlotId;
    const itemId = slots.find((entry) => entry.slot === slot)?.itemId;
    const item = itemId ? inventoryItems[itemId]?.definition : undefined;
    slotEl.innerHTML = item ? `<span>${SLOT_LABELS[slot]}</span>${damageTypeIcon(item.damageType, 19)}` : `<span>${SLOT_LABELS[slot]}</span>`;
  });
}

export function renderInventory(snapshot: ProgressionSnapshot): void {
  const { items: inventoryItems, slots, summary } = snapshot.equipment;
  const primary = [
    ['Total attack', '⚔', summary.totalAttack],
    ['Max HP', heartIcon(23), summary.maxHp],
    ['HP regeneration', heartRegenIcon(23), summary.regenPerSecond]
  ] as const;
  const damageTypes = ['blunt', 'slash', 'piercing'] as const;
  const affinityRow = (defense: boolean): string => damageTypes.map((type) => `<div class="inventory-affinity" aria-label="${type} ${defense ? 'defence' : 'attack'}: ${formatInventoryValue(defense ? summary.defenseByType[type] : summary.attackByType[type])}">${defense ? damageTypeDefenseIcon(type, 17) : damageTypeIcon(type, 15)}<strong>${formatInventoryValue(defense ? summary.defenseByType[type] : summary.attackByType[type])}</strong><small>${defense ? 'DEF' : 'ATK'}</small></div>`).join('');
  ui.inventorySummary.innerHTML = `<div class="inventory-primary-stats">${primary.map(([label, icon, value]) => `<div class="inventory-primary-stat" aria-label="${label}: ${formatInventoryValue(value)}"><span aria-hidden="true">${icon}</span><strong>${formatInventoryValue(value)}</strong><small>${label}</small></div>`).join('')}</div><div class="inventory-affinities">${affinityRow(false)}${affinityRow(true)}</div>`;

  ui.inventoryEquipped.innerHTML = slots.map(({ slot, itemId }) => {
    const entry = itemId ? inventoryItems[itemId] : undefined;
    const item = entry?.definition, owned = entry?.owned;
    const art = item && owned ? equipmentIcon(item, owned, 'slot') ?? damageTypeIcon(item.damageType, 25) : '<strong>+</strong>';
    return `<button class="inventory-equip-slot" type="button" data-slot="${slot}"${itemId ? ` data-item-id="${itemId}"` : ''} aria-label="${SLOT_LABELS[slot]}${item ? `, ${item.name}` : ', empty'}"><span>${SLOT_LABELS[slot]}</span>${art}</button>`;
  }).join('');
  const items = Object.values(inventoryItems).filter((entry) => !entry.equippedSlot);
  const section = (title: string, sectionItems: EquipmentSnapshot[]): string => sectionItems.length ? `<section class="inventory-bag-section"><h3>${title}</h3><div class="inventory-bag-grid">${sortInventoryItems(sectionItems).map(({ definition: item, owned }) => {
    const itemArt = item ? equipmentIcon(item, owned, 'bag') : null;
    return `<button class="inventory-item rarity-${item?.rarity ?? 'common'}${itemArt ? ' equipment-item' : ''}" type="button" data-item-id="${owned.itemId}" aria-label="${item?.name ?? owned.itemId}, level ${owned.level}, ascend ${owned.ascend}">${itemArt ?? damageTypeIcon(item?.damageType ?? 'blunt', 27)}</button>`;
  }).join('')}</div></section>` : '';
  const weapons = items.filter(({ definition }) => definition.kind === 'weapon');
  const armor = items.filter(({ definition }) => definition.kind === 'armor');
  const armorClass = (kind: 'helmet' | 'armor' | 'boots'): EquipmentSnapshot[] => armor.filter(({ definition: item }) => { return item?.kind === 'armor' && item.armorClass === kind; });
  ui.inventoryBag.innerHTML = items.length ? section('Weapons', weapons) + section('Helmets', armorClass('helmet')) + section('Armor', armorClass('armor')) + section('Legs', armorClass('boots')) : '<div class="inventory-empty">No equipment found yet.</div>';
}

let progressionTimer: number | null = null;
export function showBossProgression(bossName: string, destinationName?: string): void {
  if (progressionTimer !== null) window.clearTimeout(progressionTimer);
  ui.progressionLayer.innerHTML = `<div class="progression-banner"><span class="progression-kicker">Boss defeated</span><strong>${bossName}</strong>${destinationName ? `<span class="progression-route">Route opened · ${destinationName}</span>` : ''}</div>`;
  progressionTimer = window.setTimeout(() => { ui.progressionLayer.innerHTML = ''; progressionTimer = null; }, 3200);
}

export function renderItemDetail(snapshot: ProgressionSnapshot, itemId: string): void {
  const entry = snapshot.equipment.items[itemId];
  if (!entry) { ui.inventoryDetail.innerHTML = ''; return; }
  const { definition: item, owned, equippedSlot: equipped, value, perLevel, ascend } = entry;
  const afterAscend = ascend.value, copiesRequired = ascend.copiesRequired;
  const label = item.kind === 'weapon' ? 'Damage' : 'Defense';
  const itemClass = item.kind === 'weapon' ? item.weaponClass : item.armorClass === 'boots' ? 'legs' : item.armorClass;
  const itemArt = equipmentIcon(item, owned, 'detail') ?? damageTypeIcon(item.damageType, 52);
  const slotPicker = item.kind === 'weapon' && !equipped ? `<div class="inventory-slot-picker" hidden data-slot-picker><span>Choose a weapon slot</span><div>${entry.equipSlots.map(({ slot, itemId }) => `<button type="button" data-equip-slot="${slot}" data-item-id="${item.id}"><strong>${SLOT_LABELS[slot]}</strong><small>${itemId ? 'Replace' : 'Empty'}</small></button>`).join('')}</div></div>` : '';
  ui.inventoryDetail.innerHTML = `<button class="inventory-back" type="button" data-inventory-back>← Overview</button><div class="item-detail-hero"><div class="weapon-art rarity-${item.rarity}">${itemArt}</div><h3>${item.name}</h3><div class="weapon-meta">${item.rarity} · ${itemClass} · ${damageTypeIcon(item.damageType, 12)} ${item.damageType}</div><strong>Level ${owned.level} · Ascend ${owned.ascend}</strong></div><div class="weapon-values"><span>${label}<strong>${formatInventoryValue(value)}</strong></span><span>Per level<strong>+${formatInventoryValue(perLevel)}</strong></span>${item.kind === 'weapon' ? `<span>Cooldown<strong>${item.attackCooldownSeconds}s</strong></span>` : ''}<span>Type<strong>${damageTypeIcon(item.damageType, 13)} ${item.damageType}</strong></span></div><section class="item-power"><small>Special power</small><p>${owned.ascend === 0 ? 'Hidden power will be unlocked upon Ascend' : 'Power unlocked · ability coming soon'}</p></section><section class="ascend-preview"><small>Ascend</small>${afterAscend === null ? `<p>Ascend at ${copiesRequired} copies · ${ascend.copiesRemaining} remaining</p>` : `<p>${label} <strong>${formatInventoryValue(value)} → ${formatInventoryValue(afterAscend)}</strong></p>`}</section>${slotPicker}<div class="weapon-actions">${equipped ? `<button data-unequip="${equipped}" data-item-id="${item.id}">Unequip</button>` : `<button data-equip data-item-id="${item.id}">Equip</button>`}<button data-ascend data-item-id="${item.id}" ${!ascend.available ? 'disabled' : ''}>Ascend</button></div>`;
}

const dropQueue: Array<{ itemId: string; quantity: number; previousLevel: number | null; newLevel: number; ascend: number; copiesRequired: number }> = [];
let showingDrop = false;
export function showEquipmentDrop(drop: typeof dropQueue[number]): void {
  dropQueue.push(drop);
  if (showingDrop) return;
  const showNext = (): void => {
    const next = dropQueue.shift();
    if (!next) { showingDrop = false; return; }
    showingDrop = true;
    const item = EQUIPMENT_BY_ID.get(next.itemId)!;
    const copiesRequired = next.copiesRequired;
    ui.equipmentDropLayer.innerHTML = `<div class="equipment-drop rarity-${item.rarity}"><div class="equipment-drop-icon">${equipmentIcon(item, { itemId: item.id, level: next.newLevel, ascend: next.ascend }, 'detail') ?? damageTypeIcon(item.damageType, 48)}</div><div class="equipment-drop-copy"><b>${item.name}</b><strong>+${next.quantity} ${next.quantity === 1 ? 'copy' : 'copies'} <span>(${next.newLevel}/${copiesRequired})</span></strong></div></div>`;
    window.setTimeout(() => { ui.equipmentDropLayer.innerHTML = ''; showingDrop = false; showNext(); }, 3600);
  };
  showNext();
}

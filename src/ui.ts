import './reward-popups.css';
import { bluntHammerIcon, combatAffinityIcon, damageTypeIcon, heartIcon } from './icons';
import { save, statAdditiveTotal, statTotal } from './save';
import { EQUIPMENT_BY_ID, equipmentDamage, equipmentDefense } from './systems/EquipmentSystem';
import type { AreaDefinition, EquipmentSlotId, InventoryState, OwnedEquipment, PlayerStats, StatSources } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div id="game-shell">
  <div id="loading-screen" class="loading-screen" role="status" aria-live="polite">
    <div class="loading-mark" aria-hidden="true"><span></span></div>
    <div class="loading-title">Infuse: Evergrowth</div>
    <div class="loading-subtitle">Preparing the realm</div>
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
          <div class="hand-hud"><span id="hand1-stat"></span><span id="hand2-stat"></span></div>
        </div>
        <div id="enemy-affinities" class="enemy-affinities"></div>
      </div>
      <div class="debug-actions">
        <button id="stats-button" class="card stats-button" type="button">STATS</button>
        <button id="spawn-button" class="card stats-button" type="button" title="Reset active respawn cooldowns">SPAWN</button>
      </div>
    </div>
    <button id="settings-button" class="settings-button card" type="button" aria-label="Graphics settings" title="Graphics settings">&#9881;</button>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
    <div class="controls"><div id="joystick" class="joystick-zone"><div id="joystick-knob" class="joystick-knob"></div></div></div>
    <div class="bottom-dock card">
      <div class="quick-slots" aria-label="equipped weapon slots">
        <div class="quick-slot" data-slot="hand1"><span>H1</span></div>
        <div class="quick-slot" data-slot="hand2"><span>H2</span></div>
        <div class="quick-slot" data-slot="orbit1"><span>O1</span></div>
        <div class="quick-slot" data-slot="orbit2"><span>O2</span></div>
      </div>
      <button id="inventory-button" class="dock-button" type="button">INVENTORY</button>
    </div>
    <div id="gain-stack" class="gain-stack" aria-live="polite"></div>
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
        <p class="stats-help">Stats keep decimal precision here. Combat HUD values are rounded to whole numbers.</p>
      </div>
    </div>
    <div id="inventory-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet inventory-sheet">
        <div class="modal-header">
          <div><div class="brand">Equipment</div><h2>Inventory</h2></div>
          <button id="inventory-close" class="modal-close" type="button">CLOSE</button>
        </div>
        <div class="inventory-section-title">Equipped</div>
        <div id="inventory-equipped" class="inventory-equipped"></div>
        <div class="inventory-section-title">Bag</div>
        <div id="inventory-bag" class="inventory-bag"></div>
        <div id="weapon-detail" class="weapon-detail"></div>
      </div>
    </div>
    <div id="settings-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet settings-sheet">
        <div class="modal-header">
          <div><div class="brand">Display</div><h2>Graphics settings</h2></div>
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
        <p class="settings-help">Changes apply immediately and are kept on this device.</p>
        <div class="settings-danger">
          <div><strong>Reset attributes</strong><small>Remove all permanent stat gains. Equipment and its progress are kept.</small></div>
          <button id="reset-attributes-button" type="button">RESET ATTRIBUTES</button>
        </div>
      </div>
    </div>
    <output id="renderer-stats" class="renderer-stats" aria-live="off"></output>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  loadingScreen: q<HTMLDivElement>('#loading-screen'), loadingProgress: q<HTMLSpanElement>('#loading-progress'), loadingPercent: q<HTMLDivElement>('#loading-percent'),
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), hand1Stat: q<HTMLSpanElement>('#hand1-stat'), hand2Stat: q<HTMLSpanElement>('#hand2-stat'),
  enemyAffinities: q<HTMLDivElement>('#enemy-affinities'),
  world: q<HTMLDivElement>('#world-ui'), toast: q<HTMLDivElement>('#toast'), gainStack: q<HTMLDivElement>('#gain-stack'),
  joystick: q<HTMLDivElement>('#joystick'), joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  spawnButton: q<HTMLButtonElement>('#spawn-button'),
  settingsButton: q<HTMLButtonElement>('#settings-button'), settingsPanel: q<HTMLDivElement>('#settings-panel'),
  settingsClose: q<HTMLButtonElement>('#settings-close'), rendererStatsOption: q<HTMLLabelElement>('#renderer-stats-option'),
  rendererStatsToggle: q<HTMLInputElement>('#renderer-stats-toggle'), rendererStats: q<HTMLOutputElement>('#renderer-stats'),
  resetAttributesButton: q<HTMLButtonElement>('#reset-attributes-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host'),
  inventoryButton: q<HTMLButtonElement>('#inventory-button'), inventoryPanel: q<HTMLDivElement>('#inventory-panel'),
  inventoryClose: q<HTMLButtonElement>('#inventory-close'), inventoryEquipped: q<HTMLDivElement>('#inventory-equipped'),
  inventoryBag: q<HTMLDivElement>('#inventory-bag'), weaponDetail: q<HTMLDivElement>('#weapon-detail'), equipmentDropLayer: q<HTMLDivElement>('#equipment-drop-layer'),
  progressionLayer: q<HTMLDivElement>('#progression-layer'), quickSlots: Array.from(document.querySelectorAll<HTMLDivElement>('.quick-slot'))
};

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
function showGain(amount: string, stat: string, source?: string): void {
  const element = document.createElement('div');
  const healthStat = stat === 'HP' || stat === 'HP/S';
  element.className = `gain-pop ${healthStat ? 'hp' : 'blunt'}`;
  element.innerHTML = `<span class="gain-source">${source ?? 'Permanent'}</span><strong>+${amount}${stat === 'HP/S' ? ' HP/s' : ''}</strong>${healthStat ? heartIcon(13) : bluntHammerIcon(13)}`;
  element.style.opacity = '0'; element.style.transform = 'translateY(8px)'; ui.gainStack.append(element); gainItems.unshift(element);
  requestAnimationFrame(() => { layoutGainItems(); element.style.opacity = '1'; });
  window.setTimeout(() => { const index = gainItems.indexOf(element); if (index >= 0) gainItems.splice(index, 1); element.classList.add('leaving'); layoutGainItems(); window.setTimeout(() => element.remove(), 180); }, 1600);
}

export function showStatGain(amount: number, stat: string, source: string): void {
  showGain(Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''), stat, source);
}

let toastTimer: number | null = null;
export function showToast(message: string): void {
  const gain = message.match(/^\+([0-9]+(?:\.[0-9]+)?) (HP|BLUNT)\b/);
  if (gain) { showGain(gain[1], gain[2] as 'HP' | 'BLUNT'); return; }
  ui.toast.textContent = message; ui.toast.classList.add('visible');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 1500);
}

function sourceLabel(source: string): string { return source.replace(/[_-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()); }
function renderBreakdown(label: string, stat: StatSources, suffix = ''): string {
  const additiveTotal = statAdditiveTotal(stat), total = statTotal(stat);
  const adds = Object.entries(stat.additive).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>${v.toFixed(2)}${suffix}</span></div>`).join('');
  const mults = Object.entries(stat.multiplicative).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>x${v.toFixed(2)}</span></div>`).join('');
  return `<section class="stat-breakdown"><div class="stat-row"><span>${label}</span><strong>${total.toFixed(2)}${suffix}</strong></div><div class="stat-group-title">Base</div><div class="stat-line"><span>Base</span><span>${stat.base.toFixed(2)}${suffix}</span></div><div class="stat-group-title">Additive</div>${adds}<div class="stat-line stat-subtotal"><span>Total</span><span>${additiveTotal.toFixed(2)}${suffix}</span></div><div class="stat-group-title">Multiplicative</div>${mults}<div class="stat-line stat-total"><span>Total</span><strong>${total.toFixed(2)}${suffix}</strong></div></section>`;
}

export function renderStats(stats: PlayerStats): void {
  const bluntLabel = `<span class="stat-title-with-icon">${bluntHammerIcon(14)} Blunt attack</span>`;
  ui.statsContent.innerHTML = [renderBreakdown('Max HP', stats.maxHp), renderBreakdown(bluntLabel, stats.attack.blunt), renderBreakdown('Health regeneration', stats.regen, ' HP/s')].join('');
}

const SLOT_LABELS: Record<EquipmentSlotId, string> = { hand1: 'Hand 1', hand2: 'Hand 2', orbit1: 'Orbit 1', orbit2: 'Orbit 2', helmet: 'Helmet', armor: 'Armor', legs: 'Legs' };
const SLOT_ORDER: EquipmentSlotId[] = ['hand1', 'hand2', 'orbit1', 'orbit2'];

export function renderInventory(inventory: InventoryState): void {
  const armorPreview = (['helmet', 'armor', 'legs'] as const).map((slot) => {
    const itemId = inventory.equipped[slot]; const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    return `<div class="inventory-equip-slot" data-slot="${slot}"${itemId ? ` data-item-id="${itemId}" draggable="true"` : ''}><span>${SLOT_LABELS[slot]}</span>${item ? damageTypeIcon(item.damageType, 25) : '<strong>EMPTY</strong>'}</div>`;
  }).join('');
  const weapons = SLOT_ORDER.map((slot) => {
    const locked = false;
    const itemId = inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const value = locked ? '<strong>LOCKED</strong>' : item ? damageTypeIcon(item.damageType, 25) : '<strong>EMPTY</strong>';
    return `<div class="inventory-equip-slot${locked ? ' locked' : ''}" data-slot="${slot}"${itemId && !locked ? ` data-item-id="${itemId}" draggable="true"` : ''}><span>${SLOT_LABELS[slot]}</span>${value}</div>`;
  }).join('');
  ui.inventoryEquipped.innerHTML = `<div class="equipment-layout"><div class="armor-preview" aria-label="Armor slots">${armorPreview}</div><div class="weapon-slots">${weapons}</div></div>`;
  ui.quickSlots.forEach((slotEl) => {
    const slot = slotEl.dataset.slot as EquipmentSlotId;
    const itemId = inventory.equipped[slot];
    const label = slot === 'hand1' ? 'H1' : slot === 'hand2' ? 'H2' : slot === 'orbit1' ? 'O1' : 'O2';
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    slotEl.innerHTML = item ? `<span>${label}</span>${damageTypeIcon(item.damageType, 19)}` : `<span>${label}</span>`;
  });
  const equippedItemIds = new Set(Object.values(inventory.equipped));
  const items = Object.values(inventory.items).filter((owned) => !equippedItemIds.has(owned.itemId));
  const section = (title: string, sectionItems: OwnedEquipment[]): string => sectionItems.length ? `<div class="inventory-bag-title">${title}</div>${sectionItems.map((owned) => { const item = EQUIPMENT_BY_ID.get(owned.itemId); return `<button class="inventory-item rarity-${item?.rarity ?? 'common'}" type="button" data-item-id="${owned.itemId}" draggable="true" aria-label="${item?.name ?? owned.itemId}, level ${owned.level}">${item ? damageTypeIcon(item.damageType, 27) : ''}<span>Lv ${owned.level} · A${owned.ascend}</span></button>`; }).join('')}` : '';
  const weaponsInBag = items.filter((owned) => EQUIPMENT_BY_ID.get(owned.itemId)?.kind === 'weapon');
  const armorInBag = items.filter((owned) => EQUIPMENT_BY_ID.get(owned.itemId)?.kind === 'armor');
  ui.inventoryBag.innerHTML = items.length ? section('Weapons', weaponsInBag) + section('Armor · Helmets · Legs', armorInBag) : '<div class="inventory-empty">No equipment found yet.</div>';
}

let progressionTimer: number | null = null;
export function showBossProgression(bossName: string, destinationName?: string): void {
  if (progressionTimer !== null) window.clearTimeout(progressionTimer);
  ui.progressionLayer.innerHTML = `<div class="progression-banner"><span class="progression-kicker">Boss defeated</span><strong>${bossName}</strong>${destinationName ? `<span class="progression-route">Route opened · ${destinationName}</span>` : ''}</div>`;
  progressionTimer = window.setTimeout(() => { ui.progressionLayer.innerHTML = ''; progressionTimer = null; }, 3200);
}

export function renderWeaponDetail(owned: OwnedEquipment | null): void {
  const item = owned ? EQUIPMENT_BY_ID.get(owned.itemId) : undefined;
  if (!owned || !item) { ui.weaponDetail.innerHTML = ''; return; }
  const equipped = (Object.keys(save.inventory.equipped) as EquipmentSlotId[]).find((slot) => save.inventory.equipped[slot] === item.id);
  const value = item.kind === 'weapon' ? equipmentDamage(item, owned) : equipmentDefense(item, owned);
  const perLevel = (item.kind === 'weapon' ? item.baseDamagePerLevel : item.baseDefensePerLevel) * 2 ** owned.ascend;
  const label = item.kind === 'weapon' ? 'Damage' : 'Defense';
  const itemClass = item.kind === 'weapon' ? item.weaponClass : item.armorClass;
  ui.weaponDetail.innerHTML = `<div class="weapon-art rarity-${item.rarity}">${damageTypeIcon(item.damageType, 52)}</div><h3>${item.name}</h3><div class="weapon-meta">${item.rarity} · ${itemClass}</div><div class="weapon-values"><span>Level <strong>${owned.level}</strong></span><span>Ascend <strong>${owned.ascend}</strong></span><span>${label} <strong>${Math.round(value)} ${damageTypeIcon(item.damageType, 12)}</strong></span><span>Per level <strong>+${perLevel}</strong></span></div><div class="weapon-actions">${equipped ? `<button data-unequip="${equipped}" data-item-id="${item.id}">Unequip</button>` : `<button data-equip data-item-id="${item.id}">Equip</button>`}<button data-ascend data-item-id="${item.id}" ${owned.level < 50 ? 'disabled' : ''}>Ascend</button></div><p>${item.kind === 'armor' ? `Flat ${item.damageType} damage reduction.` : owned.ascend === 0 ? 'Hidden power will be unlocked upon Ascend' : 'Power unlocked · ability coming soon'}</p>${equipped ? `<small>Equipped ${equipped.toUpperCase()}</small>` : ''}`;
}

const dropQueue: Array<{ itemId: string; quantity: number; previousLevel: number | null; newLevel: number; ascend: number }> = [];
let showingDrop = false;
export function showEquipmentDrop(drop: typeof dropQueue[number]): void {
  dropQueue.push(drop);
  if (showingDrop) return;
  const showNext = (): void => {
    const next = dropQueue.shift();
    if (!next) { showingDrop = false; return; }
    showingDrop = true;
    const item = EQUIPMENT_BY_ID.get(next.itemId)!;
    ui.equipmentDropLayer.innerHTML = `<div class="equipment-drop rarity-${item.rarity}">${damageTypeIcon(item.damageType, 58)}<b>${item.name}</b><span>${item.rarity} ${item.kind === 'weapon' ? item.weaponClass : item.armorClass} · x${next.quantity}</span><strong>${next.previousLevel === null ? 'NEW · ' : `Level ${next.previousLevel} → `}Level ${next.newLevel} · Ascend ${next.ascend}</strong></div>`;
    window.setTimeout(() => { ui.equipmentDropLayer.innerHTML = ''; showingDrop = false; showNext(); }, 1800);
  };
  showNext();
}

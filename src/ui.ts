import './reward-popups.css';
import { bluntHammerIcon, heartIcon } from './icons';
import { statAdditiveTotal, statTotal } from './save';
import type { EquipmentSlotId, InventoryState, PlayerStats, StatSources } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div id="game-shell">
  <div id="canvas-host"></div>
  <div class="hud">
    <div class="version-tag">0.31</div>
    <div class="topbar">
      <div class="card hp-wrap">
        <div class="brand">Infuse: Evergrowth</div>
        <div class="stats">
          <div style="flex:1">
            <div class="hp-label"><span>HP</span><span id="hp-text">20 / 20</span></div>
            <div class="bar"><span id="hp-bar"></span></div>
          </div>
          <div class="damage-hud" title="Blunt damage">${bluntHammerIcon(13)}<span id="attack-stat">5</span></div>
        </div>
      </div>
      <button id="stats-button" class="card stats-button" type="button">STATS</button>
    </div>
    <div class="reset-note">Daily spawn reset: local midnight</div>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
    <div class="controls"><div id="joystick" class="joystick-zone"><div id="joystick-knob" class="joystick-knob"></div></div></div>
    <div class="bottom-dock card">
      <div class="quick-slots" aria-label="equipped weapon slots">
        <div class="quick-slot" data-slot="hand1"><span>H1</span></div>
        <div class="quick-slot" data-slot="hand2"><span>H2</span></div>
        <div class="quick-slot locked" data-slot="orbit1"><span>O1</span></div>
        <div class="quick-slot locked" data-slot="orbit2"><span>O2</span></div>
      </div>
      <button id="inventory-button" class="dock-button" type="button">INVENTORY</button>
    </div>
    <div id="gain-stack" class="gain-stack" aria-live="polite"></div>
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
      </div>
    </div>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), attackText: q<HTMLSpanElement>('#attack-stat'),
  world: q<HTMLDivElement>('#world-ui'), toast: q<HTMLDivElement>('#toast'), gainStack: q<HTMLDivElement>('#gain-stack'),
  joystick: q<HTMLDivElement>('#joystick'), joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host'),
  inventoryButton: q<HTMLButtonElement>('#inventory-button'), inventoryPanel: q<HTMLDivElement>('#inventory-panel'),
  inventoryClose: q<HTMLButtonElement>('#inventory-close'), inventoryEquipped: q<HTMLDivElement>('#inventory-equipped'),
  inventoryBag: q<HTMLDivElement>('#inventory-bag'), quickSlots: Array.from(document.querySelectorAll<HTMLDivElement>('.quick-slot'))
};

const gainItems: HTMLDivElement[] = [];

function layoutGainItems(): void {
  gainItems.forEach((element, index) => {
    element.style.transform = `translateY(${-index * 27}px)`;
  });
}

function showGain(amount: string, stat: 'HP' | 'BLUNT'): void {
  const element = document.createElement('div');
  element.className = `gain-pop ${stat === 'HP' ? 'hp' : 'blunt'}`;
  element.innerHTML = `<span>${amount}</span>${stat === 'HP' ? heartIcon(13) : bluntHammerIcon(13)}`;
  element.style.opacity = '0';
  element.style.transform = 'translateY(8px)';
  ui.gainStack.append(element);
  gainItems.unshift(element);

  requestAnimationFrame(() => {
    layoutGainItems();
    element.style.opacity = '1';
  });

  window.setTimeout(() => {
    const index = gainItems.indexOf(element);
    if (index >= 0) gainItems.splice(index, 1);
    element.classList.add('leaving');
    layoutGainItems();
    window.setTimeout(() => element.remove(), 180);
  }, 1600);
}

let toastTimer: number | null = null;
export function showToast(message: string): void {
  const gain = message.match(/^\+([0-9]+(?:\.[0-9]+)?) (HP|BLUNT)\b/);
  if (gain) {
    showGain(gain[1], gain[2] as 'HP' | 'BLUNT');
    return;
  }

  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 1500);
}

function sourceLabel(source: string): string { return source.replace(/[_-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()); }
function renderBreakdown(label: string, stat: StatSources, suffix = ''): string {
  const additiveTotal = statAdditiveTotal(stat), total = statTotal(stat);
  const adds = Object.entries(stat.additive).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>${v.toFixed(2)}${suffix}</span></div>`).join('');
  const mults = Object.entries(stat.multiplicative).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>x${v.toFixed(2)}</span></div>`).join('');
  return `<section class="stat-breakdown">
    <div class="stat-row"><span>${label}</span><strong>${total.toFixed(2)}${suffix}</strong></div>
    <div class="stat-group-title">Base</div><div class="stat-line"><span>Base</span><span>${stat.base.toFixed(2)}${suffix}</span></div>
    <div class="stat-group-title">Additive</div>${adds}<div class="stat-line stat-subtotal"><span>Total</span><span>${additiveTotal.toFixed(2)}${suffix}</span></div>
    <div class="stat-group-title">Multiplicative</div>${mults}<div class="stat-line stat-total"><span>Total</span><strong>${total.toFixed(2)}${suffix}</strong></div>
  </section>`;
}

export function renderStats(stats: PlayerStats): void {
  const bluntLabel = `<span class="stat-title-with-icon">${bluntHammerIcon(14)} Blunt attack</span>`;
  ui.statsContent.innerHTML = [
    renderBreakdown('Max HP', stats.maxHp),
    renderBreakdown(bluntLabel, stats.attack.blunt),
    renderBreakdown('Health regeneration', stats.regen, ' HP/s')
  ].join('');
}

const SLOT_LABELS: Record<EquipmentSlotId, string> = { hand1: 'Hand 1', hand2: 'Hand 2', orbit1: 'Orbit 1', orbit2: 'Orbit 2' };
const SLOT_ORDER: EquipmentSlotId[] = ['hand1', 'hand2', 'orbit1', 'orbit2'];

export function renderInventory(inventory: InventoryState): void {
  const itemNames = new Map(inventory.items.map((item) => [item.id, item.name]));
  ui.inventoryEquipped.innerHTML = SLOT_ORDER.map((slot) => {
    const locked = slot.startsWith('orbit');
    const itemId = inventory.equipped[slot];
    const value = locked ? 'LOCKED' : itemId ? itemNames.get(itemId) ?? 'ITEM' : 'EMPTY';
    return `<div class="inventory-equip-slot${locked ? ' locked' : ''}" data-slot="${slot}"><span>${SLOT_LABELS[slot]}</span><strong>${value}</strong></div>`;
  }).join('');

  ui.quickSlots.forEach((slotEl) => {
    const slot = slotEl.dataset.slot as EquipmentSlotId;
    const itemId = inventory.equipped[slot];
    const label = slot === 'hand1' ? 'H1' : slot === 'hand2' ? 'H2' : slot === 'orbit1' ? 'O1' : 'O2';
    slotEl.innerHTML = itemId ? `<span>${label}</span><strong>${itemNames.get(itemId) ?? 'ITEM'}</strong>` : `<span>${label}</span>`;
  });

  ui.inventoryBag.innerHTML = inventory.items.length
    ? inventory.items.map((item) => `<button class="inventory-item" type="button" data-item-id="${item.id}">${item.name}</button>`).join('')
    : '<div class="inventory-empty">No equipment found yet.</div>';
}

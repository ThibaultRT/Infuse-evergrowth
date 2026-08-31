import './reward-popups.css';
import { bluntHammerIcon, combatAffinityIcon, damageTypeDefenseIcon, damageTypeIcon, evasionIcon, heartIcon, heartRegenIcon } from './icons';
import { heroSpeedMultiplier, save, statAdditiveTotal, statTotal } from './save';
import { logarithmicStat, rawEvasionChance, totalEvasionChance } from './domain/combat/HeroStats';
import { EVASION_CHANCE_CAP, EVASION_RAW_SCALE, EVASION_RAW_TARGET, HERO_BLOCK_CHANCE_PERCENT, HERO_CRITICAL_CHANCE_PERCENT, HERO_CRITICAL_DAMAGE_PERCENT, HERO_SPEED } from './config';
import { EQUIPMENT_BY_ID, ascendCopies, equipmentAscendValue, equipmentDamage, equipmentDefense, equipmentValuePerLevel, type InventoryCombatSummary } from './systems/EquipmentSystem';
import { equipmentIcon } from './equipment-icons';
import type { AreaDefinition, EquipmentSlotId, InventoryState, OwnedEquipment, PlayerStats, StatSources } from './types';
import type { SoulNode } from './domain/soul-catcher';
import { SOUL_NODES, type SoulLayerMetadata } from './data/soul-catcher';
import type { SoulType } from './types';
import { soulCost } from './domain/soul-catcher';

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
          <div class="hand-hud"><span id="hand1-stat"></span><span id="orbit1-stat"></span><span id="orbit2-stat"></span><span id="orbit3-stat"></span></div>
        </div>
        <div id="enemy-affinities" class="enemy-affinities"></div>
      </div>
      <div class="debug-actions">
        <button id="stats-button" class="card stats-button" type="button">STATS</button>
        <button id="spawn-button" class="card stats-button" type="button" title="Reset active respawn cooldowns">SPAWN</button>
      </div>
    </div>
    <div class="edge-actions">
      <button id="soul-catcher-button" class="edge-button soul-catcher-button" type="button"><span class="edge-icon soul-catcher-icon"></span><small>SOUL<br>CATCHER</small></button>
      <button id="inventory-button" class="edge-button" type="button"><span class="edge-icon bag-icon"></span><small>BAG</small></button>
    </div>
    <button id="settings-button" class="settings-button card" type="button" aria-label="Graphics settings" title="Graphics settings">&#9881;</button>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
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
          <div><strong>Reset hero</strong><small>Remove all permanent stat gains and equipment drops. World progression is kept.</small></div>
          <button id="reset-hero-button" type="button">RESET HERO</button>
          <div><strong>Reset Soul Catcher</strong><small>Remove Souls and purchased nodes. World progression is kept.</small></div>
          <button id="reset-soul-catcher-button" type="button">RESET SOUL CATCHER</button>
        </div>
      </div>
    </div>
    <output id="renderer-stats" class="renderer-stats" aria-live="off"></output>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  loadingScreen: q<HTMLDivElement>('#loading-screen'), loadingProgress: q<HTMLSpanElement>('#loading-progress'), loadingPercent: q<HTMLDivElement>('#loading-percent'),
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), hand1Stat: q<HTMLSpanElement>('#hand1-stat'), orbit1Stat: q<HTMLSpanElement>('#orbit1-stat'), orbit2Stat: q<HTMLSpanElement>('#orbit2-stat'), orbit3Stat: q<HTMLSpanElement>('#orbit3-stat'),
  enemyAffinities: q<HTMLDivElement>('#enemy-affinities'),
  world: q<HTMLDivElement>('#world-ui'), toast: q<HTMLDivElement>('#toast'), gainStack: q<HTMLDivElement>('#gain-stack'), soulGainStack: q<HTMLDivElement>('#soul-gain-stack'),
  joystick: q<HTMLDivElement>('#joystick'), joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  spawnButton: q<HTMLButtonElement>('#spawn-button'),
  settingsButton: q<HTMLButtonElement>('#settings-button'), settingsPanel: q<HTMLDivElement>('#settings-panel'),
  settingsClose: q<HTMLButtonElement>('#settings-close'), rendererStatsOption: q<HTMLLabelElement>('#renderer-stats-option'),
  rendererStatsToggle: q<HTMLInputElement>('#renderer-stats-toggle'), rendererStats: q<HTMLOutputElement>('#renderer-stats'),
  resetAttributesButton: q<HTMLButtonElement>('#reset-attributes-button'),
  resetHeroButton: q<HTMLButtonElement>('#reset-hero-button'),
  resetSoulCatcherButton: q<HTMLButtonElement>('#reset-soul-catcher-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host'),
  inventoryButton: q<HTMLButtonElement>('#inventory-button'), inventoryPanel: q<HTMLDivElement>('#inventory-panel'),
  soulCatcherButton: q<HTMLButtonElement>('#soul-catcher-button'), soulCatcherPanel: q<HTMLDivElement>('#soul-catcher-panel'), soulCatcherClose: q<HTMLButtonElement>('#soul-catcher-close'),
  soulBalances: q<HTMLDivElement>('#soul-balances'), soulXp: q<HTMLDivElement>('#soul-xp'), soulLayerTabs: q<HTMLDivElement>('#soul-layer-tabs'), soulTreeViewport: q<HTMLDivElement>('#soul-tree-viewport'), soulTree: q<HTMLDivElement>('#soul-tree'), soulConnections: q<SVGElement>('#soul-connections'), soulNodes: q<HTMLDivElement>('#soul-nodes'), soulDetail: q<HTMLDivElement>('#soul-detail'),
  inventoryClose: q<HTMLButtonElement>('#inventory-close'), inventoryOverview: q<HTMLDivElement>('#inventory-overview'),
  inventorySummary: q<HTMLDivElement>('#inventory-summary'), inventoryEquipped: q<HTMLDivElement>('#inventory-equipped'),
  inventoryBag: q<HTMLDivElement>('#inventory-bag'), inventoryDetail: q<HTMLDivElement>('#inventory-detail'), equipmentDropLayer: q<HTMLDivElement>('#equipment-drop-layer'),
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
function showGain(amount: string, stat: string): void {
  const element = document.createElement('div');
  const healthStat = stat === 'HP' || stat === 'HP/S';
  const evasionStat = stat === 'EVASION';
  const gainIcon = stat === 'HP/S' ? heartRegenIcon(13) : stat === 'HP' ? heartIcon(13) : evasionStat ? evasionIcon(13) : bluntHammerIcon(13);
  element.className = `gain-pop ${healthStat ? 'hp' : evasionStat ? 'evasion' : 'blunt'}`;
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

function sourceLabel(source: string): string { return source.replace(/[_-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()); }
function renderBreakdown(label: string, stat: StatSources, suffix = '', decimals = false): string {
  const additiveTotal = statAdditiveTotal(stat), total = statTotal(stat);
  const format = (value: number): string => decimals ? value.toFixed(2) : Math.round(value).toLocaleString();
  const adds = Object.entries(stat.additive).filter(([, value]) => value !== 0).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>${format(v)}${suffix}</span></div>`).join('');
  const mults = Object.entries(stat.multiplicative).filter(([, value]) => value !== 1).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>x${format(v)}</span></div>`).join('');
  const base = stat.base !== 0 ? `<div class="stat-group-title">Base</div><div class="stat-line"><span>Base</span><span>${format(stat.base)}${suffix}</span></div>` : '';
  return `<section class="stat-breakdown"><div class="stat-row"><span>${label}</span><strong>${format(total)}${suffix}</strong></div>${base}${adds ? `<div class="stat-group-title">Additive</div>${adds}` : ''}<div class="stat-line stat-subtotal"><span>Total</span><span>${format(additiveTotal)}${suffix}</span></div>${mults ? `<div class="stat-group-title">Multiplicative</div>${mults}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${format(total)}${suffix}</strong></div></section>`;
}

export function renderStats(stats: PlayerStats): void {
  const maxHpLabel = `<span class="stat-title-with-icon">${heartIcon(14)} Max HP</span>`;
  const regenLabel = `<span class="stat-title-with-icon">${heartRegenIcon(14)} Health regeneration</span>`;
  const bluntLabel = `<span class="stat-title-with-icon">${bluntHammerIcon(14)} Blunt attack</span>`;
  const evasionRaw = Object.values(stats.evasion.raw).reduce((sum, value) => sum + value, 0);
  const evasionRawChance = rawEvasionChance(evasionRaw, EVASION_RAW_SCALE, EVASION_RAW_TARGET, EVASION_CHANCE_CAP);
  const evasionTotal = totalEvasionChance(evasionRawChance, Object.values(stats.evasion.directChance), EVASION_CHANCE_CAP);
  const percent = (chance: number): string => `${(chance * 100).toFixed(2)}%`;
  const rawSources = Object.entries(stats.evasion.raw).filter(([, value]) => value !== 0).map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>${value.toFixed(2)}</span></div>`).join('');
  const directSources = Object.entries(stats.evasion.directChance).filter(([, value]) => value !== 0).map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>+${percent(value)}</span></div>`).join('');
  const evasion = `<section class="stat-breakdown"><div class="stat-row"><span class="stat-title-with-icon">${evasionIcon(14)} Evasion</span><strong>${percent(evasionTotal)}</strong></div>${rawSources ? `<div class="stat-group-title">Raw Evasion</div>${rawSources}` : ''}<div class="stat-line stat-subtotal"><span>Raw total</span><span>${percent(evasionRawChance)}</span></div>${directSources ? `<div class="stat-group-title">Direct Evasion</div>${directSources}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${percent(evasionTotal)}</strong></div></section>`;
  const percentStat = (stat: StatSources): StatSources => ({ base: stat.base * 100, additive: Object.fromEntries(Object.entries(stat.additive).map(([key, value]) => [key, value * 100])), multiplicative: { ...stat.multiplicative } });
  const scaled = (label: string, stat: StatSources, baseline: number, suffix: string): string => `${renderBreakdown(`${label} (raw)`, stat, '', true)}<div class="stat-line stat-total"><span>Effective ${label.toLowerCase()}</span><strong>${logarithmicStat(statTotal(stat), baseline).toFixed(2)}${suffix}</strong></div>`;
  const effectiveSpeedMultiplier = heroSpeedMultiplier();
  const speed = `${renderBreakdown('Speed (raw)', stats.speed, '', true)}<div class="stat-line stat-subtotal"><span>Speed multiplier</span><strong>x${effectiveSpeedMultiplier.toFixed(2)}</strong></div><div class="stat-line stat-total"><span>Effective speed</span><strong>${(HERO_SPEED * effectiveSpeedMultiplier).toFixed(2)} m/s</strong></div>`;
  const soulDrop = (type: SoulType): [number, number] => { const purchased = SOUL_NODES.filter((node) => (save.soulCatcher.nodeLevels[node.id] ?? 0) > 0); const unlocked = type === 'common' || purchased.some((node) => node.reward.effects.some((effect) => effect.type === 'unlockSoulDrop' && effect.soulType === type)); const additions = purchased.reduce((sum, node) => sum + node.reward.effects.reduce((total, effect) => effect.type === 'soulDropAdditive' && effect.soulType === type ? total + effect.amountPerLevel * (save.soulCatcher.nodeLevels[node.id] ?? 0) : total, 0), 0); return [unlocked ? 1 : 0, additions]; };
  const souls = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as SoulType[]).map((type) => { const [base, additions] = soulDrop(type); return base + additions > 0 ? `<div class="stat-line"><span>${sourceLabel(type)}</span><strong>${base} base + ${additions} Soul Catcher</strong></div>` : ''; }).join('');
  ui.statsContent.innerHTML = [renderBreakdown(maxHpLabel, stats.maxHp), renderBreakdown(bluntLabel, stats.attack.blunt), renderBreakdown('Slash attack', stats.attack.slash), renderBreakdown('Piercing attack', stats.attack.piercing), renderBreakdown('Blunt defence', stats.defense.blunt), renderBreakdown('Slash defence', stats.defense.slash), renderBreakdown('Piercing defence', stats.defense.piercing), renderBreakdown('Blunt resistance', percentStat(stats.damageResistance.blunt), '%'), renderBreakdown('Slash resistance', percentStat(stats.damageResistance.slash), '%'), renderBreakdown('Piercing resistance', percentStat(stats.damageResistance.piercing), '%'), renderBreakdown(regenLabel, stats.regen, ' HP/s'), speed, scaled('Critical hit chance', stats.criticalChance, HERO_CRITICAL_CHANCE_PERCENT, '%'), scaled('Critical damage', stats.criticalDamage, HERO_CRITICAL_DAMAGE_PERCENT, '%'), scaled('Block chance', stats.blockChance, HERO_BLOCK_CHANCE_PERCENT, '%'), evasion, `<section class="stat-breakdown"><div class="stat-row"><span>Soul Drops</span></div>${souls}</section>`].join('');
}

const soulIcon = (type: SoulType): string => `<span class="soul-icon soul-${type}" aria-hidden="true"></span>`;
export function renderSoulCatcher(nodes: SoulNode[], edges: [string, string][], revealed: (id: string) => boolean, canPurchase: (id: string) => boolean, selectedId: string | null, currentLayer: number, layers: SoulLayerMetadata[]): void {
  const position = (node: SoulNode): [number, number] => { const angle = node.position.angleDeg * Math.PI / 180; const radius = node.position.radius * 92; return [360 + Math.cos(angle) * radius, 360 + Math.sin(angle) * radius]; };
  ui.soulBalances.innerHTML = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as SoulType[]).map((type) => `<div aria-label="${sourceLabel(type)} souls: ${save.soulCatcher.balances[type]}">${soulIcon(type)}<strong>${save.soulCatcher.balances[type]}</strong></div>`).join('');
  const next = layers.find((entry) => entry.layer === save.soulCatcher.highestUnlockedLayer + 1);
  const target = next?.unlockXp ?? null, previous = layers.find((entry) => entry.layer === save.soulCatcher.highestUnlockedLayer)?.unlockXp ?? 0;
  const progress = target === null ? 100 : Math.max(0, Math.min(100, (save.soulCatcher.xp - previous) / Math.max(1, target - previous) * 100));
  ui.soulXp.innerHTML = `<div><span>Soul Catcher XP</span><strong>${target === null ? 'MAX LAYER' : `${save.soulCatcher.xp.toLocaleString()} / ${target.toLocaleString()}`}</strong></div><div class="soul-xp-track"><span style="width:${progress}%"></span></div>`;
  ui.soulLayerTabs.innerHTML = layers.map((entry) => `<button type="button" data-soul-layer="${entry.layer}" class="${entry.layer === currentLayer ? 'current' : ''}" ${entry.layer > save.soulCatcher.highestUnlockedLayer ? 'disabled' : ''}>${entry.layer > save.soulCatcher.highestUnlockedLayer ? '🔒 ' : ''}Layer ${entry.layer}</button>`).join('');
  const authored = layers.find((entry) => entry.layer === currentLayer)?.authored;
  ui.soulTreeViewport.hidden = !authored; ui.soulDetail.hidden = !authored;
  if (!authored) { ui.soulDetail.hidden = false; ui.soulDetail.innerHTML = '<p class="soul-placeholder">Feature is coming soon!</p>'; ui.soulConnections.innerHTML = ''; ui.soulNodes.innerHTML = ''; return; }
  ui.soulConnections.innerHTML = edges.map(([a, b]) => { const [x1,y1] = position(nodes.find((n) => n.id === a)!); const [x2,y2] = position(nodes.find((n) => n.id === b)!); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${revealed(a) && revealed(b) ? 'revealed' : ''}"/>`; }).join('');
  ui.soulNodes.innerHTML = nodes.map((node) => { const [x,y] = position(node), isRevealed = revealed(node.id), level = save.soulCatcher.nodeLevels[node.id] ?? 0, purchasable = canPurchase(node.id); return `<button type="button" class="soul-node ${isRevealed ? 'revealed' : 'mystery'} ${level ? 'purchased' : ''} ${purchasable ? 'purchasable' : ''} ${selectedId === node.id ? 'selected' : ''}" style="left:${x}px;top:${y}px" data-soul-node="${isRevealed ? node.id : ''}">${isRevealed ? `<span class="soul-node-icon">${soulIcon(node.cost.soulType)}</span>${purchasable ? '<span class="soul-upgrade">↑</span>' : ''}<span class="soul-level">${level}/${node.maxLevel}</span>` : '?'}</button>`; }).join('');
  const node = nodes.find((candidate) => candidate.id === selectedId);
  if (!node || !revealed(node.id)) { ui.soulDetail.innerHTML = '<p>Select a revealed node to inspect it.</p>'; return; }
  const level = save.soulCatcher.nodeLevels[node.id] ?? 0, maxed = level >= node.maxLevel, cost = soulCost(node, level + 1);
  ui.soulDetail.innerHTML = `<div><small>${node.id}</small><h3>${node.name}</h3><strong>Level ${level} / ${node.maxLevel}</strong><p>${node.reward.display}</p></div><button type="button" data-purchase-soul="${node.id}" ${!canPurchase(node.id) ? 'disabled' : ''}>${maxed ? 'MAX LEVEL' : `Purchase · ${cost} ${soulIcon(node.cost.soulType)}`}</button>`;
}

export function showSoulDrop(quantity: number, type: SoulType): void {
  const element = document.createElement('div'); element.className = 'gain-pop soul-gain'; element.innerHTML = `<strong>+${quantity}</strong>${soulIcon(type)}`;
  ui.soulGainStack.append(element); window.setTimeout(() => { element.classList.add('leaving'); window.setTimeout(() => element.remove(), 180); }, 1600);
}

const SLOT_LABELS: Record<EquipmentSlotId, string> = { hand1: 'Weapon', orbit1: 'Orbit 1', orbit2: 'Orbit 2', orbit3: 'Orbit 3', helmet: 'Helmet', armor: 'Armor', legs: 'Legs', ring: 'Ring' };
const SLOT_ORDER: EquipmentSlotId[] = ['hand1', 'orbit1', 'orbit2', 'orbit3', 'helmet', 'armor', 'legs', 'ring'];
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'] as const;
const DAMAGE_TYPE_ORDER = ['blunt', 'slash', 'piercing'] as const;
const formatInventoryValue = (value: number): string => value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(value % 1 ? 1 : 0);

function sortInventoryItems(items: OwnedEquipment[]): OwnedEquipment[] {
  return items.sort((left, right) => {
    const leftItem = EQUIPMENT_BY_ID.get(left.itemId), rightItem = EQUIPMENT_BY_ID.get(right.itemId);
    const rarityDifference = RARITY_ORDER.indexOf(leftItem?.rarity ?? 'common') - RARITY_ORDER.indexOf(rightItem?.rarity ?? 'common');
    if (rarityDifference) return rarityDifference;
    const typeDifference = DAMAGE_TYPE_ORDER.indexOf(leftItem?.damageType ?? 'blunt') - DAMAGE_TYPE_ORDER.indexOf(rightItem?.damageType ?? 'blunt');
    return typeDifference || (leftItem?.name ?? left.itemId).localeCompare(rightItem?.name ?? right.itemId);
  });
}

export function renderInventory(inventory: InventoryState, summary: InventoryCombatSummary): void {
  const primary = [
    ['Total attack', '⚔', summary.totalAttack],
    ['Max HP', heartIcon(23), summary.maxHp],
    ['HP regeneration', heartRegenIcon(23), summary.regenPerSecond]
  ] as const;
  const damageTypes = ['blunt', 'slash', 'piercing'] as const;
  const affinityRow = (defense: boolean): string => damageTypes.map((type) => `<div class="inventory-affinity" aria-label="${type} ${defense ? 'defence' : 'attack'}: ${formatInventoryValue(defense ? summary.defenseByType[type] : summary.attackByType[type])}">${defense ? damageTypeDefenseIcon(type, 17) : damageTypeIcon(type, 15)}<strong>${formatInventoryValue(defense ? summary.defenseByType[type] : summary.attackByType[type])}</strong><small>${defense ? 'DEF' : 'ATK'}</small></div>`).join('');
  ui.inventorySummary.innerHTML = `<div class="inventory-primary-stats">${primary.map(([label, icon, value]) => `<div class="inventory-primary-stat" aria-label="${label}: ${formatInventoryValue(value)}"><span aria-hidden="true">${icon}</span><strong>${formatInventoryValue(value)}</strong><small>${label}</small></div>`).join('')}</div><div class="inventory-affinities">${affinityRow(false)}${affinityRow(true)}</div>`;

  ui.inventoryEquipped.innerHTML = SLOT_ORDER.map((slot) => {
    const itemId = inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const owned = itemId ? inventory.items[itemId] : undefined;
    const art = item && owned ? equipmentIcon(item, owned, 'slot') ?? damageTypeIcon(item.damageType, 25) : '<strong>+</strong>';
    return `<button class="inventory-equip-slot" type="button" data-slot="${slot}"${itemId ? ` data-item-id="${itemId}"` : ''} aria-label="${SLOT_LABELS[slot]}${item ? `, ${item.name}` : ', empty'}"><span>${SLOT_LABELS[slot]}</span>${art}</button>`;
  }).join('');
  ui.quickSlots.forEach((slotEl) => {
    const slot = slotEl.dataset.slot as EquipmentSlotId;
    const itemId = inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    slotEl.innerHTML = item ? `<span>${SLOT_LABELS[slot]}</span>${damageTypeIcon(item.damageType, 19)}` : `<span>${SLOT_LABELS[slot]}</span>`;
  });
  const equippedItemIds = new Set(Object.values(inventory.equipped));
  const items = Object.values(inventory.items).filter((owned) => !equippedItemIds.has(owned.itemId));
  const section = (title: string, sectionItems: OwnedEquipment[]): string => sectionItems.length ? `<section class="inventory-bag-section"><h3>${title}</h3><div class="inventory-bag-grid">${sortInventoryItems(sectionItems).map((owned) => {
    const item = EQUIPMENT_BY_ID.get(owned.itemId);
    const itemArt = item ? equipmentIcon(item, owned, 'bag') : null;
    return `<button class="inventory-item rarity-${item?.rarity ?? 'common'}${itemArt ? ' equipment-item' : ''}" type="button" data-item-id="${owned.itemId}" aria-label="${item?.name ?? owned.itemId}, level ${owned.level}, ascend ${owned.ascend}">${itemArt ?? damageTypeIcon(item?.damageType ?? 'blunt', 27)}</button>`;
  }).join('')}</div></section>` : '';
  const weapons = items.filter((owned) => EQUIPMENT_BY_ID.get(owned.itemId)?.kind === 'weapon');
  const armor = items.filter((owned) => EQUIPMENT_BY_ID.get(owned.itemId)?.kind === 'armor');
  const armorClass = (kind: 'helmet' | 'armor' | 'boots'): OwnedEquipment[] => armor.filter(({ itemId }) => { const item = EQUIPMENT_BY_ID.get(itemId); return item?.kind === 'armor' && item.armorClass === kind; });
  ui.inventoryBag.innerHTML = items.length ? section('Weapons', weapons) + section('Helmets', armorClass('helmet')) + section('Armor', armorClass('armor')) + section('Legs', armorClass('boots')) : '<div class="inventory-empty">No equipment found yet.</div>';
}

let progressionTimer: number | null = null;
export function showBossProgression(bossName: string, destinationName?: string): void {
  if (progressionTimer !== null) window.clearTimeout(progressionTimer);
  ui.progressionLayer.innerHTML = `<div class="progression-banner"><span class="progression-kicker">Boss defeated</span><strong>${bossName}</strong>${destinationName ? `<span class="progression-route">Route opened · ${destinationName}</span>` : ''}</div>`;
  progressionTimer = window.setTimeout(() => { ui.progressionLayer.innerHTML = ''; progressionTimer = null; }, 3200);
}

export function renderItemDetail(owned: OwnedEquipment | null): void {
  const item = owned ? EQUIPMENT_BY_ID.get(owned.itemId) : undefined;
  if (!owned || !item) { ui.inventoryDetail.innerHTML = ''; return; }
  const equipped = (Object.keys(save.inventory.equipped) as EquipmentSlotId[]).find((slot) => save.inventory.equipped[slot] === item.id);
  const value = item.kind === 'weapon' ? equipmentDamage(item, owned) : equipmentDefense(item, owned);
  const perLevel = equipmentValuePerLevel(item, owned);
  const afterAscend = equipmentAscendValue(item, owned);
  const copiesRequired = ascendCopies(item.rarity);
  const label = item.kind === 'weapon' ? 'Damage' : 'Defense';
  const itemClass = item.kind === 'weapon' ? item.weaponClass : item.armorClass === 'boots' ? 'legs' : item.armorClass;
  const itemArt = equipmentIcon(item, owned, 'detail') ?? damageTypeIcon(item.damageType, 52);
  const weaponSlots = (['hand1', 'orbit1', 'orbit2', 'orbit3'] as const).filter((slot) => slot !== 'orbit1' || save.unlockedAreas.includes(2));
  const slotPicker = item.kind === 'weapon' && !equipped ? `<div class="inventory-slot-picker" hidden data-slot-picker><span>Choose a weapon slot</span><div>${weaponSlots.map((slot) => `<button type="button" data-equip-slot="${slot}" data-item-id="${item.id}"><strong>${SLOT_LABELS[slot]}</strong><small>${save.inventory.equipped[slot] ? 'Replace' : 'Empty'}</small></button>`).join('')}</div></div>` : '';
  ui.inventoryDetail.innerHTML = `<button class="inventory-back" type="button" data-inventory-back>← Overview</button><div class="item-detail-hero"><div class="weapon-art rarity-${item.rarity}">${itemArt}</div><h3>${item.name}</h3><div class="weapon-meta">${item.rarity} · ${itemClass} · ${damageTypeIcon(item.damageType, 12)} ${item.damageType}</div><strong>Level ${owned.level} · Ascend ${owned.ascend}</strong></div><div class="weapon-values"><span>${label}<strong>${formatInventoryValue(value)}</strong></span><span>Per level<strong>+${formatInventoryValue(perLevel)}</strong></span>${item.kind === 'weapon' ? `<span>Cooldown<strong>${item.attackCooldownSeconds}s</strong></span>` : ''}<span>Type<strong>${damageTypeIcon(item.damageType, 13)} ${item.damageType}</strong></span></div><section class="item-power"><small>Special power</small><p>${owned.ascend === 0 ? 'Hidden power will be unlocked upon Ascend' : 'Power unlocked · ability coming soon'}</p></section><section class="ascend-preview"><small>Ascend</small>${afterAscend === null ? `<p>Ascend at ${copiesRequired} copies · ${copiesRequired - owned.level} remaining</p>` : `<p>${label} <strong>${formatInventoryValue(value)} → ${formatInventoryValue(afterAscend)}</strong></p>`}</section>${slotPicker}<div class="weapon-actions">${equipped ? `<button data-unequip="${equipped}" data-item-id="${item.id}">Unequip</button>` : `<button data-equip data-item-id="${item.id}">Equip</button>`}<button data-ascend data-item-id="${item.id}" ${owned.level < copiesRequired ? 'disabled' : ''}>Ascend</button></div>`;
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
    const copiesRequired = ascendCopies(item.rarity);
    ui.equipmentDropLayer.innerHTML = `<div class="equipment-drop rarity-${item.rarity}"><div class="equipment-drop-icon">${equipmentIcon(item, { itemId: item.id, level: next.newLevel, ascend: next.ascend }, 'detail') ?? damageTypeIcon(item.damageType, 48)}</div><div class="equipment-drop-copy"><b>${item.name}</b><strong>+${next.quantity} ${next.quantity === 1 ? 'copy' : 'copies'} <span>(${next.newLevel}/${copiesRequired})</span></strong></div></div>`;
    window.setTimeout(() => { ui.equipmentDropLayer.innerHTML = ''; showingDrop = false; showNext(); }, 3600);
  };
  showNext();
}

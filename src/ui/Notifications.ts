import { ui } from './elements';
import { Lifetime } from './Lifetime';
import { heartIcon, heartRegenIcon, evasionIcon, damageTypeIcon } from '../icons';
import type { SoulType } from '../types';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { equipmentIcon } from '../equipment-icons';
import { soulIcon } from './panels/PanelFormatting';
let notificationLifetime = new Lifetime();
export function disposeNotifications(): void {
  notificationLifetime.dispose(); notificationLifetime = new Lifetime();
  gainItems.splice(0).forEach((item) => item.remove()); dropQueue.length = 0; showingDrop = false;
  ui.soulGainStack.replaceChildren(); ui.equipmentDropLayer.replaceChildren(); ui.progressionLayer.replaceChildren();
  ui.toast.classList.remove('visible'); toastTimer = null; progressionTimer = null;
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
  notificationLifetime.frame(() => { layoutGainItems(); element.style.opacity = '1'; });
  notificationLifetime.timeout(() => { const index = gainItems.indexOf(element); if (index >= 0) gainItems.splice(index, 1); element.classList.add('leaving'); layoutGainItems(); notificationLifetime.timeout(() => element.remove(), 180); }, 1600);
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
  toastTimer = notificationLifetime.timeout(() => ui.toast.classList.remove('visible'), 1500);
}

export function showSoulDrop(quantity: number, type: SoulType): void {
  const element = document.createElement('div'); element.className = 'gain-pop soul-gain'; element.innerHTML = `<strong>+${quantity}</strong>${soulIcon(type)}`;
  ui.soulGainStack.append(element); notificationLifetime.timeout(() => { element.classList.add('leaving'); notificationLifetime.timeout(() => element.remove(), 180); }, 1600);
}

let progressionTimer: number | null = null;
export function showBossProgression(bossName: string, destinationName?: string): void {
  if (progressionTimer !== null) window.clearTimeout(progressionTimer);
  ui.progressionLayer.innerHTML = `<div class="progression-banner"><span class="progression-kicker">Boss defeated</span><strong>${bossName}</strong>${destinationName ? `<span class="progression-route">Route opened · ${destinationName}</span>` : ''}</div>`;
  progressionTimer = notificationLifetime.timeout(() => { ui.progressionLayer.innerHTML = ''; progressionTimer = null; }, 3200);
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
    notificationLifetime.timeout(() => { ui.equipmentDropLayer.innerHTML = ''; showingDrop = false; showNext(); }, 3600);
  };
  showNext();
}

import './reward-popups.css';
import { ui } from './ui/elements';
import { combatAffinityIcon } from './icons';
import type { AreaDefinition } from './types';
export { ui } from './ui/elements';
export { renderStats } from './ui/panels/StatsPanel';
export { renderMinions, updateMinionCountdown } from './ui/panels/MinionsPanel';
export { renderSoulCatcher } from './ui/panels/SoulCatcherPanel';
export { renderInventory, renderItemDetail, renderProgressionHud } from './ui/panels/InventoryPanel';
export { showStatGain, showToast, showSoulDrop, showBossProgression, showEquipmentDrop, disposeNotifications } from './ui/Notifications';

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

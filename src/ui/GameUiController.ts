import type { EquipmentSlotId } from '../types';
import type { GameSession } from '../game/GameSession';
import type { RenderingQualitySettings } from '../rendering/RenderingQuality';
import { confirmReset, renderInventory, renderItemDetail, renderProgressionHud, renderSoulCatcher, renderStats, showToast, ui } from '../ui';

/** HTML interaction only. Panels never change the simulation or render loop. */
export function mountGameUi(session: GameSession, quality: { current: () => RenderingQualitySettings; apply: (next: RenderingQualitySettings) => void }, updateHud: () => void): void {
const { commands, events } = session;
const readSnapshot = (): ReturnType<GameSession['progressionSnapshot']> => session.progressionSnapshot();
const refreshStats = (): void => renderStats(readSnapshot());
function setStatsPanel(open: boolean): void {
  if (open) closeOtherPanels('stats');
  ui.statsPanel.classList.toggle('visible', open);
  ui.statsPanel.setAttribute('aria-hidden', String(!open));
  if (open) refreshStats();
}
function closeOtherPanels(except: 'stats' | 'inventory' | 'settings' | 'soul'): void {
  for (const [name, panel] of [['stats', ui.statsPanel], ['inventory', ui.inventoryPanel], ['settings', ui.settingsPanel], ['soul', ui.soulCatcherPanel]] as const) {
    if (name === except) continue;
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }
}
function setInventoryPanel(open: boolean): void {
  if (open) closeOtherPanels('inventory');
  ui.inventoryPanel.classList.toggle('visible', open);
  ui.inventoryPanel.setAttribute('aria-hidden', String(!open));
  if (open) { showInventoryOverview(0); renderInventory(readSnapshot()); }
}
function renderQualityControls(): void {
  const scale = ui.renderScaleInputs.find((input) => input.value === String(quality.current().renderScale));
  const frameRate = ui.frameRateInputs.find((input) => input.value === String(quality.current().frameRateLimit));
  if (scale) scale.checked = true;
  if (frameRate) frameRate.checked = true;
  ui.rendererStatsToggle.checked = quality.current().showStats;
  ui.rendererStatsOption.hidden = !import.meta.env.DEV;
  ui.rendererStats.classList.toggle('visible', import.meta.env.DEV && quality.current().showStats);
}
function setSettingsPanel(open: boolean): void {
  if (open) closeOtherPanels('settings');
  ui.settingsPanel.classList.toggle('visible', open);
  ui.settingsPanel.setAttribute('aria-hidden', String(!open));
  if (open) renderQualityControls();
}
ui.statsButton.addEventListener('click', () => setStatsPanel(true));
ui.spawnButton.addEventListener('click', () => { const count = session.resetSpawnCooldowns(); showToast(count ? `Spawned ${count} targets` : 'No spawn cooldowns active'); });
ui.statsClose.addEventListener('click', () => setStatsPanel(false));
ui.statsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.statsPanel) setStatsPanel(false); });
ui.inventoryButton.addEventListener('click', () => setInventoryPanel(true));
ui.inventoryClose.addEventListener('click', () => setInventoryPanel(false));
ui.inventoryPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.inventoryPanel) setInventoryPanel(false); });
let selectedSoulNode: string | null = null;
let selectedSoulLayer = 1;
const refreshSoulTree = (): void => renderSoulCatcher(readSnapshot(), selectedSoulNode, selectedSoulLayer);
function setSoulCatcherPanel(open: boolean): void {
  if (open && !readSnapshot().soulCatcher.available) { showToast('Defeat area 2 boss to unlock Soul Catcher'); return; }
  if (open) closeOtherPanels('soul');
  ui.soulCatcherPanel.classList.toggle('visible', open); ui.soulCatcherPanel.setAttribute('aria-hidden', String(!open));
  if (open) refreshSoulTree();
}
ui.soulCatcherButton.addEventListener('click', () => setSoulCatcherPanel(true));
ui.soulCatcherClose.addEventListener('click', () => setSoulCatcherPanel(false));
ui.soulCatcherPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.soulCatcherPanel) setSoulCatcherPanel(false); });
ui.soulLayerTabs.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-soul-layer]'); const layer = Number(button?.dataset.soulLayer); if (!layer || !readSnapshot().soulCatcher.layers.find((entry) => entry.layer === layer)?.unlocked) return; selectedSoulLayer = layer; selectedSoulNode = null; refreshSoulTree(); });
ui.soulNodes.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-soul-node]'); if (!button?.dataset.soulNode) return; selectedSoulNode = button.dataset.soulNode; refreshSoulTree(); });
ui.soulDetail.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-purchase-soul]'); if (!button?.dataset.purchaseSoul) return; if (commands.execute({ type: 'purchaseSoulNode', nodeId: button.dataset.purchaseSoul })) { updateHud(); } });
const treePointers = new Map<number, { x: number; y: number }>();
let treeX = -170, treeY = -190, treeScale = 1, pinchDistance = 0;
const transformTree = (): void => { ui.soulTree.style.transform = `translate(${treeX}px,${treeY}px) scale(${treeScale})`; };
ui.soulTreeViewport.addEventListener('pointerdown', (event) => { treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); ui.soulTreeViewport.setPointerCapture(event.pointerId); });
ui.soulTreeViewport.addEventListener('pointermove', (event) => {
  const previous = treePointers.get(event.pointerId); if (!previous) return;
  treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = [...treePointers.values()];
  if (points.length === 1) { treeX += event.clientX - previous.x; treeY += event.clientY - previous.y; }
  else { const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (pinchDistance) treeScale = Math.max(.55, Math.min(1.6, treeScale * distance / pinchDistance)); pinchDistance = distance; }
  transformTree();
});
const endTreePointer = (event: PointerEvent): void => { treePointers.delete(event.pointerId); pinchDistance = 0; };
ui.soulTreeViewport.addEventListener('lostpointercapture', endTreePointer); ui.soulTreeViewport.addEventListener('pointerup', endTreePointer); ui.soulTreeViewport.addEventListener('pointercancel', endTreePointer); transformTree();
ui.settingsButton.addEventListener('click', () => setSettingsPanel(true));
ui.settingsClose.addEventListener('click', () => setSettingsPanel(false));
ui.settingsPanel.addEventListener('pointerdown', (event) => { if (event.target === ui.settingsPanel) setSettingsPanel(false); });
ui.resetAttributesButton.addEventListener('click', async () => {
  if (!await confirmReset('Reset all permanent hero attributes? Your equipment and its progress will be kept.')) return;
  commands.execute({ type: 'resetHero', equipment: false });
  updateHud();
  showToast('Permanent attributes reset · equipment kept');
});
ui.resetHeroButton.addEventListener('click', async () => {
  if (!await confirmReset('Reset all permanent hero attributes and equipment drops? World progression will be kept.')) return;
  commands.execute({ type: 'resetHero', equipment: true });
  updateHud();
  showToast('Hero reset · attributes and equipment drops removed');
});
ui.resetSoulCatcherButton.addEventListener('click', async () => { if (!await confirmReset('Reset all Soul balances and purchased Soul Catcher nodes?')) return; commands.execute({ type: 'resetSoulCatcher' }); selectedSoulNode = null; selectedSoulLayer = 1; updateHud(); showToast('Soul Catcher reset'); });
ui.settingsPanel.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === 'render-scale') quality.apply({ ...quality.current(), renderScale: input.value === '0.7' ? 0.7 : 1 });
  if (input.name === 'frame-rate') quality.apply({ ...quality.current(), frameRateLimit: input.value === '30' ? 30 : 60 });
  if (input === ui.rendererStatsToggle) quality.apply({ ...quality.current(), showStats: input.checked });
});
type InventoryViewState =
  | { view: 'overview'; scrollTop: number }
  | { view: 'detail'; itemId: string; overviewScrollTop: number };
let inventoryView: InventoryViewState = { view: 'overview', scrollTop: 0 };
const inventoryScroller = ui.inventoryScroller;

function showInventoryOverview(scrollTop: number): void {
  inventoryView = { view: 'overview', scrollTop };
  ui.inventoryOverview.hidden = false;
  ui.inventoryDetail.hidden = true;
  requestAnimationFrame(() => { inventoryScroller.scrollTop = scrollTop; });
}
function showInventoryDetail(itemId: string): void {
  const overviewScrollTop = inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : inventoryScroller.scrollTop;
  inventoryView = { view: 'detail', itemId, overviewScrollTop };
  renderItemDetail(readSnapshot(), itemId);
  ui.inventoryOverview.hidden = true;
  ui.inventoryDetail.hidden = false;
  inventoryScroller.scrollTop = 0;
}

ui.inventoryBag.addEventListener('click', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
});
ui.inventoryEquipped.addEventListener('click', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
  if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
});
ui.inventoryDetail.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.hasAttribute('data-inventory-back')) {
    showInventoryOverview(inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : 0);
    return;
  }
  const itemId = button.dataset.itemId;
  if (!itemId) return;
  let equipmentChanged = false;
  if (button.hasAttribute('data-equip')) {
    const entry = readSnapshot().equipment.items[itemId];
    if (!entry) return;
    if (entry.autoEquipSlot) { equipmentChanged = commands.execute({ type: 'equip', itemId, slot: entry.autoEquipSlot }); }
    else { ui.inventorySlotPicker()!.hidden = false; return; }
  }
  if (button.dataset.equipSlot) { commands.execute({ type: 'equip', itemId, slot: button.dataset.equipSlot as EquipmentSlotId }); equipmentChanged = true; }
  if (button.dataset.unequip) { commands.execute({ type: 'unequip', slot: button.dataset.unequip as EquipmentSlotId }); equipmentChanged = true; }
  if (button.hasAttribute('data-ascend')) commands.execute({ type: 'ascend', itemId });
  updateHud();
  if (equipmentChanged) showInventoryOverview(inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : 0);
});


// Coalesce consequences of one command/defeat into one detached snapshot.
let refreshScheduled = false;
const refreshProgression = (): void => {
  if (refreshScheduled) return;
  refreshScheduled = true;
  requestAnimationFrame(() => {
    refreshScheduled = false;
    const snapshot = readSnapshot();
    renderProgressionHud(snapshot);
    if (!snapshot.soulCatcher.layers.find((layer) => layer.layer === selectedSoulLayer)?.unlocked) { selectedSoulLayer = 1; selectedSoulNode = null; }
    if (ui.statsPanel.classList.contains('visible')) renderStats(snapshot);
    if (ui.inventoryPanel.classList.contains('visible')) renderInventory(snapshot);
    if (ui.inventoryPanel.classList.contains('visible') && inventoryView.view === 'detail') {
      if (snapshot.equipment.items[inventoryView.itemId]) renderItemDetail(snapshot, inventoryView.itemId);
      else showInventoryOverview(inventoryView.overviewScrollTop);
    }
    if (ui.soulCatcherPanel.classList.contains('visible')) renderSoulCatcher(snapshot, selectedSoulNode, selectedSoulLayer);
  });
};
for (const event of ['statGained', 'equipmentEquipped', 'equipmentUnequipped', 'weaponAscended', 'heroProgressReset', 'equipmentDropped', 'soulDropped', 'soulNodePurchased', 'soulCatcherReset', 'soulCatcherXpGained', 'soulCatcherLayerUnlocked', 'soulCatcherUnlocked', 'gateUnlocked', 'bossDefeated'] as const) events.on(event, refreshProgression);
renderQualityControls();
renderProgressionHud(readSnapshot());
}

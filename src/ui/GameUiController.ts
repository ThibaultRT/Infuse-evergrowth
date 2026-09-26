import { Lifetime } from './Lifetime';
import { disposeNotifications } from './Notifications';
import type { EquipmentSlotId } from '../types';
import type { GameSession } from '../game/GameSession';
import type { RenderingQualitySettings } from '../rendering/RenderingQuality';
import { confirmReset, renderInventory, renderItemDetail, renderMinions, renderProgressionHud, renderSoulCatcher, renderStats, showToast, ui, updateMinionCountdown } from '../ui';

/** HTML interaction only. Panels never change the simulation or render loop. */
export function mountGameUi(session: GameSession, quality: { current: () => RenderingQualitySettings; apply: (next: RenderingQualitySettings) => void },
  idle: { enabled: () => boolean; setEnabled: (enabled: boolean) => void }, updateHud: () => void): () => void {
  const lifetime = new Lifetime();
  const { commands, events } = session;
  const readSnapshot = (): ReturnType<GameSession['progressionSnapshot']> => session.progressionSnapshot();
  const refreshStats = (): void => renderStats(readSnapshot());
  let minionCountdownTimer: number | null = null;
  function setStatsPanel(open: boolean): void {
    if (open) closeOtherPanels('stats');
    ui.statsPanel.classList.toggle('visible', open);
    ui.statsPanel.setAttribute('aria-hidden', String(!open));
    if (open) refreshStats();
  }
  function closeOtherPanels(except: 'stats' | 'inventory' | 'settings' | 'soul' | 'minions'): void {
    for (const [name, panel] of [['stats', ui.statsPanel], ['inventory', ui.inventoryPanel], ['settings', ui.settingsPanel], ['soul', ui.soulCatcherPanel], ['minions', ui.minionPanel]] as const) {
      if (name === except) continue;
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
      if (name === 'minions' && minionCountdownTimer !== null) { window.clearInterval(minionCountdownTimer); minionCountdownTimer = null; }
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
    if (ui.minionAntiIdleToggle) ui.minionAntiIdleToggle.checked = idle.enabled();
    ui.rendererStatsOption.hidden = !import.meta.env.DEV;
    ui.rendererStats.classList.toggle('visible', import.meta.env.DEV && quality.current().showStats);
  }
  function setSettingsPanel(open: boolean): void {
    if (open) closeOtherPanels('settings');
    ui.settingsPanel.classList.toggle('visible', open);
    ui.settingsPanel.setAttribute('aria-hidden', String(!open));
    if (open) renderQualityControls();
  }
  lifetime.listen(ui.statsButton, 'click', () => setStatsPanel(true));
  lifetime.listen(ui.spawnButton, 'click', () => { const count = session.resetSpawnCooldowns(); showToast(count ? `Spawned ${count} targets` : 'No spawn cooldowns active'); });
  lifetime.listen(ui.debugUnlockMinions, 'click', () => {
    if (commands.execute({ type: 'debugUnlockMinions' })) { updateHud(); showToast('Minions unlocked'); }
  });
  lifetime.listen(ui.statsClose, 'click', () => setStatsPanel(false));
  lifetime.listen(ui.statsPanel, 'pointerdown', (event) => { if (event.target === ui.statsPanel) setStatsPanel(false); });
  lifetime.listen(ui.inventoryButton, 'click', () => setInventoryPanel(true));
  lifetime.listen(ui.inventoryClose, 'click', () => setInventoryPanel(false));
  lifetime.listen(ui.inventoryPanel, 'pointerdown', (event) => { if (event.target === ui.inventoryPanel) setInventoryPanel(false); });
  let selectedSoulNode: string | null = null;
  let selectedSoulLayer = 1;
  const refreshSoulTree = (): void => renderSoulCatcher(readSnapshot(), selectedSoulNode, selectedSoulLayer);
  function setSoulCatcherPanel(open: boolean): void {
    if (open && !readSnapshot().soulCatcher.available) { showToast('Defeat area 2 boss to unlock Soul Catcher'); return; }
    if (open) closeOtherPanels('soul');
    ui.soulCatcherPanel.classList.toggle('visible', open); ui.soulCatcherPanel.setAttribute('aria-hidden', String(!open));
    if (open) refreshSoulTree();
  }
  lifetime.listen(ui.soulCatcherButton, 'click', () => setSoulCatcherPanel(true));
  lifetime.listen(ui.soulCatcherClose, 'click', () => setSoulCatcherPanel(false));
  lifetime.listen(ui.soulCatcherPanel, 'pointerdown', (event) => { if (event.target === ui.soulCatcherPanel) setSoulCatcherPanel(false); });
  function setMinionPanel(open: boolean): void {
    if (open && !readSnapshot().minions.hasUnlockedSlots) return;
    if (open) closeOtherPanels('minions');
    ui.minionPanel.classList.toggle('visible', open);
    ui.minionPanel.setAttribute('aria-hidden', String(!open));
    if (minionCountdownTimer !== null) { window.clearInterval(minionCountdownTimer); minionCountdownTimer = null; }
    if (open) { renderMinions(readSnapshot()); minionCountdownTimer = window.setInterval(() => updateMinionCountdown(), 1000); }
  }
  lifetime.listen(ui.minionPitButton, 'click', () => setMinionPanel(true));
  lifetime.listen(ui.minionClose, 'click', () => setMinionPanel(false));
  lifetime.listen(ui.minionPanel, 'pointerdown', (event) => { if (event.target === ui.minionPanel) setMinionPanel(false); });
  lifetime.listen(ui.minionCards, 'click', async (event) => {
    const target = event.target as HTMLElement;
    const summon = target.closest<HTMLButtonElement>('[data-summon-slot]');
    if (summon) {
      const slotId = Number(summon.dataset.summonSlot);
      if ((slotId === 1 || slotId === 2 || slotId === 3) && commands.execute({ type: 'summonMinion', slotId })) { updateHud(); showToast(`Imp summoned in slot ${slotId}`); }
      return;
    }
    const sacrifice = target.closest<HTMLButtonElement>('[data-sacrifice-minion]');
    const minion = readSnapshot().minions.roster.find((entry) => entry.id === sacrifice?.dataset.sacrificeMinion);
    if (!minion) return;
    const { stats, copies } = minion.infusionPreview;
    const colorName = { 'variant-1': 'red', 'variant-2': 'violet', 'variant-3': 'amber' }[minion.color];
    const gains = Object.entries(stats).filter(([, value]) => value > 0).map(([name, value]) => `${value.toLocaleString()} ${name}`).join(', ') || 'no stats yet';
    const equipment = Object.entries(copies).map(([id, count]) => `${count} ${id}`).join(', ') || 'no equipment yet';
    const confirmed = await confirmReset(`Permanently sacrifice the ${colorName} Imp ${minion.id} in slot ${minion.slotId}, including if it is awaiting respawn? The hero receives ${gains} and ${equipment}. Souls were already credited. This cannot be undone.`, 'Sacrifice');
    if (!lifetime.disposed && confirmed && commands.execute({ type: 'sacrificeMinion', minionId: minion.id })) { updateHud(); showToast(`Imp in slot ${minion.slotId} infused into the hero`); }
  });
  lifetime.listen(ui.soulLayerTabs, 'click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-soul-layer]'); const layer = Number(button?.dataset.soulLayer); if (!layer || !readSnapshot().soulCatcher.layers.find((entry) => entry.layer === layer)?.unlocked) return; selectedSoulLayer = layer; selectedSoulNode = null; refreshSoulTree(); });
  lifetime.listen(ui.soulNodes, 'click', (event) => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-soul-node]'); if (!button?.dataset.soulNode) return; selectedSoulNode = button.dataset.soulNode; refreshSoulTree(); });
  lifetime.listen(ui.soulDetail, 'click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-purchase-soul]'); if (!button?.dataset.purchaseSoul) return; if (commands.execute({ type: 'purchaseSoulNode', nodeId: button.dataset.purchaseSoul })) { updateHud(); } });
  const treePointers = new Map<number, { x: number; y: number; startX: number; startY: number; dragging: boolean }>();
  let treeX = -170, treeY = -190, treeScale = 1, pinchDistance = 0;
  const transformTree = (): void => { ui.soulTree.style.transform = `translate(${treeX}px,${treeY}px) scale(${treeScale})`; };
  const captureTreePointer = (pointerId: number): void => { if (!ui.soulTreeViewport.hasPointerCapture(pointerId)) ui.soulTreeViewport.setPointerCapture(pointerId); };
  lifetime.listen(ui.soulTreeViewport, 'pointerdown', (event) => {
    treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragging: false });
    if (treePointers.size > 1) {
      for (const [pointerId, pointer] of treePointers) { pointer.dragging = true; captureTreePointer(pointerId); }
      const [first, second] = [...treePointers.values()];
      pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
    } else if (!(event.target as Element).closest('[data-soul-node]')) captureTreePointer(event.pointerId);
  });
  lifetime.listen(ui.soulTreeViewport, 'pointermove', (event) => {
    const previous = treePointers.get(event.pointerId); if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    previous.x = event.clientX; previous.y = event.clientY;
    const points = [...treePointers.values()];
    if (points.length === 1) {
      if (!previous.dragging && Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) < 5) return;
      if (!previous.dragging) { previous.dragging = true; captureTreePointer(event.pointerId); }
      treeX += dx; treeY += dy;
    }
    else { const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (pinchDistance) treeScale = Math.max(.55, Math.min(1.6, treeScale * distance / pinchDistance)); pinchDistance = distance; }
    transformTree();
  });
  const endTreePointer = (event: PointerEvent): void => { treePointers.delete(event.pointerId); pinchDistance = 0; };
  lifetime.listen(ui.soulTreeViewport, 'lostpointercapture', (event) => { if (event.target === ui.soulTreeViewport) endTreePointer(event); });
  lifetime.listen(ui.soulTreeViewport, 'pointerup', endTreePointer); lifetime.listen(ui.soulTreeViewport, 'pointercancel', endTreePointer); transformTree();
  lifetime.listen(ui.settingsButton, 'click', () => setSettingsPanel(true));
  lifetime.listen(ui.settingsClose, 'click', () => setSettingsPanel(false));
  lifetime.listen(ui.settingsPanel, 'pointerdown', (event) => { if (event.target === ui.settingsPanel) setSettingsPanel(false); });
  lifetime.listen(ui.resetAttributesButton, 'click', async () => {
    if (!await confirmReset('Reset all permanent hero attributes? Your equipment and its progress will be kept.') || lifetime.disposed) return;
    commands.execute({ type: 'resetHero', equipment: false });
    updateHud();
    showToast('Permanent attributes reset · equipment kept');
  });
  lifetime.listen(ui.resetHeroButton, 'click', async () => {
    if (!await confirmReset('Reset all permanent hero attributes and equipment drops? World progression will be kept.') || lifetime.disposed) return;
    commands.execute({ type: 'resetHero', equipment: true });
    updateHud();
    showToast('Hero reset · attributes and equipment drops removed');
  });
  lifetime.listen(ui.resetSoulCatcherButton, 'click', async () => { if (!await confirmReset('Reset all Soul balances and purchased Soul Catcher nodes? Minions stay permanently unlocked, and your roster and paid summon count are kept. Rebuying the minion node grants XP only.') || lifetime.disposed) return; commands.execute({ type: 'resetSoulCatcher' }); selectedSoulNode = null; selectedSoulLayer = 1; updateHud(); showToast('Soul Catcher reset'); });
  lifetime.listen(ui.settingsPanel, 'change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'render-scale') quality.apply({ ...quality.current(), renderScale: input.value === '0.7' ? 0.7 : 1 });
    if (input.name === 'frame-rate') quality.apply({ ...quality.current(), frameRateLimit: input.value === '30' ? 30 : 60 });
    if (input === ui.rendererStatsToggle) quality.apply({ ...quality.current(), showStats: input.checked });
    if (input === ui.minionAntiIdleToggle) idle.setEnabled(input.checked);
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
    lifetime.frame(() => { inventoryScroller.scrollTop = scrollTop; });
  }
  function showInventoryDetail(itemId: string): void {
    const overviewScrollTop = inventoryView.view === 'detail' ? inventoryView.overviewScrollTop : inventoryScroller.scrollTop;
    inventoryView = { view: 'detail', itemId, overviewScrollTop };
    renderItemDetail(readSnapshot(), itemId);
    ui.inventoryOverview.hidden = true;
    ui.inventoryDetail.hidden = false;
    inventoryScroller.scrollTop = 0;
  }

  lifetime.listen(ui.inventoryBag, 'click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
  });
  lifetime.listen(ui.inventoryEquipped, 'click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    if (item?.dataset.itemId) showInventoryDetail(item.dataset.itemId);
  });
  lifetime.listen(ui.inventoryDetail, 'click', (event) => {
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
    lifetime.frame(() => {
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
      if (ui.minionPanel.classList.contains('visible')) renderMinions(snapshot);
      if (ui.debugUnlockMinions) ui.debugUnlockMinions.hidden = snapshot.minions.hasUnlockedSlots;
    });
  };
  for (const event of ['statGained', 'equipmentEquipped', 'equipmentUnequipped', 'weaponAscended', 'heroProgressReset', 'equipmentDropped', 'soulDropped', 'soulNodePurchased', 'soulCatcherReset', 'soulCatcherXpGained', 'soulCatcherLayerUnlocked', 'soulCatcherUnlocked', 'gateUnlocked', 'bossDefeated', 'minionSlotUnlocked', 'minionSummoned', 'minionDamaged', 'minionDefeated', 'minionRespawned', 'minionEquipmentChanged', 'minionProgressed', 'minionInfused'] as const) lifetime.add(events.on(event, refreshProgression));
  lifetime.add(events.on('minionVitalsChanged', () => { if (ui.minionPanel.classList.contains('visible')) refreshProgression(); }));
  renderQualityControls();
  renderProgressionHud(readSnapshot());
  if (ui.debugUnlockMinions) ui.debugUnlockMinions.hidden = readSnapshot().minions.hasUnlockedSlots;
  return () => {
    lifetime.dispose();
    if (minionCountdownTimer !== null) window.clearInterval(minionCountdownTimer);
    for (const pointerId of treePointers.keys()) if (ui.soulTreeViewport.hasPointerCapture(pointerId)) ui.soulTreeViewport.releasePointerCapture(pointerId);
    treePointers.clear();
    if (ui.confirmDialog.open) ui.confirmDialog.close('cancel');
    for (const panel of [ui.statsPanel, ui.inventoryPanel, ui.settingsPanel, ui.soulCatcherPanel, ui.minionPanel]) {
      panel.classList.remove('visible'); panel.setAttribute('aria-hidden', 'true');
    }
    disposeNotifications();
  };
}

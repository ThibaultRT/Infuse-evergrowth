import { ui } from '../elements';
import { heartIcon, heartRegenIcon, evasionIcon, damageTypeIcon, damageTypeDefenseIcon } from '../../icons';
import type { DamageType, EquipmentSlotId, LootType, SoulType } from '../../types';
import type { ProgressionSnapshot } from '../../systems/ProgressionSnapshot';
import { EQUIPMENT_BY_ID } from '../../domain/items/EquipmentCatalog';
import { equipmentIcon } from '../../equipment-icons';
import { sourceLabel, soulIcon, SLOT_LABELS } from './PanelFormatting';
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

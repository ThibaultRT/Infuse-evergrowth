import { ui } from '../elements';
import { heartIcon, heartRegenIcon, damageTypeIcon, damageTypeDefenseIcon } from '../../icons';
import type { EquipmentSlotId } from '../../types';
import type { ProgressionSnapshot, EquipmentSnapshot } from '../../systems/ProgressionSnapshot';
import { equipmentIcon } from '../../equipment-icons';
import { SLOT_LABELS } from './PanelFormatting';
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

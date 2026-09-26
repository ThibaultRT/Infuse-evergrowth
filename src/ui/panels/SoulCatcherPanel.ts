import { ui } from '../elements';
import type { SoulType } from '../../types';
import type { ProgressionSnapshot, SoulNodeSnapshot } from '../../systems/ProgressionSnapshot';
import { sourceLabel, soulIcon } from './PanelFormatting';
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

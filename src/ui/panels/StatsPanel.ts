import { ui } from '../elements';
import { heartIcon, heartRegenIcon, evasionIcon } from '../../icons';
import type { ProgressionSnapshot, StatSnapshot } from '../../systems/ProgressionSnapshot';
import { sourceLabel, SLOT_LABELS } from './PanelFormatting';
function renderBreakdown(label: string, stat: StatSnapshot, suffix = '', decimals = false, scale = 1, minionSource = false): string {
  const additiveTotal = stat.additiveTotal, total = stat.total;
  const format = (value: number): string => decimals || minionSource ? (value * scale).toLocaleString(undefined, { maximumFractionDigits: 6 }) : Math.round(value * scale).toLocaleString();
  const adds = Object.entries(stat.additive).filter(([source, value]) => value !== 0 || (source === 'minions' && minionSource)).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>${format(v)}${suffix}</span></div>`).join('');
  const mults = Object.entries(stat.multiplicative).filter(([, value]) => value !== 1).map(([s, v]) => `<div class="stat-line"><span>From ${sourceLabel(s)}</span><span>x${v.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>`).join('');
  const base = stat.base !== 0 ? `<div class="stat-group-title">Base</div><div class="stat-line"><span>Base</span><span>${format(stat.base)}${suffix}</span></div>` : '';
  return `<section class="stat-breakdown"><div class="stat-row"><span>${label}</span><strong>${format(total)}${suffix}</strong></div>${base}${adds ? `<div class="stat-group-title">Additive</div>${adds}` : ''}<div class="stat-line stat-subtotal"><span>Total</span><span>${format(additiveTotal)}${suffix}</span></div>${mults ? `<div class="stat-group-title">Multiplicative</div>${mults}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${format(total)}${suffix}</strong></div></section>`;
}

export function renderStats(snapshot: ProgressionSnapshot): void {
  const { stats } = snapshot;
  const maxHpLabel = `<span class="stat-title-with-icon">${heartIcon(14)} Max HP</span>`;
  const regenLabel = `<span class="stat-title-with-icon">${heartRegenIcon(14)} Health regeneration</span>`;
  const evasionRawChance = stats.evasion.rawChance;
  const evasionTotal = stats.evasion.total;
  const percent = (chance: number): string => `${(chance * 100).toFixed(2)}%`;
  const rawSources = Object.entries(stats.evasion.raw).filter(([source, value]) => value !== 0 || source === 'minions').map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>${value.toFixed(2)}</span></div>`).join('');
  const directSources = Object.entries(stats.evasion.directChance).filter(([, value]) => value !== 0).map(([source, value]) => `<div class="stat-line"><span>From ${sourceLabel(source)}</span><span>+${percent(value)}</span></div>`).join('');
  const evasion = `<section class="stat-breakdown"><div class="stat-row"><span class="stat-title-with-icon">${evasionIcon(14)} Evasion</span><strong>${percent(evasionTotal)}</strong></div>${rawSources ? `<div class="stat-group-title">Raw Evasion</div>${rawSources}` : ''}<div class="stat-line stat-subtotal"><span>Raw total</span><span>${percent(evasionRawChance)}</span></div>${directSources ? `<div class="stat-group-title">Direct Evasion</div>${directSources}` : ''}<div class="stat-line stat-total"><span>Total</span><strong>${percent(evasionTotal)}</strong></div></section>`;
  const scaled = (label: string, stat: StatSnapshot, effective: number, suffix: string): string => `${renderBreakdown(`${label} (raw)`, stat, '', true)}<div class="stat-line stat-total"><span>Effective ${label.toLowerCase()}</span><strong>${effective.toFixed(2)}${suffix}</strong></div>`;
  const effectiveSpeedMultiplier = stats.speed.multiplier;
  const speed = `${renderBreakdown('Speed (raw)', stats.speed, '', true, 1, true)}<div class="stat-line stat-subtotal"><span>Speed multiplier</span><strong>x${effectiveSpeedMultiplier.toFixed(2)}</strong></div><div class="stat-line stat-total"><span>Effective speed</span><strong>${stats.speed.metersPerSecond.toFixed(2)} m/s</strong></div>`;
  const attacks = (['blunt', 'slash', 'piercing'] as const).map((type) => {
    const profiles = stats.attacks.filter((profile) => profile.damageType === type);
    const label = `${sourceLabel(type)} attack`;
    if (!profiles.length) return renderBreakdown(`${label} · no weapon equipped`, stats.attack[type], '', true, 1, true);
    return profiles.map(({ slot, sources }) => renderBreakdown(`${SLOT_LABELS[slot]} · ${label}`, sources, '', true, 1, true)).join('');
  }).join('');
  const souls = snapshot.soulCatcher.yields.filter(({ total }) => total > 0).map(({ type, base, additional: additions }) => `<div class="stat-line"><span>${sourceLabel(type)}</span><strong>${base} base + ${additions} Soul Catcher</strong></div>`).join('');
  ui.statsContent.innerHTML = [renderBreakdown(maxHpLabel, stats.maxHp, '', false, 1, true), attacks, renderBreakdown('Blunt defence', stats.defense.blunt, '', true), renderBreakdown('Slash defence', stats.defense.slash, '', true), renderBreakdown('Piercing defence', stats.defense.piercing, '', true), renderBreakdown('Blunt resistance', stats.damageResistance.blunt, '%', false, 100), renderBreakdown('Slash resistance', stats.damageResistance.slash, '%', false, 100), renderBreakdown('Piercing resistance', stats.damageResistance.piercing, '%', false, 100), renderBreakdown(regenLabel, stats.regen, ' HP/s', false, 1, true), speed, scaled('Critical hit chance', stats.criticalChance, stats.criticalChance.percent, '%'), scaled('Critical damage', stats.criticalDamage, stats.criticalDamage.bonusPercent, '%'), scaled('Block chance', stats.blockChance, stats.blockChance.percent, '%'), evasion, `<section class="stat-breakdown"><div class="stat-row"><span>Soul Drops</span></div>${souls}</section>`].join('');
}

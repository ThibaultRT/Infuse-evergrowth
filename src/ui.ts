import { bluntHammerIcon } from './icons';
import { statAdditiveTotal, statTotal } from './save';
import type { PlayerStats, StatSources } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div id="game-shell">
  <div id="canvas-host"></div>
  <div class="hud">
    <div class="version-tag">0.3</div>
    <div class="topbar">
      <div class="card hp-wrap">
        <div class="brand">Infuse: Evergrowth</div>
        <div class="stats">
          <div style="flex:1">
            <div class="hp-label"><span>HP</span><span id="hp-text">120 / 120</span></div>
            <div class="bar"><span id="hp-bar"></span></div>
          </div>
          <div class="damage-hud" title="Blunt damage">${bluntHammerIcon(13)}<span id="attack-stat">5</span></div>
        </div>
      </div>
      <div class="hud-actions">
        <button id="stats-button" class="card stats-button" type="button">STATS</button>
        <div class="card weapon-slots" aria-label="weapon slots">
          <div class="slot">HAND 1<br>EMPTY</div><div class="slot">HAND 2<br>EMPTY</div>
          <div class="slot locked">ORBIT 1<br>LOCKED</div><div class="slot locked">ORBIT 2<br>LOCKED</div>
        </div>
      </div>
    </div>
    <div class="reset-note">Daily spawn reset: local midnight</div>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
    <div class="controls"><div id="joystick" class="joystick-zone"><div id="joystick-knob" class="joystick-knob"></div></div></div>
    <div id="toast" class="toast"></div>
    <div id="stats-panel" class="stats-panel" aria-hidden="true">
      <div class="card stats-sheet">
        <div class="stats-sheet-header">
          <div><div class="brand">Permanent growth</div><h2>Hero stats</h2></div>
          <button id="stats-close" class="stats-close" type="button">CLOSE</button>
        </div>
        <div id="stats-content"></div>
        <p class="stats-help">Stats keep decimal precision here. Combat HUD values are rounded to whole numbers.</p>
      </div>
    </div>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), attackText: q<HTMLSpanElement>('#attack-stat'),
  world: q<HTMLDivElement>('#world-ui'), toast: q<HTMLDivElement>('#toast'), joystick: q<HTMLDivElement>('#joystick'),
  joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host')
};

let toastTimer: number | null = null;
export function showToast(message: string): void {
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

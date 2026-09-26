const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div id="game-shell">
  <div id="loading-screen" class="loading-screen" role="status" aria-live="polite">
    <div class="loading-mark" aria-hidden="true"><span></span></div>
    <div class="loading-title">Infuse: Evergrowth</div>
    <div id="loading-subtitle" class="loading-subtitle">Preparing the realm</div>
    <div id="loading-version" class="loading-version"></div>
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
        ${import.meta.env.DEV ? '<button id="debug-unlock-minions" class="card stats-button" type="button">UNLOCK IMP</button>' : ''}
      </div>
    </div>
    <div class="edge-actions">
      <button id="soul-catcher-button" class="edge-button soul-catcher-button" type="button"><span class="edge-icon soul-catcher-icon"></span><small>SOUL<br>CATCHER</small></button>
      <button id="inventory-button" class="edge-button" type="button"><span class="edge-icon bag-icon"></span><small>BAG</small></button>
    </div>
    <button id="settings-button" class="settings-button card" type="button" aria-label="Settings" title="Settings">&#9881;</button>
    <div class="camera-distance-control card">
      <input id="camera-distance" type="range" min="10" max="35" step="0.1" aria-label="Camera distance">
      <div class="camera-distance-readout"><span>DIST</span><output id="camera-distance-value" for="camera-distance"></output></div>
    </div>
    <div id="world-ui" class="world-ui" aria-hidden="true"></div>
    <button id="minion-pit-button" class="minion-pit-button card" type="button" hidden disabled>Manage minions</button>
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
    <div id="minion-panel" class="modal-panel minion-panel" aria-hidden="true">
      <div class="card modal-sheet minion-sheet">
        <div class="modal-header"><div><div class="brand">Summoning Pit</div><h2>Minions</h2></div><button id="minion-close" class="modal-close" type="button">CLOSE</button></div>
        <div id="minion-cards" class="minion-cards"></div>
      </div>
    </div>
    <div id="settings-panel" class="modal-panel" aria-hidden="true">
      <div class="card modal-sheet settings-sheet">
        <div class="modal-header">
          <div><div class="brand">Preferences</div><h2>Settings</h2></div>
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
        ${import.meta.env.DEV ? '<label class="settings-stats"><input id="minion-anti-idle-toggle" type="checkbox"> Pause minions after 5 minutes without input (debug)</label>' : ''}
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
    <dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-message">
      <p id="confirm-message"></p>
      <form method="dialog"><button value="cancel" autofocus>Cancel</button><button id="confirm-action" value="confirm">Reset</button></form>
    </dialog>
    <output id="renderer-stats" class="renderer-stats" aria-live="off"></output>
  </div>
</div>`;

const q = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
export const ui = {
  confirmDialog: q<HTMLDialogElement>('#confirm-dialog'), confirmMessage: q<HTMLParagraphElement>('#confirm-message'),
  confirmAction: q<HTMLButtonElement>('#confirm-action'),
  loadingScreen: q<HTMLDivElement>('#loading-screen'), loadingSubtitle: q<HTMLDivElement>('#loading-subtitle'), loadingVersion: q<HTMLDivElement>('#loading-version'), loadingProgress: q<HTMLSpanElement>('#loading-progress'), loadingPercent: q<HTMLDivElement>('#loading-percent'),
  hpText: q<HTMLSpanElement>('#hp-text'), hpBar: q<HTMLSpanElement>('#hp-bar'), hand1Stat: q<HTMLSpanElement>('#hand1-stat'), orbit1Stat: q<HTMLSpanElement>('#orbit1-stat'), orbit2Stat: q<HTMLSpanElement>('#orbit2-stat'), orbit3Stat: q<HTMLSpanElement>('#orbit3-stat'),
  enemyAffinities: q<HTMLDivElement>('#enemy-affinities'),
  world: q<HTMLDivElement>('#world-ui'), minionPitButton: q<HTMLButtonElement>('#minion-pit-button'), toast: q<HTMLDivElement>('#toast'), gainStack: q<HTMLDivElement>('#gain-stack'), soulGainStack: q<HTMLDivElement>('#soul-gain-stack'),
  joystick: q<HTMLDivElement>('#joystick'), joystickKnob: q<HTMLDivElement>('#joystick-knob'), statsButton: q<HTMLButtonElement>('#stats-button'),
  spawnButton: q<HTMLButtonElement>('#spawn-button'),
  debugUnlockMinions: document.querySelector<HTMLButtonElement>('#debug-unlock-minions'),
  cameraDistance: q<HTMLInputElement>('#camera-distance'), cameraDistanceValue: q<HTMLOutputElement>('#camera-distance-value'),
  settingsButton: q<HTMLButtonElement>('#settings-button'), settingsPanel: q<HTMLDivElement>('#settings-panel'),
  renderScaleInputs: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="render-scale"]')),
  frameRateInputs: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="frame-rate"]')),
  inventoryScroller: q<HTMLElement>('.inventory-sheet'),
  inventorySlotPicker: (): HTMLElement | null => document.querySelector<HTMLElement>('[data-slot-picker]'),
  settingsClose: q<HTMLButtonElement>('#settings-close'), rendererStatsOption: q<HTMLLabelElement>('#renderer-stats-option'),
  rendererStatsToggle: q<HTMLInputElement>('#renderer-stats-toggle'), rendererStats: q<HTMLOutputElement>('#renderer-stats'),
  minionAntiIdleToggle: document.querySelector<HTMLInputElement>('#minion-anti-idle-toggle'),
  resetAttributesButton: q<HTMLButtonElement>('#reset-attributes-button'),
  resetHeroButton: q<HTMLButtonElement>('#reset-hero-button'),
  resetSoulCatcherButton: q<HTMLButtonElement>('#reset-soul-catcher-button'),
  statsPanel: q<HTMLDivElement>('#stats-panel'), statsClose: q<HTMLButtonElement>('#stats-close'),
  statsContent: q<HTMLDivElement>('#stats-content'), canvasHost: q<HTMLDivElement>('#canvas-host'),
  inventoryButton: q<HTMLButtonElement>('#inventory-button'), inventoryPanel: q<HTMLDivElement>('#inventory-panel'),
  soulCatcherButton: q<HTMLButtonElement>('#soul-catcher-button'), soulCatcherPanel: q<HTMLDivElement>('#soul-catcher-panel'), soulCatcherClose: q<HTMLButtonElement>('#soul-catcher-close'),
  minionPanel: q<HTMLDivElement>('#minion-panel'), minionClose: q<HTMLButtonElement>('#minion-close'), minionCards: q<HTMLDivElement>('#minion-cards'),
  soulBalances: q<HTMLDivElement>('#soul-balances'), soulXp: q<HTMLDivElement>('#soul-xp'), soulLayerTabs: q<HTMLDivElement>('#soul-layer-tabs'), soulTreeViewport: q<HTMLDivElement>('#soul-tree-viewport'), soulTree: q<HTMLDivElement>('#soul-tree'), soulConnections: q<SVGElement>('#soul-connections'), soulNodes: q<HTMLDivElement>('#soul-nodes'), soulDetail: q<HTMLDivElement>('#soul-detail'),
  inventoryClose: q<HTMLButtonElement>('#inventory-close'), inventoryOverview: q<HTMLDivElement>('#inventory-overview'),
  inventorySummary: q<HTMLDivElement>('#inventory-summary'), inventoryEquipped: q<HTMLDivElement>('#inventory-equipped'),
  inventoryBag: q<HTMLDivElement>('#inventory-bag'), inventoryDetail: q<HTMLDivElement>('#inventory-detail'), equipmentDropLayer: q<HTMLDivElement>('#equipment-drop-layer'),
  progressionLayer: q<HTMLDivElement>('#progression-layer'), quickSlots: Array.from(document.querySelectorAll<HTMLDivElement>('.quick-slot'))
};

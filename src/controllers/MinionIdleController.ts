import type { MovementInput } from './InputController';

const IDLE_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'infuse-minion-anti-idle-v1';

/** Device-local input activity. Gameplay decides whether to advance minion AI. */
export class MinionIdleController {
  private readonly lifetime = new AbortController();
  private lastInputAt = performance.now();
  private enabledValue = this.loadEnabled();

  constructor() {
    for (const event of ['keydown', 'pointerdown', 'pointermove', 'wheel'] as const) {
      window.addEventListener(event, this.recordInput, { passive: true, signal: this.lifetime.signal });
    }
  }

  dispose(): void { this.lifetime.abort(); }

  get enabled(): boolean { return this.enabledValue; }

  setEnabled(enabled: boolean): void {
    this.enabledValue = enabled;
    this.lastInputAt = performance.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled)); }
    catch (error) { console.warn('Minion idle setting could not be saved to this device.', error); }
  }

  paused(now: number, movement: MovementInput): boolean {
    if (movement.x !== 0 || movement.y !== 0) this.lastInputAt = now;
    return this.enabledValue && now - this.lastInputAt >= IDLE_MS;
  }

  private loadEnabled(): boolean {
    if (!import.meta.env.DEV) return true;
    try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
    catch { return true; }
  }

  private readonly recordInput = (): void => { this.lastInputAt = performance.now(); };
}

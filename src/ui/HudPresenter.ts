import type { GameEvents } from '../game/GameEvents';
import type { createHudProjection } from '../systems/HudProjection';
import { damageTypeIcon } from '../icons';

type HudElements = { hpText: HTMLElement; hpBar: HTMLElement; hand1Stat: HTMLElement; orbit1Stat: HTMLElement; orbit2Stat: HTMLElement; orbit3Stat: HTMLElement };

export class HudPresenter {
  private dirty = true;
  private maxHp = 1;
  private readonly unsubscribers: (() => void)[];
  private readonly content = new Map<HTMLElement, string>();
  private hpText = '';
  private hpWidth = '';

  constructor(private readonly elements: HudElements, events: GameEvents,
    private readonly project: () => ReturnType<typeof createHudProjection>) {
    this.unsubscribers = (['statGained', 'equipmentDropped', 'equipmentEquipped', 'equipmentUnequipped', 'weaponAscended',
      'soulNodePurchased', 'soulCatcherReset', 'heroProgressReset', 'minionInfused', 'gateUnlocked'] as const)
      .map((event) => events.on(event, () => { this.dirty = true; }));
  }

  update(hp: number): void {
    if (this.dirty) {
      this.dirty = false;
      const projection = this.project();
      this.maxHp = projection.maxHp;
      const slots = { hand1: this.elements.hand1Stat, orbit1: this.elements.orbit1Stat, orbit2: this.elements.orbit2Stat, orbit3: this.elements.orbit3Stat };
      for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
        const attack = projection.attacks.find((entry) => entry.slot === slot);
        const html = attack ? `${Math.round(attack.damage)} ${damageTypeIcon(attack.damageType, 12)}` : '—';
        if (this.content.get(slots[slot]) !== html) { slots[slot].innerHTML = html; this.content.set(slots[slot], html); }
      }
    }
    const text = `${Math.round(hp)} / ${Math.round(this.maxHp)}`;
    const width = `${Math.max(0, Math.min(100, hp / this.maxHp * 100)).toFixed(2)}%`;
    if (text !== this.hpText) { this.elements.hpText.textContent = text; this.hpText = text; }
    if (width !== this.hpWidth) { this.elements.hpBar.style.width = width; this.hpWidth = width; }
  }

  dispose(): void { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.content.clear(); }
}

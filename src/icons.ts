import type { CombatAffinity, DamageType, WeaponClass } from './types';

export function bluntHammerIcon(size = 12): string {
  return `<svg class="damage-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4.8 4.7 7.9 1.6l5.2 5.2-2 2-1.1-1.1-7.3 7.3a2 2 0 0 0 2.8 2.8l7.3-7.3-1.1-1.1 2-2 5.2 5.2-3.1 3.1-2.1-2.1-7.2 7.2a4 4 0 0 1-5.7-5.7L8 7.9 4.8 4.7Z" fill="currentColor"/>
  </svg>`;
}

export function slashSwordIcon(size = 12): string {
  return `<svg class="damage-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m20.9 2.1-2.1 7.4-8.2 8.2-2.3-2.3 8.2-8.2 4.4-5.1ZM7.2 16.5l1.3 1.3-2 2 1.2 1.2-1 1-4.8-4.8 1-1 1.2 1.2 2-2 .1.1 1-1 1 1-1 1Z" fill="currentColor"/>
  </svg>`;
}

export function pierceSpearIcon(size = 12): string {
  return `<svg class="damage-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m21.7 2.3-2.5 6.1-1.6-2-9 9 .9.9-1.4 1.4-.9-.9-2.4 2.4.9.9-1.4 1.4-2.8-2.8 1.4-1.4.9.9 2.4-2.4-.9-.9 1.4-1.4.9.9 9-9-2-1.6 6.1-2.5Z" fill="currentColor"/>
  </svg>`;
}

export function combatAffinityIcon(type: CombatAffinity, size = 12): string {
  if (type === 'slash') return slashSwordIcon(size);
  if (type === 'pierce') return pierceSpearIcon(size);
  return bluntHammerIcon(size);
}

export function damageTypeIcon(type: DamageType, size = 12): string {
  if (type === 'slash') return slashSwordIcon(size);
  if (type === 'piercing') return pierceSpearIcon(size);
  return bluntHammerIcon(size);
}

/** A damage-type glyph nested in a shield, used for typed defence values. */
export function damageTypeDefenseIcon(type: DamageType, size = 12): string {
  const glyph = type === 'slash'
    ? 'm20.9 2.1-2.1 7.4-8.2 8.2-2.3-2.3 8.2-8.2 4.4-5.1ZM7.2 16.5l1.3 1.3-2 2 1.2 1.2-1 1-4.8-4.8 1-1 1.2 1.2 2-2 .1.1 1-1 1 1-1 1Z'
    : type === 'piercing'
      ? 'm21.7 2.3-2.5 6.1-1.6-2-9 9 .9.9-1.4 1.4-.9-.9-2.4 2.4.9.9-1.4 1.4-2.8-2.8 1.4-1.4.9.9 2.4-2.4-.9-.9 1.4-1.4.9.9 9-9-2-1.6 6.1-2.5Z'
      : 'M4.8 4.7 7.9 1.6l5.2 5.2-2 2-1.1-1.1-7.3 7.3a2 2 0 0 0 2.8 2.8l7.3-7.3-1.1-1.1 2-2 5.2 5.2-3.1 3.1-2.1-2.1-7.2 7.2a4 4 0 0 1-5.7-5.7L8 7.9 4.8 4.7Z';
  return `<svg class="stat-icon damage-defense-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 1.5 22 4.8v6.4c0 6.2-4.2 10.3-10 11.8C6.2 21.5 2 17.4 2 11.2V4.8l10-3.3Zm0 2.8L4.8 6.7v4.5c0 4.4 2.7 7.5 7.2 8.9 4.5-1.4 7.2-4.5 7.2-8.9V6.7L12 4.3Z" fill="currentColor"/>
    <path d="${glyph}" fill="currentColor" transform="translate(6 6) scale(.5)"/>
  </svg>`;
}

export function weaponClassIcon(weaponClass: WeaponClass, size = 12): string {
  if (weaponClass === 'sword') return slashSwordIcon(size);
  if (weaponClass === 'spear') return pierceSpearIcon(size);
  return bluntHammerIcon(size);
}

export function heartIcon(size = 12): string {
  return `<svg class="stat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21s-7.5-4.7-9.4-9.2C.9 7.9 3.2 4 7.2 4c2.1 0 3.7 1.1 4.8 2.7C13.1 5.1 14.7 4 16.8 4c4 0 6.3 3.9 4.6 7.8C19.5 16.3 12 21 12 21Z" fill="currentColor"/>
  </svg>`;
}

/** Red healing heart encircled by green renewal arrows, used only for HP regeneration. */
export function heartRegenIcon(size = 12): string {
  return `<svg class="stat-icon regen-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5.2 8.1A7.8 7.8 0 0 1 18.1 5.5" fill="none" stroke="#84cc16" stroke-width="2.2" stroke-linecap="round"/>
    <path d="m16.5 3.5 2.6 1.8-2.1 2.5" fill="none" stroke="#84cc16" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18.8 15.9A7.8 7.8 0 0 1 5.9 18.5" fill="none" stroke="#84cc16" stroke-width="2.2" stroke-linecap="round"/>
    <path d="m7.5 20.5-2.6-1.8L7 16.2" fill="none" stroke="#84cc16" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 18.8s-5.7-3.5-7.2-7C3.6 8.9 5.3 6 8.3 6c1.6 0 2.9.8 3.7 2 .8-1.2 2.1-2 3.7-2 3 0 4.7 2.9 3.5 5.8-1.5 3.5-7.2 7-7.2 7Z" fill="#ef4444" stroke="#7f1d1d" stroke-width=".8"/>
    <path d="M11 9h2v2h2v2h-2v2h-2v-2H9v-2h2V9Z" fill="#fff"/>
  </svg>`;
}

export function shieldIcon(size = 12): string {
  return `<svg class="stat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2 21 5v6c0 5.7-3.8 9.4-9 11-5.2-1.6-9-5.3-9-11V5l9-3Zm0 3.1L6 7v4c0 3.9 2.3 6.6 6 8 3.7-1.4 6-4.1 6-8V7l-6-1.9Z" fill="currentColor"/>
  </svg>`;
}

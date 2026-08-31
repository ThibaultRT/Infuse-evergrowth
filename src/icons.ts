import type { CombatAffinity, DamageType, WeaponClass } from './types';

const BLUNT_IMPACT_PATH = 'M12.45 2.78 8.62 6.54 8.51 7.28 9.67 8.53 10.94 8.52 11 9.64 14.1 12.72 15.13 12.64 15.2 13.9 16.5 15.19 17.1 15.27 21.01 11.59 21.13 10.88 19.7 9.41 18.53 9.6 18.3 9.06 18.65 8.36 15.75 5.44 14.62 5.44 14.57 4.2 13.17 2.82Z M12.96 12.14 11.27 10.47 10.89 10.47 9.94 11.4 10.09 11.9 1.57 19.43 1.59 20.5 2.37 21.24 3.22 21.12 11.51 13.28 12.15 13.34Z M22.6 16.92 18.88 18.39 18.71 14.61 16.44 17.65 15.32 16.55 15.3 18.7 12.18 20.05 21.24 20.11 20.08 19.2Z M22.12 13.55 19.81 14.77 19.72 16.92Z M13.04 15.21 14.41 17.63 14.84 16.14Z';

export function bluntHammerIcon(size = 12): string {
  return `<svg class="damage-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="${BLUNT_IMPACT_PATH}" fill="currentColor"/>
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

/** Compact double-chevron dodge mark, based on the selected Evasion concept. */
export function evasionIcon(size = 12): string {
  return `<svg class="stat-icon evasion-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4.5 5.5c3.1 1.6 5.6 3.7 7.4 6.5-1.8 2.8-4.3 4.9-7.4 6.5M9 5.5c3.1 1.6 5.6 3.7 7.4 6.5-1.8 2.8-4.3 4.9-7.4 6.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m16 8.4 4.5 3.6-4.5 3.6Z" fill="#22d3ee"/>
  </svg>`;
}

export function damageTypeIcon(type: DamageType | 'evasion', size = 12): string {
  if (type === 'evasion') return evasionIcon(size);
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
      : BLUNT_IMPACT_PATH;
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

/** Red healing heart with a white plus, used only for HP regeneration. */
export function heartRegenIcon(size = 12): string {
  return `<svg class="stat-icon regen-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21s-7.5-4.7-9.4-9.2C.9 7.9 3.2 4 7.2 4c2.1 0 3.7 1.1 4.8 2.7C13.1 5.1 14.7 4 16.8 4c4 0 6.3 3.9 4.6 7.8C19.5 16.3 12 21 12 21Z" fill="#ef4444" stroke="#7f1d1d" stroke-width=".8"/>
    <path d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3V8Z" fill="#fff"/>
  </svg>`;
}

export function shieldIcon(size = 12): string {
  return `<svg class="stat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2 21 5v6c0 5.7-3.8 9.4-9 11-5.2-1.6-9-5.3-9-11V5l9-3Zm0 3.1L6 7v4c0 3.9 2.3 6.6 6 8 3.7-1.4 6-4.1 6-8V7l-6-1.9Z" fill="currentColor"/>
  </svg>`;
}

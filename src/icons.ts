import type { CombatAffinity } from './types';

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

export function heartIcon(size = 12): string {
  return `<svg class="stat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21s-7.5-4.7-9.4-9.2C.9 7.9 3.2 4 7.2 4c2.1 0 3.7 1.1 4.8 2.7C13.1 5.1 14.7 4 16.8 4c4 0 6.3 3.9 4.6 7.8C19.5 16.3 12 21 12 21Z" fill="currentColor"/>
  </svg>`;
}

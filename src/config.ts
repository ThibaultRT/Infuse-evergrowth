import type { DamageType, SpawnDefinition, Tier, TierConfig } from './types';

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  crystal: { label: 'Crystal', statMultiplier: 0.35, statReward: 0.5, respawnMultiplier: 1, color: 0x8dd9ff, hostile: false },
  common: { label: 'Common', statMultiplier: 1, statReward: 1, respawnMultiplier: 1, color: 0xb8bec8, hostile: true },
  uncommon: { label: 'Uncommon', statMultiplier: 2.25, statReward: 1.25, respawnMultiplier: 3, color: 0x64dc8c, hostile: true },
  rare: { label: 'Rare', statMultiplier: 4.5, statReward: 1.5, respawnMultiplier: 6, color: 0x5d98ff, hostile: true },
  epic: { label: 'Epic', statMultiplier: 8, statReward: 1.75, respawnMultiplier: 9, color: 0xbf75ff, hostile: true },
  legendary: { label: 'Legendary', statMultiplier: 14, statReward: 2, respawnMultiplier: 15, color: 0xffb33d, hostile: true }
};

export const SPAWNS: SpawnDefinition[] = [
  { id: 'crystal-01', tier: 'crystal', x: -4, z: 7 },
  { id: 'crystal-02', tier: 'crystal', x: 4, z: 8 },
  { id: 'crystal-03', tier: 'crystal', x: -8, z: 2 },
  { id: 'crystal-04', tier: 'crystal', x: 8, z: 1 },
  { id: 'crystal-05', tier: 'crystal', x: -10, z: -6 },
  { id: 'crystal-06', tier: 'crystal', x: 10, z: -7 },
  { id: 'common-a1', tier: 'common', x: -8, z: 14, group: 'common-a' },
  { id: 'common-a2', tier: 'common', x: -6, z: 15, group: 'common-a' },
  { id: 'common-a3', tier: 'common', x: -4, z: 14, group: 'common-a' },
  { id: 'common-a4', tier: 'common', x: -7, z: 12, group: 'common-a' },
  { id: 'common-a5', tier: 'common', x: -5, z: 12, group: 'common-a' },
  { id: 'common-a6', tier: 'common', x: -3, z: 13, group: 'common-a' },
  { id: 'common-b1', tier: 'common', x: 5, z: -13, group: 'common-b' },
  { id: 'common-b2', tier: 'common', x: 7, z: -14, group: 'common-b' },
  { id: 'common-b3', tier: 'common', x: 9, z: -13, group: 'common-b' },
  { id: 'common-b4', tier: 'common', x: 4, z: -15, group: 'common-b' },
  { id: 'common-b5', tier: 'common', x: 6, z: -16, group: 'common-b' },
  { id: 'common-b6', tier: 'common', x: 8, z: -16, group: 'common-b' },
  { id: 'common-b7', tier: 'common', x: 10, z: -15, group: 'common-b' },
  { id: 'common-b8', tier: 'common', x: 11, z: -12, group: 'common-b' },
  { id: 'uncommon-a1', tier: 'uncommon', x: 9, z: 15, group: 'uncommon-a' },
  { id: 'uncommon-a2', tier: 'uncommon', x: 12, z: 14, group: 'uncommon-a' },
  { id: 'uncommon-b1', tier: 'uncommon', x: -12, z: -13, group: 'uncommon-b' },
  { id: 'uncommon-b2', tier: 'uncommon', x: -9, z: -15, group: 'uncommon-b' },
  { id: 'rare-01', tier: 'rare', x: -14, z: 19 },
  { id: 'rare-02', tier: 'rare', x: 14, z: 20 },
  { id: 'rare-03', tier: 'rare', x: 0, z: -21 },
  { id: 'epic-01', tier: 'epic', x: -14, z: -21 },
  { id: 'epic-02', tier: 'epic', x: 14, z: -20 },
  { id: 'legendary-01', tier: 'legendary', x: 0, z: 23 }
];

export const BASE_RESPAWN_MS = 3 * 60 * 1000;
export const BASE_HERO_MAX_HP = 120;
export const BASE_HERO_BLUNT_ATTACK = 5;
export const BASE_HERO_REGEN = 0.1;
export const BARE_HANDS_DAMAGE_TYPE: DamageType = 'blunt';
export const HERO_SPEED = 7.6;
export const HERO_ATTACK_RANGE = 2.15;
export const HERO_ATTACK_COOLDOWN = 0.5;

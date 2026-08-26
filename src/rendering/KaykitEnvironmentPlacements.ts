export interface KaykitPlacement {
  readonly path: string;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation?: number;
}

export interface KaykitExclusionPoint { readonly x: number; readonly z: number }

const forest = (name: string): string => `forest/${name}.gltf`;
const dungeon = (name: string): string => `dungeon/${name}.gltf`;

/** Curated hero-scale placements for the three Slice 12D1 proof views. */
export const AREA_ONE_KAYKIT_PLACEMENTS: readonly KaykitPlacement[] = [
  // Northern clusters frame the normal forward camera view without entering the clearing.
  { path: forest('Tree_4_C_Color1'), x: -16.5, z: -9.5, scale: 1.05, rotation: .4 },
  { path: forest('Tree_4_A_Color1'), x: -16, z: -16.8, scale: 1.2, rotation: 2.3 },
  { path: forest('Tree_4_B_Color1'), x: 15.2, z: -9.8, scale: 1.08, rotation: 4.5 },
  { path: forest('Tree_4_A_Color1'), x: 15.4, z: -18.4, scale: .94, rotation: 1.5 },
  { path: forest('Tree_4_B_Color1'), x: -15.5, z: 15, scale: 1.08, rotation: 4.5 },
  { path: forest('Tree_4_A_Color1'), x: -16.5, z: 23, scale: .94, rotation: 1.5 },
  { path: forest('Tree_4_C_Color1'), x: 14.7, z: 16, scale: .92, rotation: 3.2 },
  { path: forest('Tree_4_B_Color1'), x: 11.7, z: 20.2, scale: 1.05, rotation: .9 },
  { path: 'medieval/forest.gltf.glb', x: -17, z: -22, scale: 2.3, rotation: 2.5 },
  // The real bridge replaces the primitive presentation at the unchanged A1/A2 crossing.
  { path: 'medieval/bridge.gltf.glb', x: 8, z: -28, scale: 4.4, rotation: Math.PI / 2 },
  { path: forest('Rock_1_J_Color1'), x: -14.5, z: -18.8, scale: .42, rotation: .8 },
  { path: forest('Rock_1_L_Color1'), x: 14.8, z: -14.5, scale: .38, rotation: 3.7 },
  { path: forest('Rock_1_M_Color1'), x: -13.7, z: 10.7, scale: .35, rotation: 5.1 },
  { path: forest('Rock_2_C_Color1'), x: 12.2, z: -19.4, scale: 3.6, rotation: 2.4 },
  // Small activity-point groups, using every approved barrel variant.
  { path: dungeon('barrel_large'), x: 13.8, z: -7.2, scale: .62, rotation: .2 },
  { path: dungeon('barrel_small_stack'), x: 15.1, z: -7.8, scale: .58, rotation: 2 },
  { path: dungeon('barrel_large_decorated'), x: -11.5, z: 11.5, scale: .58, rotation: 1.4 },
  { path: dungeon('barrel_small'), x: -10.5, z: 12.2, scale: .62, rotation: 3.1 }
];

export const WEST_BORDER_KAYKIT_PLACEMENTS: readonly KaykitPlacement[] = [
  { path: forest('Rock_1_J_Color1'), x: -19.4, z: -7.5, scale: 1.35, rotation: .4 },
  { path: forest('Rock_1_K_Color1'), x: -21.3, z: -2.7, scale: 1.65, rotation: 2.1 },
  { path: forest('Rock_1_L_Color1'), x: -19.2, z: 2.1, scale: 1.3, rotation: 4.2 },
  { path: forest('Rock_1_M_Color1'), x: -21.8, z: 7.4, scale: 1.55, rotation: 1.1 },
  { path: dungeon('rubble_large'), x: -18.4, z: -4.1, scale: .48, rotation: 1.45 },
  { path: dungeon('rubble_half'), x: -18.2, z: 5.2, scale: .65, rotation: 2.8 },
  { path: forest('Rock_2_A_Color1'), x: -17.3, z: -7.1, scale: 4.2, rotation: .2 },
  { path: forest('Rock_2_B_Color1'), x: -17.8, z: -1.7, scale: 3.6, rotation: 1.7 },
  { path: forest('Rock_2_C_Color1'), x: -17.1, z: 2.7, scale: 4.5, rotation: 3.4 },
  { path: forest('Rock_2_D_Color1'), x: -17.5, z: 7.8, scale: 3.9, rotation: 5.2 }
];

export const AREA_THREE_WALL_PLACEMENTS: readonly KaykitPlacement[] = [
  // Representative western-frontier stretch; the gate opening and south cutaway remain open.
  { path: dungeon('wall_corner'), x: -20, z: -25.5, scale: 1, rotation: Math.PI / 2 },
  { path: dungeon('wall'), x: -20, z: -22, scale: 1, rotation: Math.PI / 2 },
  { path: dungeon('wall_cracked'), x: -20, z: -18, scale: 1, rotation: Math.PI / 2 },
  { path: dungeon('wall_broken'), x: -20, z: -14, scale: 1, rotation: Math.PI / 2 },
  { path: dungeon('wall'), x: -20, z: -10, scale: 1, rotation: Math.PI / 2 }
];

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function excluded(x: number, z: number, spawnPoints: readonly KaykitExclusionPoint[]): boolean {
  // Central combat clearing, north route/bridge approach, east gate approach and spawn clearings.
  if (x * x + (z - 5) * (z - 5) < 82) return true;
  if (Math.abs(x) < 3.8 && z > 11) return true;
  if (x > 10 && Math.abs(z) < 5) return true;
  return spawnPoints.some(({ x: sx, z: sz }) => (x - sx) ** 2 + (z - sz) ** 2 < 12.25);
}

/** Stable edge-weighted vegetation scatter; gameplay and collision never read this data. */
export function areaOneVegetation(spawnPoints: readonly KaykitExclusionPoint[], seed = 1201): KaykitPlacement[] {
  const random = seededRandom(seed);
  const assets = [
    [forest('Bush_1_A_Color1'), 3.2], [forest('Bush_1_D_Color1'), .72],
    [forest('Bush_2_B_Color1'), 1], [forest('Bush_2_E_Color1'), .62],
    [forest('Bush_3_A_Color1'), 1.05], [forest('Bush_4_C_Color1'), .72],
    [forest('Grass_1_A_Color1'), 1.5], [forest('Grass_1_C_Color1'), 1],
    [forest('Grass_2_B_Color1'), 1.1], [forest('Grass_2_D_Color1'), .75]
  ] as const;
  const result: KaykitPlacement[] = [];
  for (let attempt = 0; attempt < 600 && result.length < 52; attempt++) {
    const x = -17 + random() * 34, z = -22 + random() * 48;
    const nearEdge = Math.abs(x) > 10 || z > 16 || z < -14;
    if ((!nearEdge && random() > .24) || excluded(x, z, spawnPoints)) continue;
    const [path, baseScale] = assets[Math.floor(random() * assets.length)];
    result.push({ path, x, z, scale: baseScale * (.86 + random() * .28), rotation: random() * Math.PI * 2 });
  }
  return result;
}

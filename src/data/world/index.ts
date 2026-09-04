import { AREA_A01_LAYOUT } from './areas/areaA01Layout';
import { AREA_A02_LAYOUT } from './areas/areaA02Layout';
import { AREA_A03_LAYOUT } from './areas/areaA03Layout';
import { A01_A02_TRANSITION } from './transitions/a01A02Transition';
import { A01_A03_TRANSITION } from './transitions/a01A03Transition';
import { A02_A03_TRANSITION } from './transitions/a02A03Transition';
import { assertValidWorldLayouts } from './validateWorld';
import type { AnyWorldLayout, AreaWorldLayout, TransitionWorldLayout } from './WorldLayout';

export const AREA_WORLD_LAYOUTS = [AREA_A01_LAYOUT, AREA_A02_LAYOUT, AREA_A03_LAYOUT] as const satisfies readonly AreaWorldLayout[];
export const TRANSITION_WORLD_LAYOUTS = [A01_A02_TRANSITION, A01_A03_TRANSITION, A02_A03_TRANSITION] as const satisfies readonly TransitionWorldLayout[];
export const WORLD_LAYOUTS: readonly AnyWorldLayout[] = [...AREA_WORLD_LAYOUTS, ...TRANSITION_WORLD_LAYOUTS];

assertValidWorldLayouts(WORLD_LAYOUTS);

export function areaWorldLayout(areaId: number): AreaWorldLayout {
  const layout = AREA_WORLD_LAYOUTS.find((candidate) => candidate.areaId === areaId);
  if (!layout) throw new Error(`Unknown area layout ${areaId}`);
  return layout;
}

export function transitionWorldLayout(connectionId: string): TransitionWorldLayout {
  const layout = TRANSITION_WORLD_LAYOUTS.find((candidate) => candidate.connectionId === connectionId);
  if (!layout) throw new Error(`Unknown transition layout ${connectionId}`);
  return layout;
}

export type { AnyWorldLayout, AreaWorldLayout, TransitionWorldLayout } from './WorldLayout';

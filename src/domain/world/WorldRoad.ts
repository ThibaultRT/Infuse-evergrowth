import type { WorldVec2 } from './WorldPlacement';

/** Open centripetal Catmull–Rom: plain-value road samples for views and clearances. */
export function sampleRoadPoints(points: readonly WorldVec2[], divisions: number): WorldVec2[] {
  if (points.length < 2) return [...points];
  return Array.from({ length: divisions + 1 }, (_, sample) => {
    const progress = sample / divisions * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(progress));
    const t = progress - index;
    const p1 = points[index], p2 = points[index + 1];
    const p0 = points[index - 1] ?? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = points[index + 2] ?? [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    const interval = (a: WorldVec2, b: WorldVec2): number => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]));
    let dt0 = interval(p0, p1), dt1 = interval(p1, p2), dt2 = interval(p2, p3);
    if (dt1 < 1e-4) dt1 = 1;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;
    const axis = (i: 0 | 1): number => {
      const a = p0[i], b = p1[i], c = p2[i], d = p3[i];
      const m1 = ((b - a) / dt0 - (c - a) / (dt0 + dt1) + (c - b) / dt1) * dt1;
      const m2 = ((c - b) / dt1 - (d - b) / (dt1 + dt2) + (d - c) / dt2) * dt1;
      return b + m1 * t + (-3 * b + 3 * c - 2 * m1 - m2) * t * t + (2 * b - 2 * c + m1 + m2) * t * t * t;
    };
    return [axis(0), axis(1)];
  });
}

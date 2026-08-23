export type Position = { x: number; y: number; z: number };

export function distanceBetween(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function copyPosition(target: Position, source: Position): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

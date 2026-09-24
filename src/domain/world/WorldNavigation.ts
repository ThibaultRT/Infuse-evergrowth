import { circleOverlapsWorldCollision } from './CollisionMath';
import type { AreaDefinition, WorldConnection } from '../../types';

type Point = { x: number; z: number };
type Shape = AreaDefinition['collision'][number];
type Node = Point & { areaId: number; edges: { to: number; length: number; crossing?: Point }[] };
export type NavigationTarget = { id: string; areaId: number; position: Point };
export type NavigationRoute = { targetId: string; distance: number; waypoints: Point[] };
const CELL = 2;
const RADIUS = .45;
const COLLISION_CELL = 6;

class MinHeap {
  private values: { id: number; cost: number }[] = [];
  get size(): number { return this.values.length; }
  push(value: { id: number; cost: number }): void {
    let index = this.values.length;
    this.values.push(value);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent]; index = parent;
    }
    this.values[index] = value;
  }
  pop(): { id: number; cost: number } | undefined {
    const top = this.values[0], last = this.values.pop();
    if (!top || !last) return top;
    if (this.values.length) {
      let index = 0;
      while (index * 2 + 1 < this.values.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.values.length && this.values[child + 1].cost < this.values[child].cost) child++;
        if (this.values[child].cost >= last.cost) break;
        this.values[index] = this.values[child]; index = child;
      }
      this.values[index] = last;
    }
    return top;
  }
}

/** A compact, cached graph of authored walk footprints, semantic collision, and opened crossings. */
export class WorldNavigation {
  private nodes: Node[] = [];
  private key = '';
  private readonly collisionIndex = new Map<number, Map<string, Shape[]>>();

  constructor(private readonly areas: readonly AreaDefinition[], private readonly connections: readonly WorldConnection[]) {
    for (const area of areas) {
      const cells = new Map<string, Shape[]>();
      this.collisionIndex.set(area.id, cells);
      for (const shape of area.collision) {
        const extent = (shape.kind === 'circle' ? shape.radius : Math.hypot(shape.width, shape.depth) / 2) + RADIUS;
        for (let x = Math.floor((shape.x - extent) / COLLISION_CELL); x <= Math.floor((shape.x + extent) / COLLISION_CELL); x++)
          for (let z = Math.floor((shape.z - extent) / COLLISION_CELL); z <= Math.floor((shape.z + extent) / COLLISION_CELL); z++) {
            const key = `${x}:${z}`;
            const bucket = cells.get(key) ?? [];
            bucket.push(shape); cells.set(key, bucket);
          }
      }
    }
  }

  private enabled(shape: AreaDefinition['collision'][number], unlocked: readonly number[]): boolean {
    if (!shape.activation) return true;
    const gate = this.connections.find((candidate) => candidate.id === shape.activation?.connectionId);
    return !gate || !unlocked.includes(gate.requiredUnlockedAreaId);
  }

  private inside(area: AreaDefinition, point: Point): boolean {
    return Math.abs(point.x - area.originX) <= area.size.width / 2 - RADIUS
      && Math.abs(point.z - area.originZ) <= area.size.depth / 2 - RADIUS;
  }

  private collisionFree(areaId: number, point: Point, unlocked: readonly number[]): boolean {
    const bucket = this.collisionIndex.get(areaId)?.get(`${Math.floor(point.x / COLLISION_CELL)}:${Math.floor(point.z / COLLISION_CELL)}`) ?? [];
    return !bucket.some((shape) => this.enabled(shape, unlocked) && circleOverlapsWorldCollision(point, RADIUS, shape));
  }

  valid(areaId: number, point: Point, unlocked: readonly number[]): boolean {
    const area = this.areas.find((candidate) => candidate.id === areaId);
    return Boolean(area && unlocked.includes(areaId) && this.inside(area, point)
      && this.collisionFree(areaId, point, unlocked));
  }

  crossingWalkable(gate: WorldConnection, point: Point, unlocked: readonly number[]): boolean {
    if (!unlocked.includes(gate.requiredUnlockedAreaId)) return false;
    const perpendicular = gate.axis === 'x' ? point.z - gate.z : point.x - gate.x;
    const along = gate.axis === 'x' ? point.x - gate.x : point.z - gate.z;
    return Math.abs(perpendicular) <= gate.width / 2 - RADIUS
      && Math.abs(along) <= Math.max(4, (gate.barrierDepth ?? 0) + 4)
      && this.collisionFree(gate.areaAId, point, unlocked) && this.collisionFree(gate.areaBId, point, unlocked);
  }

  private clear(areaId: number, a: Point, b: Point, unlocked: readonly number[]): boolean {
    const distance = Math.hypot(a.x - b.x, a.z - b.z);
    for (let step = 1; step <= Math.ceil(distance / .5); step++) {
      const fraction = step / Math.ceil(distance / .5);
      if (!this.valid(areaId, { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction }, unlocked)) return false;
    }
    return true;
  }

  directlyReachable(areaId: number, a: Point, b: Point, unlocked: readonly number[]): boolean {
    return this.valid(areaId, a, unlocked) && this.clear(areaId, a, b, unlocked);
  }

  private link(a: number, b: number, crossing?: Point): void {
    const first = this.nodes[a], second = this.nodes[b];
    const length = crossing
      ? Math.hypot(first.x - crossing.x, first.z - crossing.z) + Math.hypot(second.x - crossing.x, second.z - crossing.z)
      : Math.hypot(first.x - second.x, first.z - second.z);
    first.edges.push({ to: b, length, crossing });
    second.edges.push({ to: a, length, crossing });
  }

  private nearest(areaId: number, point: Point, unlocked: readonly number[], maxDistance = 5): number | null {
    let best: number | null = null, distance = maxDistance;
    for (let index = 0; index < this.nodes.length; index++) {
      const node = this.nodes[index];
      if (node.areaId !== areaId) continue;
      const candidate = Math.hypot(node.x - point.x, node.z - point.z);
      if (candidate < distance && this.clear(areaId, point, node, unlocked)) { best = index; distance = candidate; }
    }
    return best;
  }

  private rebuild(unlocked: readonly number[]): void {
    const nextKey = [...unlocked].sort((a, b) => a - b).join(',');
    if (nextKey === this.key) return;
    this.key = nextKey; this.nodes = [];
    for (const area of this.areas) {
      if (!unlocked.includes(area.id)) continue;
      const rows: (number | null)[][] = [];
      const columns = Math.floor((area.size.width - 2 * RADIUS) / CELL) + 1;
      const lines = Math.floor((area.size.depth - 2 * RADIUS) / CELL) + 1;
      const minX = area.originX - area.size.width / 2 + RADIUS;
      const minZ = area.originZ - area.size.depth / 2 + RADIUS;
      for (let z = 0; z < lines; z++) {
        rows[z] = [];
        for (let x = 0; x < columns; x++) {
          const point = { x: minX + x * CELL, z: minZ + z * CELL };
          if (!this.valid(area.id, point, unlocked)) { rows[z][x] = null; continue; }
          rows[z][x] = this.nodes.push({ ...point, areaId: area.id, edges: [] }) - 1;
        }
      }
      for (let z = 0; z < lines; z++) for (let x = 0; x < columns; x++) {
        const from = rows[z][x]; if (from === null) continue;
        for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const to = rows[z + dz]?.[x + dx];
          if (to !== undefined && to !== null && this.clear(area.id, this.nodes[from], this.nodes[to], unlocked)) this.link(from, to);
        }
      }
    }
    for (const gate of this.connections) {
      if (!unlocked.includes(gate.requiredUnlockedAreaId)) continue;
      const a = this.areas.find((area) => area.id === gate.areaAId), b = this.areas.find((area) => area.id === gate.areaBId);
      if (!a || !b) continue;
      const offset = Math.max(1, (gate.barrierDepth ?? 0) / 2 + .6);
      const portal = (area: AreaDefinition): Point => gate.axis === 'x'
        ? { x: gate.x + Math.sign(area.originX - gate.x) * offset, z: gate.z }
        : { x: gate.x, z: gate.z + Math.sign(area.originZ - gate.z) * offset };
      const first = portal(a), second = portal(b);
      if (!this.valid(a.id, first, unlocked) || !this.valid(b.id, second, unlocked)) continue;
      const across = Math.hypot(first.x - second.x, first.z - second.z);
      if (Array.from({ length: Math.ceil(across / .5) + 1 }, (_, index) => {
        const fraction = index / Math.ceil(across / .5);
        return { x: first.x + (second.x - first.x) * fraction, z: first.z + (second.z - first.z) * fraction };
      }).some((point) => !this.crossingWalkable(gate, point, unlocked))) continue;
      const firstId = this.nearest(a.id, first, unlocked, CELL * 2), secondId = this.nearest(b.id, second, unlocked, CELL * 2);
      if (firstId === null || secondId === null) continue;
      const p = this.nodes.push({ ...first, areaId: a.id, edges: [] }) - 1;
      const q = this.nodes.push({ ...second, areaId: b.id, edges: [] }) - 1;
      this.link(firstId, p); this.link(secondId, q); this.link(p, q, { x: gate.x, z: gate.z });
    }
  }

  nearestRoute(areaId: number, position: Point, targets: readonly NavigationTarget[], unlocked: readonly number[]): NavigationRoute | null {
    this.rebuild(unlocked);
    let start = this.nearest(areaId, position, unlocked, CELL * 2);
    if (start === null && this.connections.some((gate) => unlocked.includes(gate.requiredUnlockedAreaId)
      && (gate.areaAId === areaId || gate.areaBId === areaId)
      && Math.abs((gate.axis === 'x' ? position.z - gate.z : position.x - gate.x)) <= gate.width / 2 - RADIUS
      && Math.abs((gate.axis === 'x' ? position.x - gate.x : position.z - gate.z)) <= Math.max(4, (gate.barrierDepth ?? 0) + 4))) {
      let nearestDistance = 15;
      for (let index = 0; index < this.nodes.length; index++) {
        const node = this.nodes[index];
        if (node.areaId !== areaId) continue;
        const distance = Math.hypot(node.x - position.x, node.z - position.z);
        if (distance < nearestDistance) { nearestDistance = distance; start = index; }
      }
    }
    if (start === null) return null;
    const costs = new Float64Array(this.nodes.length).fill(Infinity);
    const previous = new Int32Array(this.nodes.length).fill(-1);
    const crossings = new Map<number, Point>();
    const heap = new MinHeap();
    costs[start] = Math.hypot(position.x - this.nodes[start].x, position.z - this.nodes[start].z);
    heap.push({ id: start, cost: costs[start] });
    while (heap.size) {
      const current = heap.pop()!;
      if (current.cost !== costs[current.id]) continue;
      for (const edge of this.nodes[current.id].edges) {
        const candidate = current.cost + edge.length;
        if (candidate >= costs[edge.to]) continue;
        costs[edge.to] = candidate; previous[edge.to] = current.id;
        if (edge.crossing) crossings.set(edge.to, edge.crossing); else crossings.delete(edge.to);
        heap.push({ id: edge.to, cost: candidate });
      }
    }
    let best: { target: NavigationTarget; node: number; distance: number } | null = null;
    for (const target of targets) {
      if (!unlocked.includes(target.areaId)) continue;
      const node = this.nearest(target.areaId, target.position, unlocked, CELL * 2);
      if (node === null || !Number.isFinite(costs[node])) continue;
      const distance = costs[node] + Math.hypot(this.nodes[node].x - target.position.x, this.nodes[node].z - target.position.z);
      if (!best || distance < best.distance - 1e-6 || Math.abs(distance - best.distance) < 1e-6 && target.id < best.target.id) best = { target, node, distance };
    }
    if (!best) return null;
    const chain: number[] = [];
    for (let node = best.node; node !== -1; node = previous[node]) chain.push(node);
    chain.reverse();
    const waypoints: Point[] = [];
    for (const node of chain) {
      const crossing = crossings.get(node);
      if (crossing) waypoints.push({ ...crossing });
      waypoints.push({ x: this.nodes[node].x, z: this.nodes[node].z });
    }
    waypoints.push({ ...best.target.position });
    return { targetId: best.target.id, distance: best.distance, waypoints };
  }
}

import * as THREE from 'three';
import type { AreaDefinition, WorldConnection } from '../../types';

export type VisualChunkKind = 'area' | 'transition';
export type VisualChunkInstance = { root: THREE.Object3D; dispose?: () => void };
export type VisualChunkProvider = {
  id: string;
  kind: VisualChunkKind;
  prefetch: () => Promise<void>;
  create: () => VisualChunkInstance | Promise<VisualChunkInstance>;
};

export type VisualResidencySnapshot = {
  mountedAreaIds: ReadonlySet<number>;
  mountedTransitionIds: ReadonlySet<string>;
  pendingIds: readonly string[];
};

type ChunkRecord = {
  provider: VisualChunkProvider;
  instance?: VisualChunkInstance;
  request?: Promise<void>;
  mountRequest?: Promise<void>;
  prefetched: boolean;
  wanted: boolean;
};

export type StreamingThresholds = { prefetchDistance: number; mountDistance: number; unmountDistance: number };

/** Rendering-only graph residency. Gameplay data and collision never enter this service. */
export class WorldVisualStreamingManager {
  private readonly chunks = new Map<string, ChunkRecord>();
  private readonly mountedAreaIds = new Set<number>();
  private readonly mountedTransitionIds = new Set<string>();

  constructor(
    private readonly scene: THREE.Scene,
    areas: readonly AreaDefinition[],
    private readonly connections: readonly WorldConnection[],
    providers: readonly VisualChunkProvider[],
    private readonly thresholds: StreamingThresholds,
    private readonly onMounted?: (root: THREE.Object3D) => void,
    private readonly onUnmounted?: (root: THREE.Object3D) => void
  ) {
    const expected = new Set([
      ...areas.map((area) => `area:${area.id}`),
      ...connections.map((connection) => `transition:${connection.id}`)
    ]);
    for (const provider of providers) this.chunks.set(provider.id, { provider, prefetched: false, wanted: false });
    for (const id of expected) if (!this.chunks.has(id)) throw new Error(`Missing visual provider: ${id}`);
  }

  update(currentAreaId: number, heroPosition: { x: number; z: number }): VisualResidencySnapshot {
    const wanted = new Set<string>([`area:${currentAreaId}`]);
    const prefetch = new Set(wanted);
    for (const connection of this.connections) {
      const incident = connection.areaAId === currentAreaId || connection.areaBId === currentAreaId;
      if (!incident) continue;
      wanted.add(`transition:${connection.id}`);
      prefetch.add(`transition:${connection.id}`);
      const destinationId = connection.areaAId === currentAreaId ? connection.areaBId : connection.areaAId;
      const destinationKey = `area:${destinationId}`;
      const distance = Math.hypot(heroPosition.x - connection.x, heroPosition.z - connection.z);
      const destinationMounted = this.chunks.get(destinationKey)?.instance !== undefined;
      if (distance <= this.thresholds.prefetchDistance) prefetch.add(destinationKey);
      if (distance <= this.thresholds.mountDistance || (destinationMounted && distance <= this.thresholds.unmountDistance)) wanted.add(destinationKey);
    }

    for (const [id, chunk] of this.chunks) {
      chunk.wanted = wanted.has(id);
      if (prefetch.has(id) || chunk.wanted) void this.prefetch(chunk);
      if (chunk.wanted) {
        if (!chunk.instance && !chunk.mountRequest) chunk.mountRequest = this.mount(chunk);
      } else this.unmount(chunk);
    }
    return this.snapshot;
  }

  private prefetch(chunk: ChunkRecord): Promise<void> {
    if (chunk.prefetched) return Promise.resolve();
    if (chunk.request) return chunk.request;
    chunk.request = chunk.provider.prefetch()
      .catch((error: unknown) => console.warn(`${chunk.provider.id} visual prefetch failed; fallback remains available.`, error))
      .then(() => { chunk.prefetched = true; chunk.request = undefined; });
    return chunk.request;
  }

  private async mount(chunk: ChunkRecord): Promise<void> {
    // Creation is deliberately independent of prefetch completion: procedural
    // fallbacks mount immediately while optional detail packages load.
    const marker = chunk.request;
    const instance = await chunk.provider.create();
    chunk.mountRequest = undefined;
    if (!chunk.wanted || chunk.instance) { instance.dispose?.(); return; }
    chunk.instance = instance;
    this.scene.add(instance.root);
    this.onMounted?.(instance.root);
    this.trackMounted(chunk.provider, true);
    if (marker) void marker;
  }

  private unmount(chunk: ChunkRecord): void {
    if (!chunk.instance) return;
    const { root, dispose } = chunk.instance;
    this.onUnmounted?.(root);
    root.removeFromParent();
    dispose?.();
    chunk.instance = undefined;
    this.trackMounted(chunk.provider, false);
  }

  private trackMounted(provider: VisualChunkProvider, mounted: boolean): void {
    if (provider.kind === 'area') {
      const areaId = Number(provider.id.slice('area:'.length));
      if (mounted) this.mountedAreaIds.add(areaId); else this.mountedAreaIds.delete(areaId);
    } else {
      const id = provider.id.slice('transition:'.length);
      if (mounted) this.mountedTransitionIds.add(id); else this.mountedTransitionIds.delete(id);
    }
  }

  get snapshot(): VisualResidencySnapshot {
    return {
      mountedAreaIds: new Set(this.mountedAreaIds),
      mountedTransitionIds: new Set(this.mountedTransitionIds),
      pendingIds: [...this.chunks].filter(([, chunk]) => Boolean(chunk.request)).map(([id]) => id)
    };
  }

  areaIsMounted(areaId: number): boolean { return this.mountedAreaIds.has(areaId); }
}

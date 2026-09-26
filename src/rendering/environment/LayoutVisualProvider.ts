import type { AnyWorldLayout } from '../../data/world/WorldLayout';
import type { VisualChunkProvider } from './WorldVisualStreamingManager';
import { WorldBuilder, type WorldChunkView } from './WorldBuilder';

export type LayoutVisualProviderHooks = {
  readonly onCreated?: (view: WorldChunkView) => void;
  readonly onDisposed?: (view: WorldChunkView) => void;
};

export function createLayoutVisualProvider(
  layout: AnyWorldLayout,
  builder: WorldBuilder | Promise<WorldBuilder>,
  hooks: LayoutVisualProviderHooks = {},
): VisualChunkProvider {
  let releasePrefetch: (() => void) | undefined;
  let generation = 0;
  return {
    id: layout.kind === 'area' ? `area:${layout.areaId}` : `transition:${layout.connectionId}`,
    kind: layout.kind,
    prefetch: async () => {
      const requestedGeneration = generation;
      const ready = await builder;
      if (requestedGeneration !== generation) return;
      releasePrefetch ??= ready.retain(layout);
      await ready.prefetch(layout);
    },
    evict: () => {
      generation++;
      releasePrefetch?.(); releasePrefetch = undefined;
    },
    create: async () => {
      const view = await (await builder).build(layout);
      try { hooks.onCreated?.(view); }
      catch (error) { view.dispose(); throw error; }
      let disposed = false;
      return {
        root: view.root,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          try { hooks.onDisposed?.(view); } finally { view.dispose(); }
        },
      };
    },
  };
}

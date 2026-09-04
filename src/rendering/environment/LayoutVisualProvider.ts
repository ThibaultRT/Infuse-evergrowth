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
  return {
    id: layout.kind === 'area' ? `area:${layout.areaId}` : `transition:${layout.connectionId}`,
    kind: layout.kind,
    prefetch: async () => (await builder).prefetch(layout),
    create: async () => {
      const view = await (await builder).build(layout);
      hooks.onCreated?.(view);
      return {
        root: view.root,
        dispose: () => {
          hooks.onDisposed?.(view);
          view.dispose();
        },
      };
    },
  };
}

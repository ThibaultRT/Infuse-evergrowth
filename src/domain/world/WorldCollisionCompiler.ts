import { WORLD_PROP_CATALOG, type WorldPropDefinition } from '../../data/world/WorldPropCatalog';
import { expandWorldScatter, type AnyWorldLayout, type ExplicitCollisionVolume, type WorldPropPlacement } from '../../data/world/WorldLayout';
import type { WorldCollisionShape } from './WorldCollision';
import { composeWorldTransform, transformWorldPoint, type WorldTransform } from './WorldPlacement';

export type CompiledWorldCollision = {
  readonly all: readonly WorldCollisionShape[];
  readonly byAreaId: Readonly<Record<number, readonly WorldCollisionShape[]>>;
};

function compileProxy(
  chunk: AnyWorldLayout,
  sourceId: string,
  proxyIndex: number,
  proxy: WorldPropDefinition['collision'][number] | ExplicitCollisionVolume,
  transform: WorldTransform,
  sourcePlacementName?: string,
): WorldCollisionShape {
  const [x, z] = transformWorldPoint(proxy.center, transform);
  const scale = transform.scale ?? 1;
  const id = 'id' in proxy ? `${chunk.id}/${proxy.id}` : `${chunk.id}/${sourceId}/proxy-${proxyIndex + 1}`;
  const base = {
    id,
    sourceChunkId: chunk.id,
    ...(sourcePlacementName ? { sourcePlacementName } : {}),
    ...('activation' in proxy && proxy.activation ? { activation: proxy.activation } : {}),
  };
  return proxy.kind === 'circle'
    ? { ...base, kind: 'circle', x, z, radius: proxy.radius * scale }
    : {
      ...base,
      kind: 'rectangle',
      x,
      z,
      width: proxy.width * scale,
      depth: proxy.depth * scale,
      rotation: (transform.rotation ?? 0) + (proxy.rotation ?? 0),
    };
}

function compilePlacement(chunk: AnyWorldLayout, placement: WorldPropPlacement): WorldCollisionShape[] {
  if (placement.collision === 'none') return [];
  const definition = WORLD_PROP_CATALOG[placement.prop];
  const transform = composeWorldTransform(
    { position: chunk.origin },
    { position: placement.position, rotation: placement.rotation, scale: placement.scale },
  );
  return definition.collision.map((proxy, index) => compileProxy(chunk, placement.name, index, proxy, transform, placement.name));
}

function compileChunk(chunk: AnyWorldLayout): WorldCollisionShape[] {
  const placements = [
    ...chunk.props,
    ...chunk.scatters.flatMap((scatter) => scatter.collision === 'prop-default' ? expandWorldScatter(scatter) : []),
  ];
  const shapes = placements.flatMap((placement) => compilePlacement(chunk, placement));
  const chunkTransform: WorldTransform = { position: chunk.origin };
  shapes.push(...chunk.collision.map((volume, index) => compileProxy(chunk, volume.id, index, volume, chunkTransform)));
  return shapes;
}

export function compileWorldCollision(layouts: readonly AnyWorldLayout[]): CompiledWorldCollision {
  const all = layouts.flatMap(compileChunk);
  const ids = new Set<string>();
  for (const shape of all) {
    if (ids.has(shape.id)) throw new Error(`Duplicate compiled collision id: ${shape.id}`);
    ids.add(shape.id);
  }
  const byAreaId: Record<number, WorldCollisionShape[]> = {};
  for (const layout of layouts) {
    const shapes = all.filter((shape) => shape.sourceChunkId === layout.id);
    const areaIds = layout.kind === 'area' ? [layout.areaId] : layout.areaIds;
    for (const areaId of areaIds) (byAreaId[areaId] ??= []).push(...shapes);
  }
  return { all, byAreaId };
}

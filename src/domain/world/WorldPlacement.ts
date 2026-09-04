export type WorldVec2 = readonly [number, number];
export type WorldVec3 = readonly [number, number, number];

export type WorldTransform = {
  readonly position: WorldVec3;
  readonly rotation?: number;
  readonly scale?: number;
};

export function transformWorldPoint(point: WorldVec2, transform: WorldTransform): WorldVec2 {
  const scale = transform.scale ?? 1;
  const rotation = transform.rotation ?? 0;
  const x = point[0] * scale;
  const z = point[1] * scale;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    transform.position[0] + x * cosine + z * sine,
    transform.position[2] - x * sine + z * cosine,
  ];
}

export function composeWorldTransform(parent: WorldTransform, child: WorldTransform): WorldTransform {
  const [x, z] = transformWorldPoint([child.position[0], child.position[2]], parent);
  return {
    position: [x, parent.position[1] + child.position[1] * (parent.scale ?? 1), z],
    rotation: (parent.rotation ?? 0) + (child.rotation ?? 0),
    scale: (parent.scale ?? 1) * (child.scale ?? 1),
  };
}

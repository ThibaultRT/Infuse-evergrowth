import * as THREE from 'three';
import type { AnyWorldLayout, WorldRoadPlacement, WorldSurfacePlacement } from '../../data/world/WorldLayout';
import type { WorldMaterialSet } from './WorldMaterials';

function edgeFade(layout: AnyWorldLayout, x: number, z: number): number {
  const halfWidth = layout.visualSize.width / 2;
  const halfDepth = layout.visualSize.depth / 2;
  return Math.min(1, Math.max(0, (halfWidth - Math.abs(x)) / 5), Math.max(0, (halfDepth - Math.abs(z)) / 5));
}

export function worldTerrainHeight(layout: AnyWorldLayout, x: number, z: number): number {
  if (layout.kind === 'transition') return 0;
  const ripple = (Math.sin((x + layout.origin[0]) * 0.105) * 0.08 + Math.cos((z + layout.origin[2]) * 0.085) * 0.07) * edgeFade(layout, x, z);
  let height: number;
  if (layout.areaId === 2) {
    const northward = Math.min(1, Math.max(0, (-z + 24) / 48));
    const highland = northward * 1.45 * edgeFade(layout, x, z);
    const basin = Math.exp(-(((x + 39.6) ** 2) / 340 + ((z - 1.2) ** 2) / 30)) * 0.62;
    height = Math.max(-0.38, highland + ripple - basin);
  } else if (layout.areaId === 3) height = 0.85 * edgeFade(layout, x, z) + ripple * 0.65;
  else height = ripple * 0.72;

  for (const cutout of layout.terrainCutouts ?? []) {
    const rotation = cutout.rotation ?? 0;
    const dx = x - cutout.center[0];
    const dz = z - cutout.center[1];
    const localX = Math.cos(rotation) * dx - Math.sin(rotation) * dz;
    const localZ = Math.sin(rotation) * dx + Math.cos(rotation) * dz;
    if (Math.abs(localX) <= cutout.size.width / 2 && Math.abs(localZ) <= cutout.size.depth / 2) {
      height = Math.min(height, cutout.elevation);
    }
  }
  return height;
}

export function createWorldTerrain(layout: AnyWorldLayout, material: THREE.Material): THREE.Mesh {
  // Include cutout boundaries in the grid so coarse terrain triangles cannot
  // stretch over the river or poke through the bridge's landings.
  const axisSamples = (size: number, divisions: number, axis: 0 | 1): number[] => {
    const samples = new Set(Array.from({ length: divisions + 1 }, (_, index) => -size / 2 + size * index / divisions));
    for (const cutout of layout.terrainCutouts ?? []) {
      if (cutout.rotation) continue;
      const extent = (axis === 0 ? cutout.size.width : cutout.size.depth) / 2;
      for (const edge of [-extent, 0, extent]) {
        const point = cutout.center[axis] + edge;
        for (const offset of [-0.01, 0, 0.01]) if (Math.abs(point + offset) < size / 2) samples.add(point + offset);
      }
    }
    return [...samples].sort((a, b) => a - b);
  };
  const xs = axisSamples(layout.visualSize.width, 28, 0);
  const zs = axisSamples(layout.visualSize.depth, 20, 1);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [row, z] of zs.entries()) for (const [column, x] of xs.entries()) {
    positions.push(x, worldTerrainHeight(layout, x, z), z);
    uvs.push(x / layout.visualSize.width + 0.5, 0.5 - z / layout.visualSize.depth);
    if (row === zs.length - 1 || column === xs.length - 1) continue;
    const i = row * xs.length + column;
    indices.push(i, i + xs.length, i + 1, i + 1, i + xs.length, i + xs.length + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${layout.id.replace(':', '_')}_Terrain`;
  mesh.receiveShadow = true;
  mesh.userData.worldOwnedGeometry = true;
  return mesh;
}

export function createWorldRoad(layout: AnyWorldLayout, road: WorldRoadPlacement, materials: WorldMaterialSet): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const samples = curve.getPoints(Math.max(10, (road.points.length - 1) * 8));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tangent = new THREE.Vector2();
  const normal = new THREE.Vector2();
  for (let index = 0; index < samples.length; index += 1) {
    const before = samples[Math.max(0, index - 1)];
    const after = samples[Math.min(samples.length - 1, index + 1)];
    tangent.set(after.x - before.x, after.z - before.z).normalize();
    normal.set(-tangent.y, tangent.x).multiplyScalar(road.width / 2);
    const point = samples[index];
    for (const direction of [1, -1]) {
      const x = point.x + normal.x * direction;
      const z = point.z + normal.y * direction;
      positions.push(x, worldTerrainHeight(layout, x, z) + (road.material === 'water' ? 0.04 : 0.07), z);
    }
    const v = index / Math.max(1, samples.length - 1) * 5;
    uvs.push(0, v, 1, v);
    if (index < samples.length - 1) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = road.material === 'trail' ? materials.trail : road.material === 'cobble' ? materials.cobble : materials.water;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = road.name;
  mesh.receiveShadow = true;
  mesh.userData.worldOwnedGeometry = true;
  return mesh;
}

export function createWorldSurface(surface: WorldSurfacePlacement, materials: WorldMaterialSet): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(surface.size.width, surface.size.depth);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, surface.kind === 'water' ? materials.water : materials.cliff);
  mesh.name = surface.name;
  mesh.position.set(surface.center[0], surface.elevation ?? 0.05, surface.center[1]);
  mesh.rotation.y = surface.rotation ?? 0;
  mesh.receiveShadow = true;
  mesh.userData.worldOwnedGeometry = true;
  return mesh;
}

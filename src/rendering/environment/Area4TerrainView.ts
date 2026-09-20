import * as THREE from 'three';
import { AREA4_SPEC, RIFT_SOUTH_Z } from '../../data/world/area4';
import { AREA4_BOUNDARY_SPEC, AREA4_SOUTH_GROUND_Z } from '../../data/world/area4Boundaries';
import type { AreaWorldLayout, WorldRiftBank } from '../../data/world/WorldLayout';
import { sampleWorldRoad } from './WorldGeometry';

type Point = readonly [number, number, number];
export type Area4MaterialSet = {
  readonly ground: THREE.MeshStandardMaterial;
  readonly rock: THREE.MeshStandardMaterial;
  readonly depth: THREE.MeshBasicMaterial;
  readonly molten: THREE.MeshBasicMaterial;
};

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const grain = (x: number, z: number): number => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function tiledNoise(x: number, z: number, cells: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const at = (dx: number, dz: number): number => grain((ix + dx) % cells, (iz + dz) % cells);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0, 0), at(1, 0), sx), THREE.MathUtils.lerp(at(0, 1), at(1, 1), sx), sz);
}

/** A small, repeatable ash grain, generated once. No network dependency or shader. */
export function createArea4Materials(): Area4MaterialSet {
  const size = 256, pixels = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const fleck = grain(x, z);
    const soot = tiledNoise(x / size * 8, z / size * 8, 8);
    const grit = tiledNoise(x / size * 32, z / size * 32, 32);
    const value = Math.round(156 + 46 * soot + 25 * grit + 19 * fleck - (fleck < 0.075 ? 48 : 0));
    pixels.set([value, value, value, 255], (z * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.name = 'Area4_ProceduralAshGrain';
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return {
    ground: new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    // Fog, sunlight, exposure and shadow passes must never reveal an abyss floor.
    depth: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide }),
    molten: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}

class ColoredFaces {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];

  face(points: readonly Point[], colors: readonly THREE.Color[]): void {
    for (let i = 1; i < points.length - 1; i++) for (const index of [0, i, i + 1]) {
      this.positions.push(...points[index]);
      this.colors.push(...colors[index].toArray());
    }
  }

  mesh(name: string, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.worldOwnedGeometry = true;
    return mesh;
  }
}

/** The same authored curves paint the routes into flat ground, with soft ash edges. */
export function createArea4Ground(layout: AreaWorldLayout, material: THREE.Material): THREE.Mesh {
  const paths = layout.roads.map((road) => ({ points: sampleWorldRoad(road), halfWidth: road.width / 2 }));
  const minZ = RIFT_SOUTH_Z - layout.origin[2], maxZ = AREA4_SOUTH_GROUND_Z;
  const width = layout.visualSize.width, columns = Math.ceil(width), rows = Math.ceil(maxZ - minZ);
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const charcoal = new THREE.Color(0x303034), ash = new THREE.Color(0x777579), trail = new THREE.Color(0xa59e93);
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const x = -width / 2 + width * column / columns + (column > 0 && column < columns ? (grain(column, row) - .5) * .55 : 0);
    const z = minZ + (maxZ - minZ) * row / rows + (row > 0 && row < rows ? (grain(row, column) - .5) * .55 : 0);
    let route = 0;
    for (const path of paths) for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1));
      route = Math.max(route, clamp((path.halfWidth + 1.3 - Math.hypot(x - a.x - t * dx, z - a.z - t * dz)) / 2));
    }
    for (const spot of layout.encounterSpots ?? []) route = Math.max(route, .7 * clamp((spot.radius + 2 - Math.hypot(x - spot.center[0], z - spot.center[1])) / 3));
    const drift = clamp(.43 + .23 * Math.sin(x * .27 + Math.sin(z * .38)) + .18 * Math.sin(z * .64 + x * .12) + .1 * grain(column, row));
    const color = charcoal.clone().lerp(ash, drift).lerp(trail, route * .78);
    positions.push(x, 0, z);
    colors.push(...color.toArray());
    uvs.push(x / 4, z / 4);
    if (row < rows && column < columns) {
      const i = row * (columns + 1) + column;
      indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'A04_AshAndCharcoalGround';
  mesh.receiveShadow = true;
  mesh.userData = { worldOwnedGeometry: true, authoredRoads: layout.roads.map((road) => road.name) };
  return mesh;
}

/** Each bank owns its land cap and fractured wall; the far end is already black. */
export function createRiftBanks(banks: readonly WorldRiftBank[], originX: number, materials: Area4MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Rift_FracturedBanks';
  for (const bank of banks) {
    const cap = new ColoredFaces(), wall = new ColoredFaces();
    const tint = new THREE.Color(bank.palette === 'meadow' ? 0x66695c : bank.palette === 'stone' ? 0x74736b : 0x454044);
    const levels = [0, -1.2, -3.8, -8, bank.darknessY, bank.bottomY];
    const darkness = [1, .68, .32, .07, 0, 0];
    const side = bank.landZ < 0 ? 1 : -1;
    for (let i = 1; i < bank.edge.length; i++) {
      const [ax, az] = bank.edge[i - 1], [bx, bz] = bank.edge[i];
      const shade = .7 + .3 * grain(ax + originX, bank.landZ);
      const top = tint.clone().multiplyScalar(shade);
      cap.face([[ax, 0, bank.landZ], [ax, 0, az], [bx, 0, bz], [bx, 0, bank.landZ]], [tint, top, top, tint]);
      for (let layer = 1; layer < levels.length; layer++) {
        const point = (x: number, z: number, row: number): Point => {
          if (row === 0 || row >= levels.length - 2) return [x, levels[row], z];
          const worldX = x + originX;
          // Shared vertices keep facets watertight. Endpoints stay on the owner seam.
          const end = x === bank.edge[0][0] || x === bank.edge[bank.edge.length - 1][0];
          return [x + (end ? 0 : (grain(worldX, row) - .5) * .55), levels[row] + (grain(worldX, row + 5) - .5) * row * .65, z + side * (grain(worldX, row + 9) - .3) * .9];
        };
        const upper = top.clone().multiplyScalar(darkness[layer - 1]), lower = top.clone().multiplyScalar(darkness[layer]);
        const a = point(ax, az, layer - 1), b = point(ax, az, layer), c = point(bx, bz, layer), d = point(bx, bz, layer - 1);
        const facet = .56 + .44 * grain(ax + originX, layer + 16);
        wall.face([a, b, c], [upper, lower, lower]);
        wall.face([a, c, d], [upper.clone().multiplyScalar(facet), lower.clone().multiplyScalar(facet), upper.clone().multiplyScalar(facet)]);
      }
    }
    const capMesh = cap.mesh(`${bank.name}_Lip`, materials.rock);
    capMesh.receiveShadow = true;
    group.add(capMesh, wall.mesh(`${bank.name}_Depth`, materials.depth));
  }
  return group;
}

/** Unit-radius basin: all raised rim and lava stay inside the semantic circle.
 * The molten surface sits below its crust rim; nothing projects into walkable ground. */
export function createLavaBasin(materials: Area4MaterialSet): THREE.Group {
  const rim = new ColoredFaces(), lava = new ColoredFaces(), segments = 22;
  const rings = Array.from({ length: segments }, (_, i) => {
    const angle = Math.PI * 2 * i / segments, radius = .79 + .2 * grain(i, 4);
    return { x: Math.cos(angle), z: Math.sin(angle), radius, height: .1 + .11 * grain(i, 7) };
  });
  const basalt = new THREE.Color(0x282429), crust = new THREE.Color(0x494044);
  for (let i = 0; i < segments; i++) {
    const a = rings[i], b = rings[(i + 1) % segments];
    const point = (p: typeof a, radius: number, y: number): Point => [p.x * radius, y, p.z * radius];
    const outerA = point(a, a.radius, .002), outerB = point(b, b.radius, .002);
    const lipA = point(a, a.radius * .86, a.height), lipB = point(b, b.radius * .86, b.height);
    const innerA = point(a, a.radius * .67, .025), innerB = point(b, b.radius * .67, .025);
    rim.face([outerA, lipA, lipB, outerB], [basalt, crust, crust, basalt]);
    rim.face([lipA, innerA, innerB, lipB], [crust, basalt, basalt, crust]);
    const glow = new THREE.Color(0xe9430a), hot = new THREE.Color(0xffa431);
    lava.face([[0, .029, 0], innerB, innerA], [hot, glow, glow]);
  }
  // Dark cooled plates divide the molten pool into small bright fissures.
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996, distance = .51 * Math.sqrt((i + .5) / 19);
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance, radius = .12 + .06 * grain(i, 11);
    const polygon: Point[] = Array.from({ length: 5 }, (_, j) => [x + Math.cos(j * Math.PI * 2 / 5 + angle) * radius, .033, z + Math.sin(j * Math.PI * 2 / 5 + angle) * radius]);
    rim.face(polygon.reverse(), polygon.map(() => basalt.clone().multiplyScalar(.8 + .3 * grain(i, 13))));
  }
  const group = new THREE.Group();
  group.add(rim.mesh('Lava_BasaltCrust', materials.rock), lava.mesh('Lava_MoltenFissures', materials.molten));
  return group;
}

/** A complete southern shore, entirely inside the lake's semantic rectangle.
 * The ash ground ends at its north edge; crust is scenery, never a crossing. */
export function createArea4LavaLake(materials: Area4MaterialSet): THREE.Group {
  const { depth, surfaceY, bankWidth, bankHeight } = AREA4_BOUNDARY_SPEC.southLake;
  const width = AREA4_SPEC.visualSize.width, north = -depth / 2;
  const bank = new ColoredFaces(), molten = new ColoredFaces(), crust = new ColoredFaces();
  const basalt = new THREE.Color(0x242125), ash = new THREE.Color(0x55484a);
  const cool = new THREE.Color(0x9c2106), hot = new THREE.Color(0xff941e);
  const columns = Math.ceil(width / 1.3), rows = 7;
  for (let column = 0; column < columns; column++) {
    const ax = -width / 2 + width * column / columns, bx = -width / 2 + width * (column + 1) / columns;
    const edge = (x: number): { z: number; y: number } => ({ z: north + bankWidth * (.65 + .35 * grain(x, 3)), y: bankHeight * (.4 + .6 * grain(x, 6)) });
    const a = edge(ax), b = edge(bx);
    const shade = ash.clone().multiplyScalar(.65 + .35 * grain(ax, 8));
    bank.face([[ax, 0, north], [ax, a.y, a.z], [bx, b.y, b.z], [bx, 0, north]], [basalt, shade, shade, basalt]);
    bank.face([[ax, a.y, a.z], [ax, surfaceY, a.z + .35], [bx, surfaceY, b.z + .35], [bx, b.y, b.z]], [shade, basalt, basalt, shade]);
    for (let row = 0; row < rows; row++) {
      const az = north + depth * row / rows, bz = north + depth * (row + 1) / rows;
      const points: Point[] = [[ax, surfaceY, az], [ax, surfaceY, bz], [bx, surfaceY, bz], [bx, surfaceY, az]];
      molten.face(points, points.map(([x, , z]) => cool.clone().lerp(hot, clamp(.4 + .28 * Math.sin(x * .6 + z * 1.8) + .15 * Math.sin(x * 1.7 - z)))));
    }
  }
  // Contracted Voronoi cells make irregular crust plates and branching molten
  // channels, without a repeating stepping-stone pattern or texture request.
  type Site = readonly [number, number];
  const crustNorth = north + bankWidth + .4, crustSouth = depth / 2;
  const sites: Site[] = Array.from({ length: 220 }, (_, i) => [
    (grain(i, 61) - .5) * width,
    crustNorth + grain(i, 73) * (crustSouth - crustNorth),
  ]);
  for (const [index, site] of sites.entries()) {
    let polygon: Site[] = [[-width / 2, crustNorth], [-width / 2, crustSouth], [width / 2, crustSouth], [width / 2, crustNorth]];
    for (const other of sites) {
      if (other === site) continue;
      const dx = other[0] - site[0], dz = other[1] - site[1];
      const limit = (other[0] ** 2 + other[1] ** 2 - site[0] ** 2 - site[1] ** 2) / 2;
      const clipped: Site[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const da = a[0] * dx + a[1] * dz - limit, db = b[0] * dx + b[1] * dz - limit;
        if (da <= 0) clipped.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db);
          clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      polygon = clipped;
    }
    const contraction = .68 + .2 * grain(index, 83);
    const color = basalt.clone().lerp(ash, .4 * grain(index, 97));
    const points: Point[] = polygon.map(([x, z]) => [site[0] + (x - site[0]) * contraction, surfaceY + .035, site[1] + (z - site[1]) * contraction]);
    crust.face(points, points.map(() => color));
  }
  const group = new THREE.Group();
  const shore = bank.mesh('SouthLake_FracturedShore', materials.rock);
  shore.receiveShadow = true;
  group.add(shore, molten.mesh('SouthLake_MoltenSurface', materials.molten), crust.mesh('SouthLake_CooledRafts', materials.rock));
  return group;
}

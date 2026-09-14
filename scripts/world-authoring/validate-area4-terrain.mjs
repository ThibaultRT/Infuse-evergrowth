import assert from 'node:assert/strict';
import * as THREE from 'three';

/** Check the rendered terrain against traversal authority, including asset-free views. */
export async function validateArea4Terrain(vite) {
  const [{ WORLD_LAYOUTS }, { AREA4_SPEC: spec, RIFT_NORTH_Z, RIFT_SOUTH_Z }, { createWorldTerrain }, terrain, { createWorldMaterials }, { WORLD_PROP_CATALOG }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/index.ts'),
    vite.ssrLoadModule('/src/data/world/area4.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'),
    vite.ssrLoadModule('/src/rendering/environment/Area4TerrainView.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldMaterials.ts'),
    vite.ssrLoadModule('/src/data/world/WorldPropCatalog.ts'),
  ]);
  const materials = await createWorldMaterials({ loadTexture: async () => new THREE.Texture() });
  assert.equal(materials.abyss.isMeshBasicMaterial, true);
  assert.equal(materials.abyss.color.getHex(), 0);
  assert.equal(materials.abyss.fog, false, 'Sky fog must not reveal the bottom.');
  assert.equal(materials.abyss.toneMapped, false);
  assert.ok(spec.rift.floorY < spec.rift.darknessY && spec.rift.darknessY <= -12);
  const layout = WORLD_LAYOUTS.find((chunk) => chunk.id === 'area:A04');
  const ground = terrain.createArea4Ground(layout, materials.area4.ground);
  const position = ground.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    assert.equal(position.getY(i), 0, 'Ash routes/clearings must remain on the authored ground datum.');
    assert.ok(position.getZ(i) + layout.origin[2] >= RIFT_SOUTH_Z, 'Ash ground covers the rift.');
  }
  let triangles = ground.geometry.index.count / 3;
  ground.geometry.dispose();

  for (const chunk of WORLD_LAYOUTS.filter((chunk) => chunk.terrainCutouts?.some((cutout) => cutout.open))) {
    const mesh = createWorldTerrain(chunk, materials.abyss), { index, attributes } = mesh.geometry;
    for (let i = 0; i < index.count; i += 3) {
      const centerZ = [0, 1, 2].reduce((sum, j) => sum + attributes.position.getZ(index.getX(i + j)), 0) / 3 + chunk.origin[2];
      assert.ok(centerZ <= RIFT_NORTH_Z || centerZ >= RIFT_SOUTH_Z, `${chunk.id} still renders a floor/slope across the open rift.`);
    }
    mesh.geometry.dispose();
  }
  const transitions = WORLD_LAYOUTS.filter((chunk) => chunk.riftBanks);
  for (const chunk of transitions) {
    const banks = terrain.createRiftBanks(chunk.riftBanks, chunk.origin[0], materials.area4);
    for (const bank of chunk.riftBanks) for (const [x, z] of bank.edge) {
      assert.ok(bank.landZ < 0 ? z >= bank.landZ : z <= bank.landZ, 'A jagged lip retreats into walkable land.');
      if (Math.abs(x - chunk.crossingCenter) <= spec.bridge.width / 2 + .55) assert.equal(z, bank.landZ, 'A rock lip projects through a bridge landing.');
    }
    banks.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const { position, color } = mesh.geometry.attributes;
      triangles += position.count / 3;
      if (mesh.name.endsWith('_Depth')) for (let i = 0; i < position.count; i++) {
        if (position.getY(i) <= spec.rift.darknessY) assert.equal(color.getX(i) + color.getY(i) + color.getZ(i), 0, 'Deep rock must disappear into black.');
      }
      mesh.geometry.dispose();
    });
  }
  for (const side of [0, 1]) {
    const west = transitions[0].riftBanks[side].edge.at(-1), east = transitions[1].riftBanks[side].edge[0];
    assert.equal(west[0] + transitions[0].origin[0], east[0] + transitions[1].origin[0]);
    assert.equal(west[1], east[1], 'Rift owners disagree at the shared bank seam.');
  }
  for (const pool of spec.lavaPools) {
    const placement = layout.props.find((prop) => prop.name === pool.id);
    const definition = WORLD_PROP_CATALOG[placement.prop];
    assert.deepEqual(definition.collision, [{ kind: 'circle', center: [0, 0], radius: 1 }]);
    assert.equal(placement.scale, pool.radius);
    const basin = terrain.createLavaBasin(materials.area4);
    basin.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position;
      triangles += p.count / 3;
      for (let i = 0; i < p.count; i++) assert.ok(Math.hypot(p.getX(i), p.getZ(i)) <= 1, 'A lava rim projects outside its collision footprint.');
      mesh.geometry.dispose();
    });
  }
  assert.ok(triangles < 21000, `Terrain pass exceeds its 21k triangle budget: ${triangles}.`);
  const shared = new Set([...Object.values(materials.terrain), ...Object.values(materials.area4), ...Object.values(materials.blockout), ...Object.values(materials).filter((value) => value?.isMaterial)]);
  for (const material of shared) { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }
  console.log(`Area 4 terrain: open rift, black depth, continuous banks, flat routes and contained lava; ${triangles} procedural triangles, one 256px texture.`);
}

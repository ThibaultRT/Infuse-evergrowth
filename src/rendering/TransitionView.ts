import * as THREE from 'three';
import { AREAS } from '../config';
import { lakeBarrierBounds, lakeBarrierSegments } from '../domain/world/LakeBoundary';
import type { WorldConnection } from '../types';
import { GateView, prefetchGateDetails } from './GateView';

/** Prefetches only shared asset details; the procedural transition itself is immediate. */
export async function prefetchTransitionDetails(_connection: WorldConnection): Promise<void> {
  await prefetchGateDetails();
}

/**
 * Owns one connection's complete fallback presentation. The root is local to the
 * connection and may later be replaced by one independently exported transition GLB.
 */
export class TransitionView {
  readonly root = new THREE.Group();
  private readonly gate: GateView;
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private disposed = false;

  constructor(readonly connection: WorldConnection) {
    this.root.name = `Transition ${connection.id}`;
    this.root.position.set(connection.x, 0, connection.z);
    this.gate = new GateView(connection.axis, connection.visualStyle);
    this.gate.root.userData.gateId = connection.id;
    this.root.add(this.gate.root);
    if (connection.visualStyle === 'lake-gate') this.buildLakeFallback();
    else this.buildRuinedFallback();
  }

  private material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial(parameters); this.ownedMaterials.add(material); return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, worldX: number, y: number, worldZ: number): THREE.Mesh {
    this.ownedGeometries.add(geometry);
    const value = new THREE.Mesh(geometry, material);
    value.position.set(worldX - this.connection.x, y, worldZ - this.connection.z);
    return value;
  }

  private rock(worldX: number, y: number, worldZ: number, sx: number, sy: number, sz: number, material: THREE.Material): THREE.Mesh {
    const rock = this.mesh(new THREE.IcosahedronGeometry(1, 1), material, worldX, y, worldZ);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set(.08 * worldZ, .17 * worldX, .04 * worldX);
    return rock;
  }

  private buildLakeFallback(): void {
    const water = this.material({ color: 0x277e9e, roughness: .24, metalness: .08, transparent: true, opacity: .93 });
    const stone = this.material({ color: 0x626556, roughness: 1 });
    const bounds = lakeBarrierBounds(this.connection, AREAS);
    for (const lake of lakeBarrierSegments(this.connection, bounds.minX, bounds.maxX)) {
      const surface = this.mesh(
        new THREE.PlaneGeometry(lake.maxX - lake.minX, lake.maxZ - lake.minZ),
        water,
        (lake.minX + lake.maxX) / 2,
        .04,
        (lake.minZ + lake.maxZ) / 2
      );
      surface.rotation.x = -Math.PI / 2;
      this.root.add(surface);
    }
    for (let x = -18; x <= 18; x += 2.6) {
      if (x > 5 && x < 11) continue;
      const z = -25.4 + Math.sin(x * .72) * .55 + Math.sin(x * 1.8) * .2;
      this.root.add(this.rock(x, .2, z, 1.25, .45, .9, stone));
    }
    for (let x = -18; x <= 18; x += 2.6) {
      if (x > 5 && x < 11) continue;
      const z = -30.6 + Math.sin(x * .61) * .4 + Math.sin(x * 1.55) * .16;
      this.root.add(this.rock(x, .18, z, 1.15, .4, .82, stone));
    }
    for (const x of [5.85, 10.15]) for (let z = -31.5; z <= -24.5; z += 2.25) this.root.add(this.rock(x, .35, z, .45, .55, .65, stone));
    for (const [x, z, s] of [[-10, -28.4, 1.35], [1, -29, 1.05], [16, -28.2, .9]] as const) this.root.add(this.rock(x, .15, z, s, .45, s * .75, stone));
  }

  private buildRuinedFallback(): void {
    const rubble = this.material({ color: 0x62645e, roughness: 1 });
    const axisX = this.connection.axis === 'x';
    for (const [along, away, scale] of [[-4.8, -1.1, .85], [-4.2, 1.2, .65], [4.6, -1.3, .75], [5.1, 1, .9]] as const) {
      const x = this.connection.x + (axisX ? away : along);
      const z = this.connection.z + (axisX ? along : away);
      this.root.add(this.rock(x, .25, z, scale, .5, scale * .8, rubble));
    }
  }

  setOpen(open: boolean): void { this.gate.setOpen(open); }
  update(dt: number): void { this.gate.update(dt); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gate.dispose();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.root.clear();
  }
}

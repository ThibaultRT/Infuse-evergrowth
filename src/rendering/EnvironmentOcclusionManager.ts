import * as THREE from 'three';

type FadeEntry = { object: THREE.Object3D; meshes: THREE.Mesh[]; amount: number; name: string };

/** Rendering-only protection against tall scenery hiding the followed hero. */
export class EnvironmentOcclusionManager {
  private readonly raycaster = new THREE.Raycaster();
  private readonly entries: FadeEntry[] = [];
  private readonly targets = [new THREE.Vector3(), new THREE.Vector3()];
  private fadedNames: string[] = [];

  constructor(private readonly camera: THREE.Camera, roots: readonly THREE.Object3D[]) {
    for (const root of roots) root.traverse((object) => {
      if (!object.userData.cameraOccluder) return;
      const meshes: THREE.Mesh[] = [];
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const wasMaterialArray = Array.isArray(child.material);
        const sourceMaterials: THREE.Material[] = wasMaterialArray ? child.material : [child.material];
        const materials = sourceMaterials.map((source) => {
          const material = source.clone(); material.transparent = true; material.depthWrite = true; return material;
        });
        // A material array is meaningful only for geometry groups. Turning a
        // single material into an array makes Three's raycaster look up a
        // nonexistent group material and abort the frame before it is rendered.
        child.material = wasMaterialArray ? materials : materials[0];
        meshes.push(child);
      });
      if (meshes.length) this.entries.push({ object, meshes, amount: 0, name: object.name || `occluder-${this.entries.length + 1}` });
    });
  }

  update(heroPosition: THREE.Vector3, dt: number): void {
    this.targets[0].set(heroPosition.x, heroPosition.y + .9, heroPosition.z);
    this.targets[1].set(heroPosition.x, heroPosition.y + 1.65, heroPosition.z);
    const hit = new Set<THREE.Object3D>();
    for (const target of this.targets) {
      const direction = target.clone().sub(this.camera.position);
      const distance = direction.length();
      this.raycaster.set(this.camera.position, direction.normalize()); this.raycaster.far = Math.max(0, distance - .35);
      for (const intersection of this.raycaster.intersectObjects(this.entries.map((entry) => entry.object), true)) {
        let tagged: THREE.Object3D | null = intersection.object;
        while (tagged && !tagged.userData.cameraOccluder) tagged = tagged.parent;
        if (tagged) hit.add(tagged);
      }
    }
    this.fadedNames = [];
    for (const entry of this.entries) {
      entry.amount = THREE.MathUtils.damp(entry.amount, hit.has(entry.object) ? 1 : 0, hit.has(entry.object) ? 10 : 5, dt);
      if (entry.amount > .04) this.fadedNames.push(entry.name);
      for (const mesh of entry.meshes) for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        material.opacity = THREE.MathUtils.lerp(1, .14, entry.amount);
        material.depthWrite = entry.amount < .25;
      }
    }
  }

  get diagnostic(): string { return this.fadedNames.length ? `${this.fadedNames.length} faded: ${this.fadedNames.join(', ')}` : '0 faded occluders'; }
}

import * as THREE from 'three';

/** Owns smooth follow and temporary scripted focus movement. */
export class CameraController {
  private focusTarget: THREE.Vector3 | null = null;
  private focusExpiresAt = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly heroPosition: THREE.Vector3) {}

  get isScripted(): boolean { return this.focusTarget !== null; }
  focus(point: THREE.Vector3, durationMs: number): void {
    this.focusTarget = point.clone();
    this.focusExpiresAt = performance.now() + durationMs;
  }
  returnToHero(): void { this.focusTarget = null; }
  update(dt: number, now: number): void {
    if (this.focusTarget && now < this.focusExpiresAt) {
      this.camera.position.lerp(new THREE.Vector3(this.focusTarget.x, 16, this.focusTarget.z + 12), 1 - Math.exp(-3.2 * dt));
      this.camera.lookAt(this.focusTarget.x, 1.25, this.focusTarget.z);
      return;
    }
    this.focusTarget = null;
    this.camera.position.lerp(new THREE.Vector3(this.heroPosition.x, 19, this.heroPosition.z + 16.5), 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.heroPosition.x, .9, this.heroPosition.z - 2.5);
  }
}

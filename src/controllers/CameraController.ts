import * as THREE from 'three';

// Replace this value with the distance chosen using the temporary HUD slider.
export const DEFAULT_CAMERA_DISTANCE = 25.2;
const FOLLOW_HEIGHT_SHARE = 19 / Math.hypot(19, 16.5);
const FOLLOW_DEPTH_SHARE = 16.5 / Math.hypot(19, 16.5);

/** Owns smooth follow and temporary scripted focus movement. */
export class CameraController {
  private focusTarget: THREE.Vector3 | null = null;
  private focusExpiresAt = 0;
  private followDistance = DEFAULT_CAMERA_DISTANCE;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly heroPosition: THREE.Vector3) {}

  get isScripted(): boolean { return this.focusTarget !== null; }
  focus(point: THREE.Vector3, durationMs: number): void {
    this.focusTarget = point.clone();
    this.focusExpiresAt = performance.now() + durationMs;
  }
  returnToHero(): void { this.focusTarget = null; }
  setFollowDistance(distance: number): void { this.followDistance = distance; }
  snapToHero(): void {
    this.camera.position.set(
      this.heroPosition.x,
      this.heroPosition.y + this.followDistance * FOLLOW_HEIGHT_SHARE,
      this.heroPosition.z + this.followDistance * FOLLOW_DEPTH_SHARE
    );
    this.camera.lookAt(this.heroPosition.x, this.heroPosition.y + .9, this.heroPosition.z - 2.5);
  }
  update(dt: number, now: number): void {
    if (this.focusTarget && now < this.focusExpiresAt) {
      this.camera.position.lerp(new THREE.Vector3(this.focusTarget.x, this.focusTarget.y + 16, this.focusTarget.z + 12), 1 - Math.exp(-3.2 * dt));
      this.camera.lookAt(this.focusTarget.x, this.focusTarget.y + 1.25, this.focusTarget.z);
      return;
    }
    this.focusTarget = null;
    this.camera.position.lerp(new THREE.Vector3(
      this.heroPosition.x,
      this.heroPosition.y + this.followDistance * FOLLOW_HEIGHT_SHARE,
      this.heroPosition.z + this.followDistance * FOLLOW_DEPTH_SHARE
    ), 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.heroPosition.x, this.heroPosition.y + .9, this.heroPosition.z - 2.5);
  }
}

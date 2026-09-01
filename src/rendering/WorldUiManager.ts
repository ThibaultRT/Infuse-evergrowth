import * as THREE from 'three';

type ScreenOffset = { x: number; y: number };
type FloatingText = { element: HTMLDivElement; position: THREE.Vector3; screenOffset: ScreenOffset; age: number; duration: number };

/** Owns world-to-screen DOM projection and floating combat-text lifetime. */
export class WorldUiManager {
  private readonly projected = new THREE.Vector3();
  private readonly floatingTexts: FloatingText[] = [];

  constructor(private readonly camera: THREE.Camera, private readonly canvas: HTMLCanvasElement, private readonly host: HTMLElement) {}

  project(position: THREE.Vector3, element: HTMLElement, yOffset = 0): boolean {
    this.projected.copy(position); this.projected.y += yOffset; this.projected.project(this.camera);
    const shown = this.projected.z >= -1 && this.projected.z <= 1 && this.projected.x >= -1.08 && this.projected.x <= 1.08 && this.projected.y >= -1.08 && this.projected.y <= 1.08;
    element.style.visibility = shown ? 'visible' : 'hidden';
    if (!shown) return false;
    element.style.left = `${(this.projected.x * .5 + .5) * this.canvas.clientWidth}px`;
    element.style.top = `${(-this.projected.y * .5 + .5) * this.canvas.clientHeight}px`;
    return true;
  }

  addCombatText(position: THREE.Vector3, html: string, incoming: boolean, screenOffset: ScreenOffset = { x: 0, y: 0 }): void {
    const element = document.createElement('div');
    element.className = `combat-text${incoming ? ' incoming' : ''}`; element.innerHTML = html; this.host.append(element);
    this.floatingTexts.push({ element, position: position.clone(), screenOffset, age: 0, duration: .9 });
  }

  update(dt: number): void {
    for (let index = this.floatingTexts.length - 1; index >= 0; index--) {
      const item = this.floatingTexts[index]; item.age += dt;
      if (item.age >= item.duration) { item.element.remove(); this.floatingTexts.splice(index, 1); continue; }
      if (this.project(item.position, item.element)) {
        const progress = item.age / item.duration;
        item.element.style.transform = `translate(calc(-50% + ${item.screenOffset.x}px), calc(-50% + ${item.screenOffset.y}px - ${progress * 24}px))`;
        item.element.style.opacity = String(1 - progress);
      }
    }
  }
}

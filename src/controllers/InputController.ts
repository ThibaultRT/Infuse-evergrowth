export type MovementInput = Readonly<{ x: number; y: number }>;

/** Normalizes keyboard and touch controls into one renderer-independent input. */
export class InputController {
  private readonly keys = new Set<string>();
  private joystickPointer: number | null = null;
  private joystickX = 0;
  private joystickY = 0;

  constructor(
    private readonly joystick: HTMLElement,
    private readonly joystickKnob: HTMLElement
  ) {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    joystick.addEventListener('pointerdown', this.onPointerDown);
    joystick.addEventListener('pointermove', this.onPointerMove);
    joystick.addEventListener('pointerup', this.onPointerEnd);
    joystick.addEventListener('pointercancel', this.onPointerEnd);
  }

  get movement(): MovementInput {
    let x = this.joystickX;
    let y = -this.joystickY;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x--;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x++;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y++;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y--;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  reset(): void {
    this.joystickPointer = null;
    this.joystickX = 0;
    this.joystickY = 0;
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => { this.keys.add(event.code); };
  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private readonly onPointerDown = (event: PointerEvent): void => {
    this.joystickPointer = event.pointerId;
    this.joystick.setPointerCapture(event.pointerId);
  };
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    const rect = this.joystick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * .34;
    const length = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(length, radius);
    const x = dx / length * clamped;
    const y = dy / length * clamped;
    this.joystickX = x / radius;
    this.joystickY = y / radius;
    this.joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };
  private readonly onPointerEnd = (): void => { this.reset(); };
}

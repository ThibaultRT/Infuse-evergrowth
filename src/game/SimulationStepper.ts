import { SIMULATION_TIMING } from '../config';

/** Fixed foreground steps, independent of the presentation frame-rate limit. */
export class SimulationStepper {
  private remainder = 0;
  constructor(private readonly step = SIMULATION_TIMING.stepSeconds,
    private readonly maxCatchUp = SIMULATION_TIMING.maxCatchUpSeconds) {}

  advance(elapsed: number, update: (dt: number) => void): number {
    const accepted = Math.min(Math.max(0, elapsed), this.maxCatchUp);
    this.remainder += accepted;
    const steps = Math.floor((this.remainder + 1e-9) / this.step);
    this.remainder = Math.max(0, this.remainder - steps * this.step);
    for (let index = 0; index < steps; index++) update(this.step);
    return Math.max(0, elapsed - accepted);
  }

  reset(): void { this.remainder = 0; }
}

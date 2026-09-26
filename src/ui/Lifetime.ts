type UiEvents = WindowEventMap & DocumentEventMap & HTMLElementEventMap & { webglcontextlost: Event; webglcontextrestored: Event };

/** Owns browser callbacks so a mounted presentation can be cleanly removed. */
export class Lifetime {
  private readonly controller = new AbortController();
  private readonly cleanups: (() => void)[] = [];
  private readonly frames = new Set<number>();
  private readonly timers = new Set<number>();
  get disposed(): boolean { return this.controller.signal.aborted; }

  listen<K extends keyof UiEvents>(target: EventTarget | null | undefined, type: K,
    listener: (event: UiEvents[K]) => void, options: AddEventListenerOptions = {}): void {
    target?.addEventListener(type, listener as EventListener, { ...options, signal: this.controller.signal });
  }
  add(cleanup: () => void): void { this.cleanups.push(cleanup); }
  frame(callback: FrameRequestCallback): number {
    const id = requestAnimationFrame((time) => { this.frames.delete(id); if (!this.disposed) callback(time); });
    this.frames.add(id);
    return id;
  }
  timeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => { this.timers.delete(id); if (!this.disposed) callback(); }, delay);
    this.timers.add(id);
    return id;
  }
  dispose(): void {
    if (this.disposed) return;
    this.controller.abort();
    this.frames.forEach(cancelAnimationFrame);
    this.timers.forEach(clearTimeout);
    this.cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    this.frames.clear(); this.timers.clear();
  }
}

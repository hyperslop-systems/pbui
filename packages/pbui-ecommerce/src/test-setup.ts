/*
 * jsdom lacks the layout APIs the plot host measures with. ResponsivePlot
 * sizes its content box with a ResizeObserver; report one usable size so a
 * plot tile renders under test.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class FakeResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const entry = { target, contentRect: { width: 640, height: 360, x: 0, y: 0, top: 0, left: 0, right: 640, bottom: 360, toJSON: () => ({}) } } as unknown as ResizeObserverEntry;
      queueMicrotask(() => this.callback([entry], this as unknown as ResizeObserver));
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
}
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

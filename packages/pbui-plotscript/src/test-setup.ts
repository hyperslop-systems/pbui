/**
 * jsdom lacks the layout APIs CodeMirror measures with. None of them affect
 * what the tests assert (document text, dispatches, attributes), so they are
 * stubbed rather than polyfilled.
 */
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) });

if (typeof Range !== "undefined") {
  Range.prototype.getBoundingClientRect = rect as unknown as Range["getBoundingClientRect"];
  Range.prototype.getClientRects = (() => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })) as unknown as Range["getClientRects"];
}
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// ResponsivePlot measures its content box with a ResizeObserver; jsdom has
// none. Report one usable size so the plot renders.
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

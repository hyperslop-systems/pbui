import { anchorId, emptyBounds, hasArea, intersection, type AnchorGeometry, type AnchorKey, type FrameGeometry, type Rect, type WiringGeometry } from "./model";

interface Registration { element: HTMLElement; token: object }
interface AnchorRegistration extends Registration { key: AnchorKey }

/** One mounted surface owns these registrations. No module-global DOM state. */
export function createGeometryStore() {
  let root: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let frame: number | null = null;
  let signature = "";
  let epoch = 0;
  const frames = new Map<string, Registration>();
  const anchors = new Map<string, AnchorRegistration>();
  const listeners = new Set<() => void>();
  let snapshot: WiringGeometry = { epoch, revision: 0, pending: false, bounds: emptyBounds, frames: new Map(), anchors: [] };
  const publish = (next: WiringGeometry) => { snapshot = next; for (const listener of listeners) listener(); };
  const cancelFrame = () => {
    if (frame !== null) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame); else window.clearTimeout(frame);
      frame = null;
    }
  };
  const invalidate = () => {
    if (!root) return;
    if (!snapshot.pending) publish({ ...snapshot, pending: true });
    if (frame === null) frame = window.requestAnimationFrame ? window.requestAnimationFrame(flush) : window.setTimeout(flush, 0);
  };
  const relative = (element: Element, origin: PointOrigin): Rect => {
    const box = element.getBoundingClientRect();
    return { left: box.left-origin.x, top: box.top-origin.y, right: box.right-origin.x, bottom: box.bottom-origin.y };
  };
  function flush() {
    cancelFrame();
    if (!root) return;
    const box = root.getBoundingClientRect();
    // Absolute children use the padding box: account for the root border.
    const origin = { x: box.left + root.clientLeft, y: box.top + root.clientTop };
    const bounds: Rect = { left: 0, top: 0, right: root.clientWidth || box.width, bottom: root.clientHeight || box.height };
    const measuredFrames = new Map<string, FrameGeometry>();
    for (const [id, entry] of frames) if (root.contains(entry.element)) {
      const element = entry.element.querySelector<HTMLElement>(':scope > [data-part="tile"]') ?? entry.element;
      const rect = relative(element, origin);
      const style = getComputedStyle(element);
      measuredFrames.set(id, { ...rect, innerLeft: rect.left+element.clientLeft, innerTop: rect.top+element.clientTop, innerRight: rect.right-(Number.parseFloat(style.borderRightWidth)||0) });
    }
    const measured: AnchorGeometry[] = [];
    for (const [id, entry] of anchors) {
      if (!root.contains(entry.element)) continue;
      const tile = measuredFrames.get(entry.key.placementId);
      if (!tile) continue;
      const card = relative(entry.element, origin);
      let clip = bounds;
      let visible = hasArea(card) && hasArea(tile);
      for (let el: HTMLElement | null = entry.element; el && el !== root; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || el.hidden) visible = false;
        const rect = relative(el, origin);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX || style.overflow)) clip = { ...clip, left: Math.max(clip.left, rect.left), right: Math.min(clip.right, rect.right) };
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY || style.overflow)) clip = { ...clip, top: Math.max(clip.top, rect.top), bottom: Math.min(clip.bottom, rect.bottom) };
      }
      const y = (card.top + card.bottom) / 2;
      visible = visible && hasArea(intersection(card, clip)) && y >= clip.top && y <= clip.bottom;
      // The outside edge of the painted 12px jack is the wire endpoint.
      const x = entry.key.side === "out" ? tile.innerRight + 6 : tile.innerLeft - 6;
      measured.push({ id, key: entry.key, point: { x, y }, card, clip, visible });
    }
    measured.sort((a,b) => a.id.localeCompare(b.id));
    const nextSignature = JSON.stringify([epoch,bounds,[...measuredFrames],measured]);
    if (nextSignature !== signature || snapshot.pending) {
      const changed = nextSignature !== signature;
      signature = nextSignature;
      publish({ epoch, revision: snapshot.revision + Number(changed), pending: false, bounds, frames: measuredFrames, anchors: measured });
    }
  }
  const observe = (element: HTMLElement) => observer?.observe(element);
  function registerFrame(id: string, element: HTMLElement) {
    const entry = { element, token: {} };
    const previous = frames.get(id);
    if (previous && previous.element !== element) observer?.unobserve(previous.element);
    frames.set(id, entry); observe(element); invalidate();
    return () => { if (frames.get(id)?.token === entry.token) { frames.delete(id); observer?.unobserve(element); invalidate(); } };
  }
  function registerAnchor(key: AnchorKey, element: HTMLElement) {
    const id = anchorId(key), entry = { key, element, token: {} };
    const previous = anchors.get(id);
    if (previous && previous.element !== element) observer?.unobserve(previous.element);
    anchors.set(id, entry); observe(element); invalidate();
    return () => { if (anchors.get(id)?.token === entry.token) { anchors.delete(id); observer?.unobserve(element); invalidate(); } };
  }
  function setRoot(element: HTMLElement | null) {
    if (element === root) return;
    cancelFrame(); observer?.disconnect();
    root?.removeEventListener("scroll", invalidate, true);
    window.removeEventListener("resize", invalidate);
    window.removeEventListener("scroll", invalidate, true);
    root = element; epoch++;
    if (!root) {
      signature = "";
      publish({ epoch, revision: snapshot.revision+1, pending: false, bounds: emptyBounds, frames: new Map(), anchors: [] });
      return;
    }
    observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidate);
    observe(root);
    for (const entry of [...frames.values(), ...anchors.values()]) observe(entry.element);
    root.addEventListener("scroll", invalidate, true);
    window.addEventListener("scroll", invalidate, true);
    window.addEventListener("resize", invalidate);
    invalidate();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    registerFrame, registerAnchor, setRoot, invalidate, flush,
    root: () => root,
    reveal(id: string) { anchors.get(id)?.element.scrollIntoView?.({ block: "nearest", inline: "nearest" }); invalidate(); },
    element(id: string) { return anchors.get(id)?.element ?? null; },
  };
}
interface PointOrigin { x: number; y: number }
export type GeometryStore = ReturnType<typeof createGeometryStore>;

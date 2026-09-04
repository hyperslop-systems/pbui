import { useEffect } from "react";
import { useWorkbench } from "../context";
import { useLinkSnapshot } from "../links/hooks";
import { linkRefsOf, type LinkRef } from "../links/linkRef";
import type { GeometryStore } from "./geometryStore";

const targets = '[data-port-id], [data-part="wire"], [data-part="workbench-tile"]';
const marks = '[data-port-id], [data-part="wire"]';

/** Presentation-only controller: hover must never invalidate or recompute routes.
 * Events are delegated within one mounted surface, including custom port markup.
 * Highlight direct incident edges (not the transitive connected component).
 */
export function attachConnectedHighlight(root: HTMLElement, links: readonly LinkRef[]) {
  let pointer: Element | null = null;
  let focused: Element | null = null;
  const owned = (target: EventTarget | null): Element | null => {
    if (!(target instanceof Element) || target.closest('[data-workbench-shell]') !== root) return null;
    return target.closest(targets);
  };
  const paint = () => {
    const target = pointer ?? focused;
    const seeds = new Set<string>();
    const port = target?.getAttribute('data-port-id');
    const wire = target?.getAttribute('data-link-id');
    if (port) seeds.add(port);
    else if (target?.getAttribute('data-part') === 'workbench-tile') {
      target.querySelectorAll('[data-port-id]').forEach(element => {
        const id = element.getAttribute('data-port-id');
        if (id) seeds.add(id);
      });
    }
    const edges = new Set<string>();
    const ports = new Set(seeds);
    for (const link of links) {
      if (wire === link.linkId || seeds.has(link.source) || seeds.has(link.destination)) {
        edges.add(link.linkId); ports.add(link.source); ports.add(link.destination);
      }
    }
    root.querySelectorAll(marks).forEach(element => {
      if (element.closest('[data-workbench-shell]') !== root) return;
      const id = element.getAttribute('data-port-id');
      const edge = element.getAttribute('data-link-id');
      element.toggleAttribute('data-connected-highlight', Boolean(id && ports.has(id) || edge && edges.has(edge)));
    });
  };
  const over = (event: Event) => { pointer = owned(event.target); paint(); };
  const out = (event: Event) => { pointer = owned((event as PointerEvent).relatedTarget); paint(); };
  const focus = (event: Event) => { focused = owned(event.target); paint(); };
  const blur = (event: Event) => { focused = owned((event as FocusEvent).relatedTarget); paint(); };
  const leave = () => { pointer = null; paint(); };
  root.addEventListener('pointerover', over);
  root.addEventListener('pointerout', out);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  focused = owned(root.ownerDocument.activeElement);
  // Restore hover when a semantic snapshot or mounted wire changes.
  pointer = owned([...root.querySelectorAll(`${targets.split(', ').join(':hover, ')}:hover`)].at(-1) ?? null);
  paint();
  return () => {
    root.removeEventListener('pointerover', over);
    root.removeEventListener('pointerout', out);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', blur);
    pointer = focused = null;
    paint();
  };
}

export function useConnectedHighlight(geometry: GeometryStore, enabled: boolean) {
  const snapshot = useLinkSnapshot(useWorkbench());
  useEffect(() => {
    const root = geometry.root();
    if (root && enabled) return attachConnectedHighlight(root, linkRefsOf(snapshot));
  }, [geometry, enabled, snapshot]);
}

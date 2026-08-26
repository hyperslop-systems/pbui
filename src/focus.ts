export interface FocusReturnTarget {
  invoker: HTMLElement | null;
  fallbacks: HTMLElement[];
}

const FALLBACK_SELECTOR = '[data-part="workbench-tile"], [role="dialog"], [data-part="workbench"], main';
const TRANSIENT_SELECTOR = '[data-pbui="menu"], [role="dialog"]';

/** Capture the invoker and connected owning surfaces before a transient surface steals focus. */
export function captureFocusReturn(explicit?: HTMLElement | null): FocusReturnTarget {
  const invoker = explicit ?? (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const fallbacks: HTMLElement[] = [];
  let current = invoker?.parentElement ?? null;
  while (current) {
    if (current.matches(FALLBACK_SELECTOR)) fallbacks.push(current);
    current = current.parentElement;
  }
  return { invoker, fallbacks };
}

function focusConnected(element: HTMLElement | null): boolean {
  if (!element?.isConnected) return false;
  if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.focus();
  return document.activeElement === element || element.contains(document.activeElement);
}

/**
 * Restore after React has removed the surface. A newly mounted transient
 * surface wins; otherwise the exact invoker wins, then its nearest surviving
 * owner. `body` is never used as an undocumented fallback.
 */
export function queueFocusReturn(target: FocusReturnTarget): void {
  queueMicrotask(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !target.invoker?.contains(active) &&
      active.closest(TRANSIENT_SELECTOR)
    ) {
      return;
    }
    if (focusConnected(target.invoker)) return;
    for (const fallback of target.fallbacks) {
      if (focusConnected(fallback)) return;
    }
  });
}

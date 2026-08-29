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

/*
 * True while a focus-return `.focus()` call is dispatching. Focus events fire
 * synchronously inside `element.focus()`, so a handler can ask whether the
 * focus it is seeing was RESTORED rather than asked for. The contextual help
 * runtime uses this (PR #20 review): a keyboard user closing the object menu
 * keeps keyboard input modality, and without this mark the menu's focus
 * return would reopen the help card the close was meant to dismiss.
 */
let restoring = false;

export function isRestoringFocus(): boolean {
  return restoring;
}

function focusConnected(element: HTMLElement | null): boolean {
  if (!element?.isConnected) return false;
  if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  restoring = true;
  try {
    element.focus();
  } finally {
    restoring = false;
  }
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

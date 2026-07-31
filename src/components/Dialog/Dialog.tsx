import { useEffect, useId, useRef, type ReactNode } from "react";
import { useEscapeSurface } from "../../surfaces";

export interface DialogProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  unstyled?: boolean;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), textarea, input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A non-destructive modal surface whose inert backdrop never dismisses
 * user-entered content.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  closeLabel = "Close",
  unstyled = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * A dialog is mounted only while it is open, so it registers unconditionally.
   *
   * `ownsEscape` is what stops one key press closing this dialog *and* whatever
   * is beneath it — a second dialog, an expanded panel, an object menu. All of
   * them listen on `window`, where propagation cannot order siblings, so the
   * order has to be stated. See `surfaces.ts`.
   */
  const ownsEscape = useEscapeSurface(true);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const body = panel.querySelector<HTMLElement>('[data-part="dialog-body"]');
    const target =
      body?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Not ours: something opened on top of this dialog and owns the key.
        if (!ownsEscape) return;
        event.preventDefault();
        onClose();
        return;
      }
      // Tab containment is NOT gated on `ownsEscape`. A dialog beneath another
      // surface is still the focus trap for anything inside it, and releasing
      // the trap because something opened above would let Tab walk out into the
      // page behind both.
      if (event.key !== "Tab") return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, ownsEscape]);

  return (
    <div
      data-pbui-component="dialog"
      data-part="dialog-backdrop"
      data-unstyled={unstyled || undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-part="dialog-panel"
      >
        <header data-part="dialog-header">
          <h2 id={titleId} data-part="dialog-title">
            {title}
          </h2>
          <button
            type="button"
            data-part="dialog-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div data-part="dialog-body">{children}</div>
        {footer && <footer data-part="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}

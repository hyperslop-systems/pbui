import { useEffect, useId, useRef, type ReactNode } from "react";

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
        event.preventDefault();
        onClose();
        return;
      }
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
  }, [onClose]);

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

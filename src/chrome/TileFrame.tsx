/**
 * The family tile frame (PBUI-UNIFY-001, DR-U3 — the shape datalab-ui,
 * agentlogic, and turboproof each hand-built): THE TONE IS THE TITLE BAR
 * (datadrop's DR-26), a ⠿ drag grip, a title slot, split ⬌/⬍ and close ✕
 * buttons, and the labeled drop-zone overlay naming a drag's outcome BEFORE
 * the release.
 *
 * Deliberately document-model-agnostic: the frame never sees a workbench
 * document. It takes callbacks and a title slot — the product wraps its own
 * `<tile>` Presentation there, so the object menu and these buttons stay two
 * doors to the same verbs. Styled by `chrome.css` through data-part hooks.
 */
import type { ReactNode } from "react";
import { IconButton } from "../components/atoms/IconButton";
import type { DragZone } from "./useTileDrag";

export interface TileFrameProps {
  /** Becomes data-placement-id; drag registries and focus restoration key on it. */
  placementId: string;
  /** A CSS custom property reference (never a hex value): the bar background. */
  tone: string;
  /** The product's title presentation (or plain text). */
  title: ReactNode;
  canClose: boolean;
  onSplit(direction: "row" | "col"): void;
  onClose(): void;
  /** From useTileDrag; omit to render a frame without drag affordance. */
  grip?: { onPointerDown(event: React.PointerEvent): void };
  /** From useTileDrag on the TARGET tile; renders the drop overlay. */
  dropZone?: DragZone | null;
  /** True on the tile being dragged; dims the frame. */
  dragging?: boolean;
  /** Overlay labels; override to localize or re-word per product. */
  swapLabel?: string;
  dockLabel?: string;
  replaceLabel?: string;
  /** Attach useTileDrag's register here (ref callback for the hit test). */
  registerElement?(element: HTMLElement | null): void;
  /**
   * Extra buttons BEFORE ⬌/⬍/✕, inside the action group rather than the
   * title. The title ellipsises (`chrome.css`), so a control appended there
   * disappears on exactly the tiles with long names; this slot never does.
   */
  actions?: ReactNode;
  /** Decoration outside the bounded content scrollport. */
  overlay?: ReactNode;
  children: ReactNode;
}

const ZONE_GEOMETRY: Record<DragZone, React.CSSProperties> = {
  center: { inset: 0 },
  replace: { inset: 0 },
  left: { left: 0, top: 0, bottom: 0, width: "50%" },
  right: { right: 0, top: 0, bottom: 0, width: "50%" },
  top: { top: 0, left: 0, right: 0, height: "50%" },
  bottom: { bottom: 0, left: 0, right: 0, height: "50%" },
};

/**
 * The drop overlay names the outcome before the release. That is the
 * difference between a discoverable gesture and a mystery.
 */
export function DropZoneOverlay({
  zone,
  swapLabel = "⇄ swap applications",
  dockLabel = "split-dock here · the source tile closes",
  replaceLabel = "⌥ replace this tile — the dragged application takes it, the source closes",
}: {
  zone: DragZone;
  swapLabel?: string;
  dockLabel?: string;
  replaceLabel?: string;
}) {
  return (
    <div data-part="drop-zone" data-zone={zone} style={ZONE_GEOMETRY[zone]}>
      <span data-part="drop-zone-label">
        {zone === "replace" ? replaceLabel : zone === "center" ? swapLabel : dockLabel}
      </span>
    </div>
  );
}

export function TileFrame({
  placementId,
  tone,
  title,
  canClose,
  onSplit,
  onClose,
  grip,
  dropZone,
  dragging,
  swapLabel,
  dockLabel,
  replaceLabel,
  registerElement,
  actions,
  children,
  overlay,
}: TileFrameProps) {
  return (
    <section
      ref={registerElement}
      data-part="tile"
      data-placement-id={placementId}
      data-state={dragging ? "dragging" : undefined}
    >
      {dropZone && <DropZoneOverlay zone={dropZone} swapLabel={swapLabel} dockLabel={dockLabel} replaceLabel={replaceLabel} />}
      <header data-part="tile-bar" style={{ background: tone }}>
        {grip && (
          <span
            data-part="tile-grip"
            onPointerDown={grip.onPointerDown}
            title="drag ⠿ — drop on a tile's centre to swap, near an edge to dock there, hold Alt to replace it"
            aria-hidden="true"
          >
            ⠿
          </span>
        )}
        <span data-part="tile-title">{title}</span>
        <span data-part="tile-actions">
          {actions}
          <IconButton
            variant="framed"
            size="tiny"
            glyph="⬌"
            accessibleName="split side by side"
            onClick={() => onSplit("row")}
          />
          <IconButton
            variant="framed"
            size="tiny"
            glyph="⬍"
            accessibleName="split top and bottom"
            onClick={() => onSplit("col")}
          />
          <IconButton
            variant="framed"
            size="tiny"
            glyph="✕"
            accessibleName="close this pane"
            disabled={!canClose}
            onClick={onClose}
          />
        </span>
      </header>
      <div data-part="tile-body"><div data-part="tile-scrollport">{children}</div></div>
      {overlay ? <div data-part="tile-frame-overlay">{overlay}</div> : null}
    </section>
  );
}

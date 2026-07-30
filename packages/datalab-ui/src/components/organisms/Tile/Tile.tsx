import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { appFor } from "../../../appkit/registry";
import { RenderBoundary } from "../../../appkit/RenderBoundary";
import { Presentation, usePbui } from "../../../pbui";
import type { RootState } from "../../../store";
import { countLeaves, layoutActions, primaryDocId, type Node } from "../../../store/layout";
import { Button, Callout, IconButton, InlineRename, Text } from "@hyperslop-systems/pbui";
import { ViewSwitcher } from "../ViewSwitcher";
import { useDrag } from "./useDrag";
import styles from "./Tile.module.css";

/**
 * One tile: a title bar and an application.
 *
 * The tile is geometry plus a reference to one logical AppView. The view owns
 * application, document binding and title, so linked placements stay in sync.
 */
export function Tile({ node }: { node: Extract<Node, { type: "leaf" }> }) {
  const dispatch = useDispatch();
  const pbui = usePbui();
  const tileElement = useRef<HTMLElement | null>(null);
  const view = useSelector((state: RootState) => state.layout.views[node.viewId]);
  const app = appFor(view?.appId ?? "");
  const docId = primaryDocId(view);
  // The rename flag lives in the store rather than here, because the *menu* has
  // to be able to start one and a menu entry is serialisable data — it cannot
  // reach into a `useState` three components away (DATADROP-8).
  const renaming = useSelector((state: RootState) => state.layout.renamingId === node.id);
  const replacing = useSelector((state: RootState) => state.layout.replacingId === node.id);
  const setRenaming = (on: boolean) =>
    dispatch(layoutActions.beginRename(on && view ? node.id : null));
  const docName = useSelector((state: RootState) =>
    docId ? (state.world.docs[docId]?.name ?? null) : null,
  );
  const tree = useSelector(
    (state: RootState) =>
      state.layout.spaces.find((s) => s.id === state.layout.currentSpaceId)?.tree ?? null,
  );
  const canClose = tree !== null && countLeaves(tree) > 1;

  const { dragging, zone, onGripPointerDown, register } = useDrag(node.id);
  const restoreTitleFocus = () => {
    requestAnimationFrame(() => {
      tileElement.current?.querySelector<HTMLElement>('[data-ptype="tile"]')?.focus();
    });
  };
  const placementCount = useSelector((state: RootState) => {
    const count = (n: Node): number =>
      n.type === "leaf" ? Number(n.viewId === node.viewId) : count(n.a) + count(n.b);
    return state.layout.spaces.reduce((total, space) => total + count(space.tree), 0);
  });

  const title = app ? app.title : (view?.appId ?? "missing view");
  const derived = docName ? `${title} · ${docName}` : title;
  // `??` and not `||`: an empty label is normalised to undefined by the
  // reducer, so `??` is what makes "clear the field and press Enter" mean *go
  // back to the derived title* rather than *render an empty title bar*.
  const label = view?.title ?? derived;

  const zoneStyle =
    zone === "left"
      ? { left: 0, top: 0, bottom: 0, width: "50%" }
      : zone === "right"
        ? { right: 0, top: 0, bottom: 0, width: "50%" }
        : zone === "top"
          ? { top: 0, left: 0, right: 0, height: "50%" }
          : zone === "bottom"
            ? { bottom: 0, left: 0, right: 0, height: "50%" }
            : zone === "center"
              ? { inset: 0 }
              : null;

  const Component = app?.Component;

  return (
    <section
      ref={(element) => {
        tileElement.current = element;
        register(element);
      }}
      // A landmark per tile, named by its application and document, so the
      // workspace is navigable by region rather than by tabbing through it.
      aria-label={label}
      className={[styles.tile, dragging ? styles.dragging : ""].filter(Boolean).join(" ")}
      style={{ background: app ? undefined : "var(--pbui-pane-alt)" }}
    >
      {zoneStyle && (
        <div className={styles.zone} style={zoneStyle}>
          <span className={styles.zoneLabel}>
            {zone === "center" ? "⇄ swap applications" : "split-dock here · the source tile closes"}
          </span>
        </div>
      )}

      <div className={styles.title} style={{ background: app?.tone ?? "var(--pbui-pane-alt)" }}>
        <span
          className={styles.grip}
          onPointerDown={onGripPointerDown}
          onMouseEnter={() =>
            pbui.setMouseDoc(
              "drag ⠿ — drop on a tile's CENTRE to swap applications, or near an EDGE to split-dock",
            )
          }
          onMouseLeave={() => pbui.setMouseDoc(null)}
          aria-hidden="true"
        >
          ⠿
        </span>

        {renaming ? (
          // The same control the workspace strip uses, for the same gesture at
          // the level below it. Two interactions that look the same should be
          // the same component — and this one already handles the
          // read-on-Enter / Escape-means-never-happened semantics.
          <InlineRename
            initial={view?.title ?? ""}
            label="view name"
            // Empty commits as empty, which the reducer normalises back to
            // "no label". `InlineRename`'s fallback exists for a workspace,
            // where a blank name leaves nothing to click; a tile always has a
            // derived title to fall back to, so clearing is a real outcome.
            fallback=""
            // Through `perform`, not `dispatch`, so the rename appears in the
            // trace as a verb like every other user decision.
            onCommit={(name) =>
              view && pbui.perform({ kind: "renameView", viewId: view.id, title: name })
            }
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <Presentation
            className={styles.viewTitle}
            /*
             * A TileRef, not a node id (DATADROP-8 DR-68).
             *
             * The tile descriptor has to know which application this leaf
             * holds, whether it is duplicable and whether it is the last tile
             * in its workspace. None of that is in `PbuiEnvironment` and none
             * of it should be — `field.ts` has no business seeing the tile tree
             * — so the value carries it, resolved by the component that already
             * computed every field for its own rendering.
             */
            reference={{
              type: "tile",
              value: {
                placementId: node.id,
                viewId: node.viewId,
                app: view?.appId ?? "",
                title: label,
                ...(view?.title ? { customTitle: view.title } : {}),
                docId,
                duplicable: app?.duplicable ?? false,
                canClose,
                placementCount,
              },
            }}
            doc={`<tile> ${label}`}
          >
            <span
              className={styles.viewTitleText}
              style={{ textTransform: "uppercase", letterSpacing: "var(--pbui-track-label)" }}
              title={view?.title ? `renamed — the derived title is “${derived}”` : undefined}
            >
              <Text size="tiny" strong>
                {label}
              </Text>
            </span>
          </Presentation>
        )}

        <span style={{ flex: 1 }} />

        <TileButton
          label="split right"
          onClick={() => dispatch(layoutActions.splitLeaf({ nodeId: node.id, dir: "row" }))}
        >
          ⬌
        </TileButton>
        <TileButton
          label="split below"
          onClick={() => dispatch(layoutActions.splitLeaf({ nodeId: node.id, dir: "col" }))}
        >
          ⬍
        </TileButton>
        <TileButton
          label="close tile"
          disabled={!canClose}
          onClick={() => dispatch(layoutActions.closeLeaf(node.id))}
        >
          ✕
        </TileButton>
      </div>

      <div className={styles.body}>
        {replacing ? (
          <ViewSwitcher placementId={node.id} onComplete={restoreTitleFocus} />
        ) : Component && view ? (
          <RenderBoundary
            resetKey={`${view.id}:${view.appId}:${docId ?? ""}`}
            fallback={(error, reset) => (
              <div style={{ padding: "var(--pbui-space-4)" }}>
                <Callout variant="warning" title={`${title} could not render`}>
                  <Text size="small" prose>
                    {error.message}
                  </Text>
                  <div style={{ marginTop: "var(--pbui-space-3)" }}>
                    <Button onClick={reset}>Try this tile again</Button>
                  </div>
                </Callout>
              </div>
            )}
          >
            <Component placementId={node.id} view={view} />
          </RenderBoundary>
        ) : (
          <div style={{ padding: "var(--pbui-space-4)" }}>
            <Text size="small" tone="faint">
              {view
                ? `no application called “${view.appId}” — choose Replace from the title`
                : `no view called “${node.viewId}”`}
            </Text>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The tile's own chrome buttons: split, swap, close.
 *
 * Now a thin wrapper over IconButton rather than its own `<button>`. It stays a
 * local component only because every one of them is framed, tiny and takes a
 * glyph — three defaults repeated six times in the title bar.
 */
function TileButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <IconButton
      variant="framed"
      size="tiny"
      glyph={children}
      label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

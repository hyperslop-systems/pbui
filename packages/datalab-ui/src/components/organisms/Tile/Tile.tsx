import { useDispatch, useSelector } from "react-redux";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import type { SurfaceProps, TilePlacementInfo } from "@hyperslop-systems/pbui-workbench";
import { IconButton, InlineRename, Text } from "@hyperslop-systems/pbui";
import { appFor } from "../../../appkit/registry";
import { Presentation, usePbui } from "../../../pbui";
import type { RootState } from "../../../store";
import { navigationActions } from "../../../store/navigation";
import styles from "./Tile.module.css";

/**
 * What Datalab puts in a tile's title bar (design §9.1).
 *
 * The tile itself — the frame, the grip, the drop overlay, the split and
 * close buttons, the error boundary, the active-placement tracking — is the
 * workbench shell's `Tile` over `TileFrame`. What was Datalab's own in the
 * old `Tile.tsx` and is still Datalab's own here: the `<tile>` PRESENTATION
 * that carries the object menu, the derived `chart · α` title that names the
 * bound document, the inline rename, and the door to the product's launcher
 * in the action group. Two slots on `Surface`, nothing else.
 */
export function TileTitle({ view, placement }: { view: AppView; placement: TilePlacementInfo }) {
  const dispatch = useDispatch();
  const pbui = usePbui();
  const app = appFor(view.appId);
  const docId = view.documents.primary ?? null;
  const docName = useSelector((state: RootState) =>
    docId ? (state.world.docs[docId]?.name ?? null) : null,
  );
  // The rename flag lives in the store rather than here, because the *menu*
  // has to be able to start one and a menu entry is serialisable data.
  const renaming = useSelector(
    (state: RootState) => state.navigation.renamingId === placement.placementId,
  );

  const title = app ? app.title : view.appId;
  const derived = docName ? `${title} · ${docName}` : title;
  // A cleared title is absent in the document (the core trims and drops
  // it), so "no label" has exactly one representation and the derived title
  // is what a blank rename returns to.
  const label = view.title ? view.title : derived;

  if (renaming) {
    return (
      // The same control the workspace strip uses, for the same gesture at
      // the level below it. An empty commit means *back to the derived
      // title*, which the core spells as clearing the title.
      <InlineRename
        initial={view.title ?? ""}
        accessibleName="view name"
        fallback=""
        // Through `perform`, not `dispatch`, so the rename appears in the
        // trace as a verb like every other user decision.
        onCommit={(name) => pbui.perform({ kind: "renameView", viewId: view.id, title: name })}
        onCancel={() => dispatch(navigationActions.beginRename(null))}
      />
    );
  }

  return (
    <Presentation
      className={styles.viewTitle}
      /*
       * A TileRef, not a placement id (DATADROP-8 DR-68): the tile descriptor
       * has to know which application this leaf holds, whether it is
       * duplicable and whether it is the last tile in its workspace, and the
       * value carries it, resolved by the component that already knows it.
       */
      reference={{
        type: "tile",
        value: {
          placementId: placement.placementId,
          viewId: view.id,
          app: view.appId,
          title: label,
          ...(view.title ? { customTitle: view.title } : {}),
          docId,
          duplicable: app?.duplicable ?? false,
          canClose: placement.canClose,
          placementCount: placement.placementCount,
        },
      }}
      doc={`<tile> ${label}`}
    >
      <span
        className={styles.viewTitleText}
        style={{ textTransform: "uppercase", letterSpacing: "var(--pbui-track-label)" }}
        title={view.title ? `renamed — the derived title is “${derived}”` : undefined}
      >
        <Text size="tiny" strong>
          {label}
        </Text>
        {placement.placementCount > 1 ? (
          // The linked marker is chrome the shell would have drawn; drawn here
          // so the presentation and the marker sit in one span.
          <span
            data-part="tile-linked"
            title={`the same view is shown in ${placement.placementCount} tiles`}
          >
            {` ×${placement.placementCount}`}
          </span>
        ) : null}
      </span>
    </Presentation>
  );
}

/**
 * The action-group door to the product's launcher, in replace mode: the
 * shell's default would open the generic launcher, which Datalab does not
 * mount.
 */
export function TileAction({ placement }: { placement: TilePlacementInfo }) {
  const dispatch = useDispatch();
  return (
    <IconButton
      variant="framed"
      size="tiny"
      glyph="⌕"
      accessibleName="show something else in this tile"
      onClick={() =>
        dispatch(
          navigationActions.openLauncher({ kind: "replace", placementId: placement.placementId }),
        )
      }
    />
  );
}

export const renderDatalabTitle: NonNullable<SurfaceProps["renderTitle"]> = (view, placement) => (
  <TileTitle view={view} placement={placement} />
);

export const renderDatalabTileAction: NonNullable<SurfaceProps["tileAction"]> = (placement) => (
  <TileAction placement={placement} />
);

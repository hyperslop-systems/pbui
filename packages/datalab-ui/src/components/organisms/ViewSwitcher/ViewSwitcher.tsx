import { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, SectionLabel, Stack, Text } from "@hyperslop-systems/pbui";
import { useAvailableApps } from "../../../appkit/AppScope";
import { appFor } from "../../../appkit/registry";
import type { RootState } from "../../../store";
import { layoutActions, type Node, type NodeId, type ViewId } from "../../../store/layout";
import { buildViewSwitcherModel } from "./model";
import styles from "./ViewSwitcher.module.css";

function countView(node: Node, viewId: ViewId): number {
  if (node.type === "leaf") return node.viewId === viewId ? 1 : 0;
  return countView(node.a, viewId) + countView(node.b, viewId);
}

export interface ViewSwitcherProps {
  placementId: NodeId;
  onComplete?: () => void;
}

/**
 * The compact, embedded view picker.
 *
 * Once the whole of Launcher and Replace; now neither of them — DATALAB-VIEW-001
 * moved both into `LauncherDialog`, because a list whose geometry depends on
 * the tile it happens to be inside cannot be searched comfortably and cannot
 * carry workspace grouping.
 *
 * It survives as the flat, no-search fallback: it needs no modal, no keyboard
 * routing and no surface stack, which keeps it renderable in isolation in a
 * story and usable as a picker anywhere a dialog would be too much. The
 * `mode="replace"` variant and its `window` Escape listener are gone with the
 * body takeover they served.
 */
export function ViewSwitcher({ placementId, onComplete }: ViewSwitcherProps) {
  const dispatch = useDispatch();
  const root = useRef<HTMLElement>(null);
  const apps = useAvailableApps();
  const layout = useSelector((state: RootState) => state.layout);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);
  const docs = useSelector((state: RootState) => state.world.docs);

  const currentViewId = useMemo(() => {
    const visit = (node: Node): ViewId | null => {
      if (node.type === "leaf") return node.id === placementId ? node.viewId : null;
      return visit(node.a) ?? visit(node.b);
    };
    for (const space of layout.spaces) {
      const found = visit(space.tree);
      if (found) return found;
    }
    return null;
  }, [layout.spaces, placementId]);

  const currentSpace = layout.spaces.find((space) => space.id === layout.currentSpaceId);
  const model = buildViewSwitcherModel({
    apps,
    views: layout.views,
    viewOrder: layout.viewOrder,
    currentViewId,
    appFor,
    placementCount: (viewId) =>
      layout.spaces.reduce((count, space) => count + countView(space.tree, viewId), 0),
    shownInCurrentWorkspace: (viewId) =>
      currentSpace ? countView(currentSpace.tree, viewId) > 0 : false,
  });

  const finish = () => {
    onComplete?.();
  };

  const chooseView = (viewId: ViewId) => {
    dispatch(layoutActions.replacePlacementWithView({ nodeId: placementId, viewId }));
    finish();
  };

  const chooseApp = (appId: string) => {
    const descriptor = appFor(appId);
    dispatch(
      layoutActions.createViewInPlacement({
        nodeId: placementId,
        appId,
        docId: descriptor?.docBound ? activeDocId : null,
      }),
    );
    finish();
  };

  return (
    <section ref={root} className={styles.root} aria-label="choose a view">
      <Stack gap={4}>
        <section>
          <SectionLabel>Existing views</SectionLabel>
          {model.existing.length === 0 ? (
            <Text size="small" tone="faint" prose>
              No other views are open.
            </Text>
          ) : (
            <div className={styles.grid}>
              {model.existing.map((option) => {
                const { view, app, placementCount, shownInCurrentWorkspace } = option;
                const docId = view.documents.primary;
                const doc = docId ? docs[docId] : undefined;
                const derived = doc ? `${app?.title ?? view.appId} · ${doc.name}` : app?.title;
                return (
                  <Button
                    key={view.id}
                    variant="raised"
                    fill={app?.tone}
                    onClick={() => chooseView(view.id)}
                  >
                    <span className={styles.option}>
                      <strong>{view.title ?? derived ?? view.appId}</strong>
                      <small>
                        {app?.title ?? view.appId}
                        {doc ? ` · ${doc.name}` : ""}
                        {placementCount > 0
                          ? ` · shown ${placementCount} ${
                              placementCount === 1 ? "place" : "places"
                            }${shownInCurrentWorkspace ? " · here" : ""}`
                          : " · not shown"}
                      </small>
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionLabel>New view</SectionLabel>
          <div className={styles.grid}>
            {model.creatable.map((app) => (
              <Button
                key={app.id}
                variant="raised"
                fill={app.tone}
                onClick={() => chooseApp(app.id)}
              >
                {app.title}
              </Button>
            ))}
          </div>
        </section>
      </Stack>
    </section>
  );
}

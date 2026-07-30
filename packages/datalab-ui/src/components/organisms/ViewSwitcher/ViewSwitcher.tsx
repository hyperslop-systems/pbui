import { useEffect, useMemo, useRef } from "react";
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
  mode?: "launcher" | "replace";
  onComplete?: () => void;
}

/**
 * Shared content for an empty launcher tile and the title menu's Replace
 * action. Existing views link this placement; applications create a new view.
 */
export function ViewSwitcher({ placementId, mode = "replace", onComplete }: ViewSwitcherProps) {
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

  useEffect(() => {
    if (mode !== "replace") return;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dispatch(layoutActions.beginReplace(null));
      onComplete?.();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [dispatch, mode, onComplete]);

  const finish = () => {
    dispatch(layoutActions.beginReplace(null));
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
    <section
      ref={root}
      className={styles.root}
      aria-label={mode === "replace" ? "replace view" : "choose a view"}
    >
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

import { useRef } from "react";
import { useSelector } from "react-redux";
import { Button, SectionLabel, Stack, Text } from "@hyperslop-systems/pbui";
import { useAvailableApps } from "../../../appkit/AppScope";
import { useDatalabWorkbench } from "../../../appkit/DatalabWorkbenchContext";
import { appFor } from "../../../appkit/registry";
import type { RootState } from "../../../store";
import { buildViewSwitcherModel } from "./model";
import styles from "./ViewSwitcher.module.css";

export interface ViewSwitcherProps {
  placementId: string;
  onComplete?: () => void;
}

/**
 * The compact, embedded view picker.
 *
 * Once the whole of Launcher and Replace; now neither of them — DATALAB-VIEW-001
 * moved both into `LauncherDialog`. It survives as the flat, no-search
 * fallback: it needs no modal, no keyboard routing and no surface stack, which
 * keeps it renderable in isolation in a story. The views and their placements
 * are read off the core's document and index; a choice is a controller call.
 */
export function ViewSwitcher({ placementId, onComplete }: ViewSwitcherProps) {
  const root = useRef<HTMLElement>(null);
  const workbench = useDatalabWorkbench();
  const apps = useAvailableApps();
  const document = workbench.shell.useDocument();
  const index = workbench.shell.useCoreState((state) => state.index);
  const workspaceId = workbench.shell.useCoreState((state) => state.session.workspaceId);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);
  const docs = useSelector((state: RootState) => state.world.docs);

  const currentViewId = index.viewByPlacementId.get(placementId) ?? null;
  const model = buildViewSwitcherModel({
    apps,
    views: document.views,
    viewOrder: document.viewOrder,
    currentViewId,
    appFor,
    placementCount: (viewId) => index.placementsByViewId.get(viewId)?.length ?? 0,
    shownInCurrentWorkspace: (viewId) =>
      (index.placementsByViewId.get(viewId) ?? []).some((ref) => ref.workspaceId === workspaceId),
  });

  const finish = () => {
    onComplete?.();
  };

  const chooseView = (viewId: string) => {
    workbench.controller.replacePlacement(placementId, { kind: "existing", viewId });
    finish();
  };

  const chooseApp = (appId: string) => {
    const descriptor = appFor(appId);
    workbench.controller.replacePlacement(placementId, {
      kind: "application",
      appId,
      docId: descriptor?.docBound ? activeDocId : null,
    });
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
                      <strong>{view.title || derived || view.appId}</strong>
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

import { useDatalabWorkbench } from "../../appkit/DatalabWorkbenchContext";
import { registerApp, type AppProps } from "../../appkit/registry";
import { useTourContent } from "../../appkit/TourContent";
import { ModuleRack } from "../../components/organisms";
import { EmptyState } from "@hyperslop-systems/pbui";

/**
 * The module rack, as a tile.
 *
 * Choosing a card re-points `rackTarget` — a sibling tile — so the card and the
 * application it describes are on screen together and the reader can check the
 * description against the behaviour immediately.
 *
 * With no `rackTarget` the rack is a reference with no specimen. It still
 * reads; it teaches less.
 */
function ModulesApp(_props: AppProps) {
  const workbench = useDatalabWorkbench();
  const { modules, rackTarget } = useTourContent();
  // The document the target tile shows now, so the module it swaps to keeps
  // looking at the same data.
  const rackDocId = workbench.shell.useCoreState((state) => {
    const viewId = rackTarget ? state.index.viewByPlacementId.get(rackTarget) : undefined;
    return viewId ? (state.document.views[viewId]?.documents.primary ?? null) : null;
  });

  if (!modules || modules.length === 0) {
    return (
      <EmptyState
        message="No module rack here"
        hint="This tile shows the application reference of a tour section."
      />
    );
  }

  return (
    <ModuleRack
      modules={modules}
      onSelect={
        rackTarget
          ? (appId) =>
              void workbench.controller.replacePlacement(rackTarget, {
                kind: "application",
                appId,
                docId: rackDocId,
              })
          : undefined
      }
    />
  );
}

registerApp({
  id: "modules",
  title: "modules",
  tone: "var(--pbui-tone-neutral)",
  docBound: false,
  duplicable: false,
  singleton: true,
  Component: ModulesApp,
});

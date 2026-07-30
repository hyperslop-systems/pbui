import { useDispatch, useSelector } from "react-redux";
import { registerApp, type AppProps } from "../../appkit/registry";
import { useTourContent } from "../../appkit/TourContent";
import type { RootState } from "../../store";
import { findLeaf, layoutActions, primaryDocId } from "../../store/layout";
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
  const dispatch = useDispatch();
  const { modules, rackTarget } = useTourContent();
  const rackDocId = useSelector((state: RootState) => {
    if (!rackTarget) return null;
    const space = state.layout.spaces.find(
      (candidate) => candidate.id === state.layout.currentSpaceId,
    );
    const placement = space ? findLeaf(space.tree, rackTarget) : null;
    return placement?.type === "leaf" ? primaryDocId(state.layout.views[placement.viewId]) : null;
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
              dispatch(
                layoutActions.createViewInPlacement({
                  nodeId: rackTarget,
                  appId,
                  docId: rackDocId,
                }),
              )
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

import { useEffect, useMemo, useState } from "react";
import {
  LauncherShell,
  isEditableTarget,
  routeWorkbenchKey,
  splitDirectionFor,
  useAnyEscapeSurface,
  type LauncherShellGroup,
} from "@hyperslop-systems/pbui";
import { leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import type { LauncherProps } from "../../types";

const GOTO = "goto:";
const PLACE = "place:";

/**
 * pbui's `LauncherShell` over the app registry. Two groups: applications
 * already on screen as singletons are offered as "go to" — a second trace
 * tile would render the same pixels — and everything else as "place", which
 * splits the active tile along its longer rendered axis. The status line
 * says where the new tile will land BEFORE Enter commits.
 *
 * Escape is owned by the Dialog inside the shell; nothing here registers a
 * second escape surface (see LauncherShell.tsx, invariant 1).
 */
export function WorkbenchLauncher({ title = "Open an application", shortcut = true, shortcutContext }: LauncherProps) {
  const workbench = useWorkbench();
  const open = workbench.useWorkbenchState((state) => state.launcherOpen);
  const anySurfaceOpen = useAnyEscapeSurface();

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const root = workbench.root();
      if (!root) return;
      // The workbench that contains focus reacts; with focus on <body>, a
      // lone workbench reacts; several workbenches and no focus do nothing.
      const focused = document.activeElement;
      const unowned = !focused || focused === document.body;
      const ownsFocus = !unowned && root.contains(focused);
      const lone = document.querySelectorAll("[data-workbench-shell]").length === 1;
      if (!ownsFocus && !(unowned && lone)) return;

      const extra = shortcutContext?.() ?? {};
      const decision = routeWorkbenchKey(
        event,
        {
          targetIsEditable: isEditableTarget(event.target as HTMLElement | null),
          launcherOpen: workbench.store.getState().launcherOpen,
          dialogOpen: anySurfaceOpen,
          objectMenuOpen: extra.objectMenuOpen ?? false,
          acceptingPresentation: extra.acceptingPresentation ?? false,
          renamingView: extra.renamingView ?? false,
        },
        navigator.platform,
      );
      if (decision.kind !== "open-launcher") return;
      event.preventDefault();
      workbench.verbs.openLauncher();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shortcut, shortcutContext, anySurfaceOpen, workbench]);

  return open ? <LauncherModal title={title} /> : null;
}

/** Remounted per opening, so the query and the highlight start fresh. */
function LauncherModal({ title }: { title: string }) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const active = workbench.useWorkbenchState((state) => state.activePlacementId);
  const [query, setQuery] = useState("");

  const target = useMemo(() => {
    const tree = workspaceTree(document, workspaceId);
    const all = leaves(tree);
    const placement = all.find((leaf) => leaf.id === active) ?? all[0];
    if (!placement || placement.body.case !== "leaf") return null;
    const view = document.views[placement.body.value.viewId];
    const app = view ? workbench.apps.get(view.appId) : null;
    return { placementId: placement.id, label: view?.title || app?.title || view?.appId || placement.id };
  }, [document, workspaceId, active, workbench]);

  const direction = target ? splitDirectionFor(target.placementId, workbench.root()) : "row";

  const groups = useMemo<LauncherShellGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => needle === "" || text.toLowerCase().includes(needle);
    const goto: LauncherShellGroup = { label: "ON SCREEN", rows: [] };
    const place: LauncherShellGroup = { label: "NEW TILE", rows: [] };
    for (const app of workbench.apps.list()) {
      if (!matches(app.title) && !matches(app.id)) continue;
      const placed = app.singleton && viewsOfApp(document, app.id).length > 0;
      if (placed) goto.rows.push({ id: `${GOTO}${app.id}`, title: app.title, detail: "already open · go to it" });
      // A doc-bound application is a view OF something; without a document
      // to bind it would open empty. Those arrive through `openView`.
      else if (!app.docBound) place.rows.push({ id: `${PLACE}${app.id}`, title: app.title, detail: app.singleton ? "one tile" : "a new tile" });
    }
    return [goto, place];
  }, [document, query, workbench]);

  const close = () => workbench.verbs.closeLauncher();
  const choose = (rowId: string) => {
    const appId = rowId.slice(rowId.indexOf(":") + 1);
    workbench.verbs.place(appId, target ? { from: target.placementId } : {});
    close();
  };

  return (
    <LauncherShell
      title={title}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      onChoose={choose}
      onClose={close}
      status={
        target
          ? `a new tile opens ${direction === "row" ? "beside" : "below"} “${target.label}”`
          : "a new tile opens in the workspace"
      }
      enterVerb={(rowId) => (rowId?.startsWith(GOTO) ? "go to" : "place")}
      searchLabel="search applications"
      placeholder="search applications…"
      emptyText="No application matches."
    />
  );
}

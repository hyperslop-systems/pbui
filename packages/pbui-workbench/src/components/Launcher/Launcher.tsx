import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LauncherShell, isEditableTarget, routeWorkbenchKey, useAnyEscapeSurface } from "@hyperslop-systems/pbui";
import { commands, longerAxis } from "@hyperslop-systems/workbench-core";
import { labelOfView } from "../../app";
import { useWorkbench } from "../../context";
import { defaultLauncherRows, groupLauncherRows, rowOf, type LauncherInvocation } from "../../launcherRows";
import type { LauncherProps } from "../../types";

/**
 * pbui's `LauncherShell` over the presentations. Two groups: views already
 * on screen are offered as "go to", and applications as "place", which
 * enters placement mode. The status line says where the new tile will land
 * BEFORE Enter commits. Escape is owned by the Dialog inside the shell.
 */
export function WorkbenchLauncher({ title = "Open an application", shortcut = true, shortcutContext, rows, choose, renderDetail, scope = "document" }: LauncherProps) {
  const workbench = useWorkbench();
  const open = workbench.useShellState((state) => state.launcher !== null);
  const anySurfaceOpen = useAnyEscapeSurface();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(workbench.shell.getState().launcher !== null);

  /**
   * Placement mode (§5.E): choosing an application does not place it
   * immediately — the choice is CARRIED, the tiles show drop-zone overlays,
   * and the next click says where it lands. Enter takes the default spot;
   * Escape cancels. The mode belongs to the workbench, not this component.
   */
  const beginCarry = (appId: string, appTitle: string) => {
    void workbench.placement
      .begin({
        prompt: `placing ${appTitle}`,
        defaultLabel: "the default spot",
        // A refused drop re-arms rather than ending the mode.
        accept: (aim) => {
          const result = workbench.execute(commands.placeAt(appId, aim.placementId, aim.zone));
          if (result.ok && result.placementId) placedRef.current = result.placementId;
          return result.ok;
        },
      })
      .then((outcome) => {
        if (outcome.kind === "aimed" && placedRef.current) workbench.focusPlacement(placedRef.current);
        else if (outcome.kind === "default") {
          const result = workbench.execute(commands.place(appId));
          if (result.ok && result.placementId) workbench.focusPlacement(result.placementId);
        }
        placedRef.current = null;
      });
  };
  const placedRef = useRef<string | null>(null);
  useEffect(() => () => workbench.placement.cancel(), [workbench]);

  // The store changes synchronously inside the click/key handler, before
  // React mounts Dialog. Capture the invoker there.
  useLayoutEffect(
    () =>
      workbench.shell.subscribe(() => {
        const next = workbench.shell.getState().launcher !== null;
        if (next && !previousOpenRef.current) {
          const active = globalThis.document?.activeElement;
          returnFocusRef.current = active instanceof HTMLElement ? active : null;
        }
        previousOpenRef.current = next;
      }),
    [workbench],
  );

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const root = workbench.root();
      if (!root) return;
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
          launcherOpen: workbench.shell.getState().launcher !== null,
          dialogOpen: anySurfaceOpen,
          objectMenuOpen: extra.objectMenuOpen ?? false,
          acceptingPresentation: extra.acceptingPresentation ?? false,
          renamingView: extra.renamingView ?? false,
        },
        navigator.platform,
      );
      if (decision.kind !== "open-launcher") return;
      event.preventDefault();
      workbench.dispatch({ kind: "launcher.open" });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shortcut, shortcutContext, anySurfaceOpen, workbench]);

  return open ? <LauncherModal title={title} rows={rows} choose={choose} renderDetail={renderDetail} scope={scope} returnFocusTo={returnFocusRef.current} beginCarry={beginCarry} /> : null;
}

/** Remounted per opening, so the query and the highlight start fresh. */
function LauncherModal({
  title,
  rows,
  choose,
  renderDetail,
  scope,
  returnFocusTo,
  beginCarry,
}: Required<Pick<LauncherProps, "title" | "scope">> &
  Pick<LauncherProps, "rows" | "choose" | "renderDetail"> & {
    returnFocusTo: HTMLElement | null;
    beginCarry(appId: string, title: string): void;
  }) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const index = workbench.useCoreState((state) => state.index);
  const workspaceId = workbench.useCoreState((state) => state.session.workspaceId);
  const active = workbench.useCoreState((state) => state.session.activePlacementId);
  const from = workbench.useShellState((state) => state.launcher?.from ?? null);
  const [query, setQuery] = useState("");

  const labelOf = (placementId: string | null): string => {
    if (!placementId) return "";
    const viewId = index.viewByPlacementId.get(placementId);
    const view = viewId ? document.views[viewId] : undefined;
    return view ? labelOfView(view, workbench.apps.get(view.appId)) : placementId;
  };

  const invocation = useMemo<LauncherInvocation>(() => {
    const all = (index.workspaceById.get(workspaceId)?.tree ? [...index.viewByPlacementId.keys()].filter((id) => index.workspaceByNodeId.get(id) === workspaceId) : []) as string[];
    // Per-pane mode aims at the tile it was invoked from; the global one at
    // the active tile, falling back to the first so Enter always does something.
    const target = from ?? (active && all.includes(active) ? active : (all[0] ?? null));
    return { from, target, targetLabel: labelOf(target) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, index, workspaceId, active, from, workbench]);

  const perPane = invocation.from !== null;
  const direction = invocation.target ? longerAxis(workbench.measure(), invocation.target, workbench.core.policy.split.headlessAxis) : "row";

  const model = useMemo(() => {
    const context = { document, apps: workbench.apps, manifests: workbench.core.apps, workspaceId, invocation, query: query.trim().toLowerCase(), scope };
    return rows ? rows(context) : defaultLauncherRows(context);
  }, [document, workbench, workspaceId, invocation, query, rows, scope]);

  const groups = useMemo(() => groupLauncherRows(model, workbench.apps, perPane, renderDetail), [model, workbench, perPane, renderDetail]);

  const close = () => workbench.dispatch({ kind: "launcher.close" });

  /**
   * Four meanings over two row kinds and two modes:
   *              global                     per-pane
   *   view       go to it                   link this pane to it
   *   app        place a new tile           show it in this pane
   * A product's `choose` runs first and returning true claims the row.
   */
  const onChoose = (rowId: string) => {
    const row = rowOf(rowId, model);
    if (!row) return;
    const claimed = choose?.(row, { document, apps: workbench.apps, manifests: workbench.core.apps, workspaceId, invocation, query: query.trim().toLowerCase(), scope });
    if (claimed) {
      close();
      return;
    }
    if (perPane && invocation.from) {
      workbench.execute(row.kind === "view" ? commands.link(invocation.from, row.viewId) : commands.replace(invocation.from, row.appId));
      workbench.focusPlacement(invocation.from);
    } else if (row.kind === "view") {
      const result = workbench.execute(commands.goTo(row.viewId));
      if (result.ok && result.placementId) workbench.focusPlacement(result.placementId);
    } else {
      // A placed singleton never reaches this arm (it is offered as its
      // view). Anything else enters placement mode: the user aims the tile.
      beginCarry(row.appId, row.title);
    }
    close();
  };

  const status = perPane
    ? `“${invocation.targetLabel}” shows it instead`
    : invocation.target
      ? `choosing an application starts placement: click where it goes (Enter here places ${direction === "row" ? "beside" : "below"} “${invocation.targetLabel}”)`
      : "a new tile opens in the workspace";

  return (
    <LauncherShell
      title={perPane ? `Show in “${invocation.targetLabel}”` : title}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      onChoose={onChoose}
      onClose={close}
      returnFocusTo={returnFocusTo}
      status={status}
      enterVerb={(rowId) => {
        const row = rowId ? rowOf(rowId, model) : null;
        if (perPane) return row?.kind === "view" ? "link" : "replace";
        return row?.kind === "view" ? "go to" : "place";
      }}
      searchLabel="search views and applications"
      placeholder="search views and applications…"
      emptyText="Nothing matches."
    />
  );
}

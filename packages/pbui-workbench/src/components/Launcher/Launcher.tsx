import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LauncherShell,
  isEditableTarget,
  routeWorkbenchKey,
  splitDirectionFor,
  useAnyEscapeSurface,
} from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import { defaultLauncherRows, groupLauncherRows, rowOf, type LauncherInvocation } from "../../launcherRows";
import type { LauncherProps } from "../../types";

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
export function WorkbenchLauncher({
  title = "Open an application",
  shortcut = true,
  shortcutContext,
  rows,
  choose,
  renderDetail,
  scope = "document",
}: LauncherProps) {
  const workbench = useWorkbench();
  const open = workbench.useWorkbenchState((state) => state.launcherOpen);
  const anySurfaceOpen = useAnyEscapeSurface();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(workbench.store.getState().launcherOpen);

  /**
   * Placement mode (PBUI-REBALANCE-1, generalised in §5.E): choosing an
   * application does not place it immediately — the choice is CARRIED, the
   * tiles show drop-zone overlays, and the next click says where it lands
   * (edges dock, centre splits the longer side, Alt replaces what the tile
   * shows). Enter takes the old default spot; Escape or an empty-space click
   * cancels.
   *
   * The mode itself belongs to the workbench, not this component: the modal
   * unmounts when the launcher closes and the carry must outlive it, and a
   * product's own "open this file somewhere" gesture is the same mode with a
   * different prompt. The launcher is now one caller of `wb.placement`.
   */
  const beginCarry = (appId: string, appTitle: string) => {
    void workbench.placement
      .begin({
        prompt: `placing ${appTitle}`,
        defaultLabel: "the default spot",
        // A refused drop (the target cannot split that way — a sliver, say)
        // re-arms rather than ending the mode, and a successful one has
        // already placed the tile by the time the promise settles.
        accept: (aim) => {
          const placement = workbench.verbs.placeAt(appId, aim.placementId, aim.zone);
          if (placement) placedRef.current = placement;
          return placement !== null;
        },
      })
      .then((outcome) => {
        if (outcome.kind === "aimed" && placedRef.current) workbench.focusPlacement(placedRef.current);
        else if (outcome.kind === "default") {
          const placement = workbench.verbs.place(appId);
          if (placement) workbench.focusPlacement(placement);
        }
        placedRef.current = null;
      });
  };
  const placedRef = useRef<string | null>(null);
  useEffect(() => () => workbench.placement.cancel(), [workbench]);

  // The store changes synchronously inside the click/key handler, before React
  // mounts Dialog. Capture there: another shell effect may move focus while
  // rendering, which is too late to identify the actual launcher invoker.
  useLayoutEffect(
    () =>
      workbench.store.subscribe(() => {
        const next = workbench.store.getState().launcherOpen;
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

  return (
    <>
      {open ? (
        <LauncherModal
          title={title}
          rows={rows}
          choose={choose}
          renderDetail={renderDetail}
          scope={scope}
          returnFocusTo={returnFocusRef.current}
          beginCarry={beginCarry}
        />
      ) : null}
    </>
  );
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
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const active = workbench.useWorkbenchState((state) => state.activePlacementId);
  const from = workbench.useWorkbenchState((state) => state.launcherFrom);
  const [query, setQuery] = useState("");

  const labelOf = (placementId: string | null): string => {
    if (!placementId) return "";
    const leaf = leaves(workspaceTree(document, workspaceId)).find((node) => node.id === placementId);
    if (leaf?.body.case !== "leaf") return placementId;
    const view = document.views[leaf.body.value.viewId];
    const app = view ? workbench.apps.get(view.appId) : null;
    return view?.title || app?.titleFor?.(view) || app?.title || view?.appId || placementId;
  };

  const invocation = useMemo<LauncherInvocation>(() => {
    const all = leaves(workspaceTree(document, workspaceId));
    // Per-pane mode aims at the tile it was invoked from; the global one at
    // the active tile, falling back to the first so Enter always does
    // something rather than silently nothing.
    const target = from ?? (all.some((leaf) => leaf.id === active) ? active : (all[0]?.id ?? null));
    return { from, target, targetLabel: labelOf(target) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, workspaceId, active, from, workbench]);

  const perPane = invocation.from !== null;
  const direction = invocation.target ? splitDirectionFor(invocation.target, workbench.root()) : "row";

  const model = useMemo(() => {
    const context = { document, apps: workbench.apps, workspaceId, invocation, query: query.trim().toLowerCase(), scope };
    return rows ? rows(context) : defaultLauncherRows(context);
  }, [document, workbench, workspaceId, invocation, query, rows, scope]);

  const groups = useMemo(
    () => groupLauncherRows(model, workbench.apps, perPane, renderDetail),
    [model, workbench, perPane, renderDetail],
  );

  const close = () => workbench.verbs.closeLauncher();

  /**
   * Four meanings over two row kinds and two modes:
   *
   *              global                     per-pane
   *   view       go to it                   link this pane to it
   *   app        place a new tile           show it in this pane
   *
   * A product's `choose` runs first and returning true claims the row; false
   * (or no handler) falls through to this table, so a product may override
   * one row without restating the rest.
   */
  const onChoose = (rowId: string) => {
    const row = rowOf(rowId, model);
    if (!row) return;
    const claimed = choose?.(row, {
      document,
      apps: workbench.apps,
      workspaceId,
      invocation,
      query: query.trim().toLowerCase(),
      scope,
    });
    if (claimed) {
      close();
      return;
    }
    if (perPane && invocation.from) {
      if (row.kind === "view") workbench.verbs.link(invocation.from, row.viewId);
      else workbench.verbs.replace(invocation.from, row.appId);
      workbench.focusPlacement(invocation.from);
    } else if (row.kind === "view") {
      workbench.verbs.goToView(row.viewId);
      const placement = workbench.activePlacementId();
      if (placement) workbench.focusPlacement(placement);
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

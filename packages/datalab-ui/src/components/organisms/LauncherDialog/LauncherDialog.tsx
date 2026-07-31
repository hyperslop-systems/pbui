import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dialog, Text, TextInput } from "@hyperslop-systems/pbui";
import { useScopedApps } from "../../../appkit/AppScope";
import type { RootState } from "../../../store";
import {
  type LauncherInvocation,
  layoutActions,
  type Node,
  type NodeId,
} from "../../../store/layout";
import {
  buildLauncherIndex,
  type LauncherResultId,
  type LauncherRow,
  type LauncherSearchContext,
  parseLauncherQuery,
  preferredPlacement,
  searchLauncherIndex,
} from "../ViewSwitcher";
import { LauncherResults } from "./LauncherResults";
import styles from "./LauncherDialog.module.css";

/**
 * The searchable launcher, as a modal over the whole workbench.
 *
 * One surface for three jobs (design-doc/02 Option B): filling an empty tile,
 * replacing a working one, and — from Phase 3 — going to a view somewhere else.
 * A modal rather than the tile body because result geometry then stops
 * depending on tile size, which is what made the embedded switcher unusable in
 * a narrow tile and what forced the old grid to stay flat.
 *
 * Mounted unconditionally by the shell and rendering nothing until
 * `state.layout.launcher` is set, so opening it is a dispatch from anywhere —
 * including from a serialisable tile verb, which is the constraint that put the
 * invocation in the store rather than in a context.
 */
export function LauncherDialog() {
  const invocation = useSelector((state: RootState) => state.layout.launcher ?? null);
  // Remounted per invocation so query text and the highlighted row start fresh
  // and never leak from a Replace into the next launcher.
  return invocation ? (
    <LauncherModal key={invocationKey(invocation)} invocation={invocation} />
  ) : null;
}

function invocationKey(invocation: LauncherInvocation): string {
  return invocation.kind === "navigate"
    ? `navigate:${invocation.activePlacementId ?? ""}`
    : `${invocation.kind}:${invocation.placementId}`;
}

const HEADINGS: Record<LauncherInvocation["kind"], string> = {
  "fill-launcher": "Open a view",
  replace: "Replace this view",
  navigate: "Go to view",
};

function LauncherModal({ invocation }: { invocation: LauncherInvocation }) {
  const dispatch = useDispatch();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<LauncherResultId | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Instance scope only. Stage and workspace scope are applied per row inside
  // the index, because a row is scoped by the workspace it concerns (§8.4);
  // passing `useAvailableApps()` here would hide views legitimately placed in
  // another workspace.
  const apps = useScopedApps();
  const layout = useSelector((state: RootState) => state.layout);
  const docs = useSelector((state: RootState) => state.world.docs);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);

  /*
   * The launcher does NOT register its own Escape surface.
   *
   * `Dialog` already registers one, and registering a second here is worse than
   * redundant: child effects run before parent effects, so the launcher's entry
   * would land on top of the Dialog's own, and the Dialog — the component that
   * actually handles Escape — would decide it was not topmost and ignore the
   * key. Escape then closed nothing at all. Found in the browser; see
   * `test/escape-surfaces.test.ts` for the regression.
   */
  const targetPlacementId = invocation.kind === "navigate" ? null : invocation.placementId;
  /** Snapshotted at open: the tile the user was in when the shortcut fired. */
  const activePlacement = invocation.kind === "navigate" ? invocation.activePlacementId : null;

  const docNames = useMemo(
    () => Object.fromEntries(Object.entries(docs).map(([id, doc]) => [id, doc.name])),
    [docs],
  );

  const index = useMemo(
    () =>
      buildLauncherIndex({
        apps,
        views: layout.views,
        viewOrder: layout.viewOrder,
        workspaces: layout.spaces,
        stages: layout.stages,
        currentStageId: layout.currentStageId,
        currentWorkspaceId: layout.currentSpaceId,
        docNames,
      }),
    [apps, layout, docNames],
  );

  /** The workspace a placed result would land in, and the view already there. */
  const target = useMemo(() => {
    if (!targetPlacementId) return { workspace: null, viewId: null };
    let viewId: string | null = null;
    const holds = (node: Node): boolean => {
      if (node.type === "leaf") {
        if (node.id !== targetPlacementId) return false;
        viewId = node.viewId;
        return true;
      }
      return holds(node.a) || holds(node.b);
    };
    const workspace = layout.spaces.find((space) => holds(space.tree)) ?? null;
    return { workspace, viewId };
  }, [layout.spaces, targetPlacementId]);

  const targetWorkspace = target.workspace;

  /**
   * Where a new view goes in navigate mode.
   *
   * `Mod+K` must never destroy a working tile (Decision 6), so a new view is
   * never placed *into* one. But refusing outright — the first implementation —
   * made the global launcher strictly worse than the tile's own, and on a fresh
   * page load, where nothing has been focused, it offered no new views at all.
   *
   * Splitting keeps the promise and drops the refusal: the active tile stays,
   * gets narrower, and the new view appears beside it. `fill` when the target is
   * already an empty launcher, because splitting an empty tile to make room for
   * something would be absurd.
   */
  const newViewTarget = useMemo(() => {
    if (invocation.kind !== "navigate") return null;
    const space = layout.spaces.find((candidate) => candidate.id === layout.currentSpaceId);
    if (!space) return null;

    const firstLeaf = (node: Node): Extract<Node, { type: "leaf" }> | null =>
      node.type === "leaf" ? node : (firstLeaf(node.a) ?? firstLeaf(node.b));
    const holds = (node: Node, id: NodeId): Extract<Node, { type: "leaf" }> | null =>
      node.type === "leaf"
        ? node.id === id
          ? node
          : null
        : (holds(node.a, id) ?? holds(node.b, id));

    // The active tile when there is one; otherwise the first in tree order.
    // Deterministic rather than clever: the header names it either way, so a
    // user who does not like the choice can see it before pressing Enter.
    const leaf =
      (invocation.activePlacementId ? holds(space.tree, invocation.activePlacementId) : null) ??
      firstLeaf(space.tree);
    if (!leaf) return null;

    const isLauncher = layout.views[leaf.viewId]?.appId === "launcher";
    return {
      placementId: leaf.id,
      workspace: space,
      title: layout.views[leaf.viewId]?.title ?? layout.views[leaf.viewId]?.appId ?? "a tile",
      action: isLauncher ? ("fill" as const) : ("split" as const),
    };
  }, [invocation, layout.spaces, layout.currentSpaceId, layout.views]);

  const context: LauncherSearchContext = useMemo(
    () => ({
      mode: invocation.kind === "navigate" ? "navigate" : "place",
      targetWorkspaceId: targetWorkspace?.id ?? newViewTarget?.workspace.id ?? null,
      allowNewViews: invocation.kind !== "navigate" || newViewTarget !== null,
      // Replacing a tile with what it already shows is a no-op; the embedded
      // switcher has always dropped this row and the modal must too.
      excludeViewId: target.viewId,
    }),
    [invocation.kind, targetWorkspace, target.viewId, newViewTarget],
  );

  const parsed = useMemo(() => parseLauncherQuery(query), [query]);
  const results = useMemo(
    () => searchLauncherIndex(index, parsed, context),
    [index, parsed, context],
  );

  // Keep the highlight on a row that still exists. Falling back to the first
  // row rather than to null means Enter always does something predictable while
  // the user is still typing.
  const rows = results.rows;
  const active =
    activeId && rows.some((row) => row.id === activeId) ? activeId : (rows[0]?.id ?? null);
  useEffect(() => {
    if (active !== activeId) setActiveId(active);
  }, [active, activeId]);

  useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector(`[id="${CSS.escape(active)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    dispatch(layoutActions.closeLauncher());
    // Focus returns by placement id rather than by a stored HTMLElement: the
    // element may have been unmounted and remounted while the modal was open,
    // and a detached node silently swallows `.focus()`.
    const restore = targetPlacementId ?? (invocation.kind === "navigate" ? activePlacement : null);
    if (restore) focusPlacement(restore);
  };

  const choose = (row: LauncherRow) => {
    if (invocation.kind === "navigate") {
      // Navigation never mutates the layout: switch workspace, focus a
      // placement, done. A new-view row is only reachable here when the active
      // tile is a launcher, in which case it falls through to placement below.
      if (row.kind === "placed") {
        dispatch(layoutActions.setCurrentSpace(row.workspaceId));
        dispatch(layoutActions.closeLauncher());
        // Prefer the occurrence the user was already in when a linked view is
        // placed twice in the target workspace (§19 question 5).
        const target = preferredPlacement(row, activePlacement);
        if (target) focusPlacement(target);
        return;
      }
      if (row.kind !== "new" || !newViewTarget) return;
      const docId = row.docBound ? activeDocId : null;
      if (newViewTarget.action === "fill") {
        dispatch(
          layoutActions.createViewInPlacement({
            nodeId: newViewTarget.placementId,
            appId: row.appId,
            docId,
          }),
        );
        dispatch(layoutActions.closeLauncher());
        focusPlacement(newViewTarget.placementId);
        return;
      }
      // Split along the tile's LONGER axis, so the new view gets a usable
      // rectangle rather than a sliver. A wide tile splits into two columns;
      // a tall one stacks. Read from the DOM because only the DOM knows the
      // rendered geometry — the tree stores ratios, not pixels.
      dispatch(
        layoutActions.splitLeaf({
          nodeId: newViewTarget.placementId,
          dir: splitDirectionFor(newViewTarget.placementId),
          appId: row.appId,
          docId,
        }),
      );
      dispatch(layoutActions.closeLauncher());
      return;
    }

    const placementId = invocation.placementId;
    if (row.kind === "new") {
      dispatch(
        layoutActions.createViewInPlacement({
          nodeId: placementId,
          appId: row.appId,
          docId: row.docBound ? activeDocId : null,
        }),
      );
    } else {
      dispatch(layoutActions.replacePlacementWithView({ nodeId: placementId, viewId: row.viewId }));
    }
    dispatch(layoutActions.closeLauncher());
    focusPlacement(placementId);
  };

  const move = (delta: number | "first" | "last") => {
    if (rows.length === 0) return;
    const at = rows.findIndex((row) => row.id === active);
    const next =
      delta === "first"
        ? 0
        : delta === "last"
          ? rows.length - 1
          : // Wrapping, because a list this short makes "stuck at the bottom"
            // feel broken rather than safe.
            (at + delta + rows.length) % rows.length;
    setActiveId(rows[next]?.id ?? null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        move("first");
        break;
      case "End":
        event.preventDefault();
        move("last");
        break;
      case "Enter": {
        event.preventDefault();
        const row = rows.find((candidate) => candidate.id === active);
        if (row) choose(row);
        break;
      }
      default:
        break;
    }
  };

  const where = targetWorkspace
    ? `${targetWorkspace.name} · ${invocation.kind === "replace" ? "this tile" : "new view"}`
    : newViewTarget
      ? `${newViewTarget.workspace.name} · ${
          newViewTarget.action === "fill" ? "the empty tile" : `beside ${newViewTarget.title}`
        }`
      : "a view anywhere · nothing is replaced";

  /**
   * `+chart` from a working tile, refused with the way forward.
   *
   * The alternatives are worse than a refusal: picking a split direction on the
   * user's behalf, or replacing whatever they were looking at. Both are silent
   * and one is destructive.
   */
  // Only reachable now when the current workspace somehow holds no tile at all.
  const newViewsRefused = invocation.kind === "navigate" && !newViewTarget && parsed.kind === "new";

  const activeRow = rows.find((row) => row.id === active);
  const enterVerb =
    activeRow?.kind === "new" ? "create" : invocation.kind === "navigate" ? "go to" : "place";

  return (
    <Dialog title={HEADINGS[invocation.kind]} onClose={close} closeLabel="close the launcher">
      <div className={styles.body}>
        <TextInput
          label="search views or type + for a new view"
          placeholder="search views…  + new view  ws2 one workspace"
          value={query}
          onValueChange={setQuery}
          onKeyDown={onKeyDown}
          width="fill"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          {...(active ? { "aria-activedescendant": active } : {})}
        />

        <div className={styles.status}>
          <Text size="tiny" tone="faint">
            {invocation.kind === "navigate" ? "go to: " : "place in: "}
            {where}
          </Text>
          {parsed.error === "workspace-and-new-are-incompatible" && (
            <Text size="tiny" tone="faint">
              A new view does not belong to a workspace yet — drop the ws prefix.
            </Text>
          )}
          {newViewsRefused && (
            <Text size="tiny" tone="faint" prose>
              New views need an empty tile. Focus a <strong>new tile</strong>, or use{" "}
              <strong>Split right</strong> / <strong>Split below</strong> first.
            </Text>
          )}
        </div>

        {/* Polite rather than assertive: the count changes on every keystroke,
            and an assertive region would interrupt the user mid-word. */}
        <div aria-live="polite" className={styles.live}>
          <Text size="micro" tone="faint">
            {results.rows.length} {results.rows.length === 1 ? "result" : "results"}
            {results.limited && results.rows.length > 0 ? " · type to search all" : ""}
          </Text>
        </div>

        <div className={styles.scroll} ref={listRef}>
          <LauncherResults
            results={results}
            listId={listId}
            activeId={active}
            mode={context.mode}
            targetWorkspaceName={targetWorkspace?.name ?? null}
            explainedElsewhere={newViewsRefused}
            onChoose={choose}
            onHover={setActiveId}
          />
        </div>

        <div className={styles.hint}>
          <Text size="micro" tone="faint">
            {/*
              Named after the ACTIVE row, not the invocation. In navigate mode
              onto a launcher tile, Enter creates a view — labelling that "go
              to" describes the mode rather than what the key is about to do.
            */}
            ↑↓ choose · Enter {enterVerb} · Esc close
          </Text>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Split a tile along its longer axis.
 *
 * The design left split direction as an open question and warned against
 * choosing one silently. This chooses, and the modal says which tile it will
 * split before the user commits — which addresses the actual objection, since
 * what makes an implicit split bad is that it is a surprise, not that it is a
 * default. A wide tile becomes two columns; a tall one stacks.
 */
function splitDirectionFor(placementId: NodeId): "row" | "col" {
  const element = document.querySelector<HTMLElement>(
    `[data-placement-id="${CSS.escape(placementId)}"]`,
  );
  if (!element) return "row";
  const box = element.getBoundingClientRect();
  return box.width >= box.height ? "row" : "col";
}

/**
 * Focus a placement's title after the layout that contains it has rendered.
 *
 * One frame late deliberately: a navigate result may have just switched
 * workspace, so the target tile does not exist yet when the reducer returns.
 * The same query `Tile.restoreTitleFocus` uses, for the same element.
 */
function focusPlacement(placementId: NodeId): void {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(placementId)}"]`)
      ?.querySelector<HTMLElement>('[data-ptype="tile"]')
      ?.focus();
  });
}

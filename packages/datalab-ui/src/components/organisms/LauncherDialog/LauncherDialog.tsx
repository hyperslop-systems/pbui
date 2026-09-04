import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { commands } from "@hyperslop-systems/workbench-core";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { useMeQuery } from "../../../api/client";
import { Dialog, Text, TextInput } from "@hyperslop-systems/pbui";
import { useScopedApps } from "../../../appkit/AppScope";
import {
  useCurrentStageId,
  useCurrentWorkspaceId,
  useDatalabWorkbench,
} from "../../../appkit/DatalabWorkbenchContext";
import { stageIsVisible } from "../../../store/stages";
import type { RootState } from "../../../store";
import { metaOf, navigationActions, type LauncherInvocation } from "../../../store/navigation";
import {
  buildLauncherIndex,
  type LauncherResultId,
  type LauncherRow,
  type LauncherSearchContext,
  type LauncherWorkspace,
  blockedReason,
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
 *
 * Datalab's own, not the workbench shell's (PBUI-DATALAB-WORKBENCH-1 design
 * §10, Decision 5): it searches across stages, speaks `wsN` and `+`, scopes
 * every row by the workspace it concerns, and prefers the placement the user
 * came from. What changed underneath is the data: the index is built over
 * the core's document and navigation metadata, and every choice becomes a
 * core command through the controller.
 *
 * Mounted unconditionally by the shell and rendering nothing until
 * `navigation.launcher` is set, so opening it is a dispatch from anywhere —
 * including from a serialisable tile verb.
 */
export function LauncherDialog() {
  const invocation = useSelector((state: RootState) => state.navigation.launcher ?? null);
  // Remounted per invocation so query text and the highlighted row start fresh
  // and never leak from a Replace into the next launcher.
  return invocation ? (
    <LauncherModal key={invocationKey(invocation)} invocation={invocation} />
  ) : null;
}

function invocationKey(invocation: LauncherInvocation): string {
  return invocation.kind === "navigate"
    ? `navigate:${invocation.activePlacementId ?? ""}`
    : `${invocation.kind}:${invocation.placementId}:${
        invocation.kind === "fill-launcher" ? (invocation.prefill ?? "") : ""
      }`;
}

const HEADINGS: Record<LauncherInvocation["kind"], string> = {
  "fill-launcher": "Open a view",
  replace: "Replace this view",
  navigate: "Go to view",
};

function LauncherModal({ invocation }: { invocation: LauncherInvocation }) {
  const dispatch = useDispatch();
  const workbench = useDatalabWorkbench();
  const listId = useId();
  const [query, setQuery] = useState(
    invocation.kind === "fill-launcher" ? (invocation.prefill ?? "") : "",
  );
  const [activeId, setActiveId] = useState<LauncherResultId | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Instance scope only. Stage and workspace scope are applied per row inside
  // the index, because a row is scoped by the workspace it concerns (§8.4).
  const apps = useScopedApps();
  const document = workbench.shell.useDocument();
  const index = workbench.shell.useCoreState((state) => state.index);
  const currentWorkspaceId = useCurrentWorkspaceId();
  const currentStageId = useCurrentStageId();
  const stages = useSelector((state: RootState) => state.navigation.stages);
  const workspaceMeta = useSelector((state: RootState) => state.navigation.workspace);
  // Audience is a rendering constraint, not a security boundary — the server
  // denies the data regardless (DR-31). What it buys here is that a signed-out
  // visitor is never offered a destination the gate will bounce them out of.
  const { data: me } = useMeQuery();
  const authed = me?.authenticated === true;
  const visibleStageIds = useMemo(
    () => stages.filter((s) => stageIsVisible(s, authed)).map((s) => s.id),
    [stages, authed],
  );
  const docs = useSelector((state: RootState) => state.world.docs);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);

  /*
   * The launcher does NOT register its own Escape surface: `Dialog` already
   * does, and a second entry would land on top of the Dialog's own and stop
   * it closing. See `test/escape-surfaces.test.ts` for the regression.
   */
  const targetPlacementId = invocation.kind === "navigate" ? null : invocation.placementId;
  /** Snapshotted at open: the tile the user was in when the shortcut fired. */
  const activePlacement = invocation.kind === "navigate" ? invocation.activePlacementId : null;

  const docNames = useMemo(
    () => Object.fromEntries(Object.entries(docs).map(([id, doc]) => [id, doc.name])),
    [docs],
  );

  /** The core's workspaces joined with their navigation metadata. */
  const workspaces = useMemo<LauncherWorkspace[]>(
    () =>
      document.workspaces.map((workspace) => {
        const meta = workspaceMeta[workspace.id];
        return {
          id: workspace.id,
          name: workspace.name,
          stageId: metaOf(
            { stages, workspace: workspaceMeta, rememberedWorkspaceByStage: {} },
            workspace.id,
          ).stageId,
          apps: meta?.apps ?? null,
          tree: workspace.tree,
        };
      }),
    [document, workspaceMeta, stages],
  );

  const launcherIndex = useMemo(
    () =>
      buildLauncherIndex({
        apps,
        views: document.views,
        viewOrder: document.viewOrder,
        workspaces,
        stages,
        currentStageId,
        currentWorkspaceId,
        visibleStageIds,
        docNames,
      }),
    [
      apps,
      document,
      workspaces,
      stages,
      currentStageId,
      currentWorkspaceId,
      visibleStageIds,
      docNames,
    ],
  );

  /** The workspace a placed result would land in, and the view already there. */
  const target = useMemo(() => {
    if (!targetPlacementId) return { workspace: null, viewId: null };
    const workspaceId = index.workspaceByNodeId.get(targetPlacementId) ?? null;
    const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
    return { workspace, viewId: index.viewByPlacementId.get(targetPlacementId) ?? null };
  }, [index, workspaces, targetPlacementId]);

  const targetWorkspace = target.workspace;

  /**
   * Where a new view goes in navigate mode.
   *
   * `Mod+K` must never destroy a working tile (Decision 6), so a new view is
   * never placed *into* one: the active tile splits and the new view appears
   * beside it. `fill` when the target is already an empty launcher, because
   * splitting an empty tile to make room for something would be absurd.
   */
  const newViewTarget = useMemo(() => {
    if (invocation.kind !== "navigate") return null;
    const workspace = workspaces.find((candidate) => candidate.id === currentWorkspaceId);
    if (!workspace) return null;
    const own = leaves(workspace.tree);
    // The active tile when there is one; otherwise the first in tree order.
    const leaf = own.find((node) => node.id === invocation.activePlacementId) ?? own[0];
    if (!leaf || leaf.body.case !== "leaf") return null;
    const view = document.views[leaf.body.value.viewId];
    return {
      placementId: leaf.id,
      workspace,
      title: view?.title || view?.appId || "a tile",
      action: view?.appId === "launcher" ? ("fill" as const) : ("split" as const),
    };
  }, [invocation, workspaces, currentWorkspaceId, document.views]);

  /**
   * What the target workspace may hold: instance ∩ its stage ∩ itself.
   *
   * `useAvailableApps()` answers this for the CURRENT workspace, which is the
   * wrong workspace whenever the launcher targets another one — the whole of
   * §8.4's place-mode half.
   */
  const targetAppIds = useMemo(() => {
    const workspace = targetWorkspace ?? newViewTarget?.workspace ?? null;
    if (!workspace) return null;
    const stage = stages.find((candidate) => candidate.id === workspace.stageId);
    const narrow = (allowed: string[] | null, list: readonly string[] | null | undefined) =>
      list == null ? allowed : (allowed ?? [...list]).filter((id) => list.includes(id));
    return narrow(narrow(null, stage?.apps), workspace.apps);
  }, [targetWorkspace, newViewTarget, stages]);

  const context: LauncherSearchContext = useMemo(
    () => ({
      mode: invocation.kind === "navigate" ? "navigate" : "place",
      targetWorkspaceId: targetWorkspace?.id ?? newViewTarget?.workspace.id ?? null,
      allowNewViews: invocation.kind !== "navigate" || newViewTarget !== null,
      // Replacing a tile with what it already shows is a no-op.
      excludeViewId: target.viewId,
      targetAppIds,
    }),
    [invocation.kind, targetWorkspace, target.viewId, newViewTarget, targetAppIds],
  );

  const parsed = useMemo(() => parseLauncherQuery(query), [query]);
  const results = useMemo(
    () => searchLauncherIndex(launcherIndex, parsed, context),
    [launcherIndex, parsed, context],
  );

  // Keep the highlight on a row that still exists. Falling back to the first
  // row rather than to null means Enter always does something predictable.
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

  const closeLauncher = () => dispatch(navigationActions.closeLauncher());
  // Focus returns by placement id rather than by a stored HTMLElement, through
  // the shell, which scopes the lookup to THIS workbench's root and waits a
  // frame for a tile a command has just created.
  const focus = (placementId: string) => workbench.shell.focusPlacement(placementId);

  const close = () => {
    closeLauncher();
    const restore = targetPlacementId ?? (invocation.kind === "navigate" ? activePlacement : null);
    if (restore) focus(restore);
  };

  const choose = (row: LauncherRow) => {
    // The pointer path checks this in `LauncherResults`; Enter did not, so a
    // highlighted out-of-scope row could be placed with the keyboard and
    // bypass the workspace restriction entirely. One field, both paths.
    if (blockedReason(row)) return;
    const controller = workbench.controller;
    if (invocation.kind === "navigate") {
      // Navigation never mutates the layout: switch workspace, aim at a
      // placement, done — one transition, so the activation sees the switch.
      if (row.kind === "placed") {
        const placement = preferredPlacement(row, activePlacement);
        controller.execute([
          commands.selectWorkspace(row.workspaceId),
          ...(placement ? [commands.activate(placement)] : []),
        ]);
        controller.store.dispatch(
          navigationActions.remember({
            stageId: metaOf(
              { stages, workspace: workspaceMeta, rememberedWorkspaceByStage: {} },
              row.workspaceId,
            ).stageId,
            workspaceId: row.workspaceId,
          }),
        );
        closeLauncher();
        if (placement) focus(placement);
        return;
      }
      if (row.kind !== "new" || !newViewTarget) return;
      const docId = row.docBound ? activeDocId : null;
      const show = { kind: "application" as const, appId: row.appId, docId };
      if (newViewTarget.action === "fill") {
        controller.replacePlacement(newViewTarget.placementId, show);
        closeLauncher();
        focus(newViewTarget.placementId);
        return;
      }
      // Split along the tile's LONGER axis: the shell measures the rendered
      // geometry before the command, so no axis is named here.
      const result = controller.splitTile(newViewTarget.placementId, undefined, show);
      closeLauncher();
      if (result.ok && result.placementId) focus(result.placementId);
      return;
    }

    const placementId = invocation.placementId;
    if (row.kind === "new") {
      controller.replacePlacement(placementId, {
        kind: "application",
        appId: row.appId,
        docId: row.docBound ? activeDocId : null,
      });
    } else {
      controller.replacePlacement(placementId, { kind: "existing", viewId: row.viewId });
    }
    closeLauncher();
    focus(placementId);
  };

  const move = (delta: number | "first" | "last") => {
    if (rows.length === 0) return;
    const at = rows.findIndex((row) => row.id === active);
    const next =
      delta === "first"
        ? 0
        : delta === "last"
          ? rows.length - 1
          : (at + delta + rows.length) % rows.length;
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

  // Only reachable now when the current workspace somehow holds no tile at all.
  const newViewsRefused = invocation.kind === "navigate" && !newViewTarget && parsed.kind === "new";

  const activeRow = rows.find((row) => row.id === active);
  const enterVerb =
    activeRow?.kind === "new" ? "create" : invocation.kind === "navigate" ? "go to" : "place";

  return (
    <Dialog title={HEADINGS[invocation.kind]} onClose={close} closeLabel="close the launcher">
      <div className={styles.body}>
        <TextInput
          accessibleName="search views or type + for a new view"
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

        {/* Polite rather than assertive: the count changes on every keystroke. */}
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
            explainedElsewhere={newViewsRefused}
            onChoose={choose}
            onHover={setActiveId}
          />
        </div>

        <div className={styles.hint}>
          <Text size="micro" tone="faint">
            ↑↓ choose · Enter {enterVerb} · Esc close
          </Text>
        </div>
      </div>
    </Dialog>
  );
}

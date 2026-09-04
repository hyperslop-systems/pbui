import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, Button, IconButton, Text } from "@hyperslop-systems/pbui";
import { AppShell } from "@hyperslop-systems/pbui-workbench";
import { useDispatch, useSelector } from "react-redux";
import { leavesOfWorkspace } from "@hyperslop-systems/workbench-core";
import { AcceptBanner, ContextHelp, MouseDocLine, ObjectMenu, usePbui } from "../../../pbui";
import type { RootState } from "../../../store";
import { allApps } from "../../../appkit/registry";
import {
  useCurrentStage,
  useCurrentStageId,
  useDatalabWorkbench,
  useWorkspacesOfStage,
} from "../../../appkit/DatalabWorkbenchContext";
import { commitImport, kindFor } from "../../../store/effects";
import { navigationActions } from "../../../store/navigation";
import {
  BundleDialog,
  LauncherDialog,
  StageBar,
  WorkspaceStrip,
  renderDatalabTileAction,
  renderDatalabTitle,
} from "../../organisms";
import { useAnyEscapeSurface, useEscapeSurface } from "../../../appkit/useTransientSurface";
import { isEditableTarget, routeWorkbenchKey } from "@hyperslop-systems/pbui";
import styles from "./Workbench.module.css";

/**
 * The shell: chrome, the workbench Surface, and the three PBUI surfaces.
 *
 * Holds no chart state whatsoever — a masthead, a workspace strip, the
 * split tree, the accept banner, the object menu and the mouse documentation
 * line. Everything a tile shows lives in the world.
 *
 * **The split tree is the workbench shell's** (PBUI-DATALAB-WORKBENCH-1,
 * design §9). `workbench.shell.Surface` renders the core's current workspace
 * — recursion, dividers, drag and drop, active placement, per-tile error
 * boundaries — and Datalab supplies two slots: the `<tile>` presentation in
 * the title bar and the door to its own launcher. The generic launcher, the
 * generic workspace strip and connect mode are not mounted: Datalab's stage
 * chrome, its rich launcher and its Mod+K stay the product's.
 *
 * **It also holds no application state** (DATADROP-7 DR-52): the signed-out
 * gate, the `?first=1` read, `useMeQuery` and persistence are session
 * concerns in `Workbench`. What is left takes props, so an embedded instance
 * renders the same component as the product with a different configuration.
 */
export interface WorkbenchShellProps {
  /**
   * The DATALAB wordmark and its tagline.
   *
   * **`?? stage.chrome`, never `&&`** (DATADROP-8 §5.6). Three chrome props
   * have two possible sources: the stage says what this part of the product
   * looks like, and the instance may override. An instance that says nothing
   * defers to the stage; an instance that says `false` wins.
   */
  masthead?: boolean;
  /** The workspace strip. Hidden by a stage that holds exactly one workspace. */
  workspaces?: boolean;
  /** The stage switcher in the masthead. Off for the sign-in stage. */
  stageBar?: boolean;
  /** Extra ambient text for the mouse-doc line, appended to the tile counts. */
  ambient?: string;
  /**
   * Expand to fill the window, and come back. Supplied by an embedded
   * instance, absent in the product — which already fills the window.
   */
  fullFrame?: boolean;
  onToggleFullFrame?: () => void;
}

/**
 * The import dialog, rendered by the shell because it is modal over the whole
 * workbench and opened from a menu three components down. A separate
 * component so the shell does not re-render on every keystroke in the text
 * area. Rendered BEFORE `<ObjectMenu />` so the menu's stacking context wins.
 */
function ImportDialog() {
  const dispatch = useDispatch();
  const pending = useSelector((state: RootState) => state.navigation.pendingImport ?? null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setError(null);
    dispatch(navigationActions.closeImport());
  }, [dispatch]);

  if (!pending) return null;

  return (
    <BundleDialog
      kind={kindFor(pending.target)}
      initial={pending.prefill}
      from={pending.from}
      // The registry, not the scope: a bundle naming an application this BUILD
      // lacks is the warning. An application the stage merely does not offer is
      // still installed, and warning about it would be wrong.
      knownApps={new Set(allApps().map((app) => app.id))}
      error={error}
      onCancel={close}
      onConfirm={(text) => {
        const result = (dispatch as (action: unknown) => { ok: boolean; reason?: string })(
          commitImport(text),
        );
        // The dialog already refuses text that will not parse, so reaching here
        // means the caller refused for a reason the dialog could not know —
        // the target vanished while it was open, say. Shown rather than
        // swallowed; the thunk closes the dialog itself on success.
        if (!result.ok) setError(result.reason ?? "that import did not apply");
      }}
    />
  );
}

/**
 * What an export did, stated once, at the moment the user is about to paste.
 * The failure case is why this exists: a browser that refuses the clipboard
 * write must not leave the user believing the copy worked.
 */
function ExportNotice() {
  const dispatch = useDispatch();
  const notice = useSelector((state: RootState) => state.navigation.notice ?? null);
  const close = useCallback(() => dispatch(navigationActions.dismissNotice()), [dispatch]);
  if (!notice) return null;
  return (
    <Dialog
      title={notice.title}
      onClose={close}
      footer={
        <Button variant="raised" fill="var(--pbui-tone-source)" onClick={close}>
          OK
        </Button>
      }
    >
      <Text size="small" tone={notice.ok ? "default" : "danger"} prose>
        {notice.body}
      </Text>
    </Dialog>
  );
}

export function WorkbenchShell({
  masthead,
  workspaces,
  stageBar,
  ambient,
  fullFrame = false,
  onToggleFullFrame,
}: WorkbenchShellProps = {}) {
  const workbench = useDatalabWorkbench();
  const stage = useCurrentStage();
  const stageId = useCurrentStageId();
  // Workspaces in THIS stage, not in the document: the count under the canvas
  // should agree with the strip above it, and the strip is stage-scoped.
  const spaceCount = useWorkspacesOfStage(stageId).length;
  const tileCount = workbench.shell.useCoreState(
    (state) => leavesOfWorkspace(state.index, state.session.workspaceId).length,
  );
  const docCount = useSelector((state: RootState) => state.world.docOrder.length);

  const chrome = {
    masthead: masthead ?? stage?.chrome.masthead ?? true,
    workspaces: workspaces ?? stage?.chrome.workspaces ?? true,
    stageBar: stageBar ?? stage?.chrome.stageBar ?? true,
  };

  const dispatch = useDispatch();
  const pbui = usePbui();

  /**
   * Escape leaves full frame — unless something is open on top of it.
   *
   * Registered only while expanded, so a page with six collapsed instances adds
   * no listeners at all. `ownsEscape` is the DATALAB-VIEW-001 half: full frame
   * acts only while it is the topmost open surface.
   */
  const ownsEscape = useEscapeSurface(fullFrame);
  useEffect(() => {
    if (!fullFrame || !onToggleFullFrame || !ownsEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleFullFrame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullFrame, onToggleFullFrame, ownsEscape]);

  /**
   * Mod+K opens the launcher in navigate mode.
   *
   * Navigate, not place (Decision 6): a global shortcut that could silently
   * replace whatever tile happened to be active would make the fastest way into
   * the launcher also the most destructive.
   */
  // `?? null` and not a bare `!== null`: the field is optional, so it is
  // `undefined` until the launcher is opened for the first time.
  const launcherOpen = useSelector(
    (state: RootState) => (state.navigation.launcher ?? null) !== null,
  );
  const activePlacementId = workbench.shell.useCoreState(
    (state) => state.session.activePlacementId,
  );
  // Any dialog, menu or expanded panel anywhere on the page. The shortcut
  // router needs the fact, not the identity.
  const anySurfaceOpen = useAnyEscapeSurface();
  const renaming = useSelector(
    (state: RootState) => (state.navigation.renamingId ?? null) !== null,
  );

  /**
   * Which workbench a key press belongs to.
   *
   *  1. the workbench that CONTAINS focus reacts, which keeps five embedded
   *     instances from all opening at once;
   *  2. when nothing on the page owns focus, a LONE workbench reacts, because
   *     a page with one workbench cannot be ambiguous about which one is meant.
   *
   * `[data-workbench-shell]` is the workbench Surface's own marker, one per
   * instance, so counting them is counting workbenches on the page.
   */
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = shellRef.current;
      if (!root) return;

      const focused = document.activeElement;
      const unowned = !focused || focused === document.body;
      const ownsFocus = !unowned && root.contains(focused);
      const lone = document.querySelectorAll("[data-workbench-shell]").length === 1;
      if (!ownsFocus && !(unowned && lone)) return;

      const decision = routeWorkbenchKey(
        event,
        {
          targetIsEditable: isEditableTarget(event.target as HTMLElement | null),
          launcherOpen,
          dialogOpen: anySurfaceOpen,
          objectMenuOpen: pbui.menu !== null,
          acceptingPresentation: pbui.accepting !== null,
          renamingView: renaming,
        },
        navigator.platform,
      );
      if (decision.kind !== "open-launcher") return;
      event.preventDefault();
      dispatch(
        navigationActions.openLauncher({
          kind: "navigate",
          activePlacementId: activePlacementId ?? null,
        }),
      );
    };
    // Capture, so the launcher wins over anything that would swallow Mod+K
    // deeper in the tree.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    dispatch,
    launcherOpen,
    anySurfaceOpen,
    renaming,
    pbui.menu,
    pbui.accepting,
    activePlacementId,
  ]);

  const counts = `${tileCount} tiles · ${spaceCount} workspaces · ${docCount} documents`;

  return (
    <>
      <AppShell
        ref={shellRef}
        className={styles.shell}
        // Scopes the active-tile outline (§10.3): shown only while a keyboard
        // operation needs a target. Datalab's launcher, not the shell's, is
        // what opens here, so the marker is Datalab's too.
        data-launcher-open={launcherOpen || undefined}
        masthead={chrome.masthead}
        wordmark="Datalab"
        tagline="data · explore · inspect · understand"
        // Top right, as the request asked. Inside the masthead rather than
        // beside the workspace strip, because a stage outranks a workspace and
        // the sign-in stage hides the strip entirely.
        mastheadActions={chrome.stageBar ? <StageBar /> : undefined}
        banner={<AcceptBanner />}
        strip={chrome.workspaces ? <WorkspaceStrip /> : undefined}
        stripActions={
          onToggleFullFrame ? (
            <IconButton
              variant="framed"
              size="tiny"
              glyph={fullFrame ? "⤡" : "⤢"}
              accessibleName={fullFrame ? "leave full frame (Esc)" : "fill the window"}
              title={fullFrame ? "shrink back into the page — Esc does the same" : "fill the window, for room to work"}
              onClick={onToggleFullFrame}
            />
          ) : undefined
        }
        status={<MouseDocLine ambient={ambient ? `${counts} · ${ambient}` : counts} />}
      >
        <workbench.shell.Surface
          renderTitle={renderDatalabTitle}
          tileAction={renderDatalabTileAction}
          // Datalab has no ports to connect; the chord would open an empty mode.
          linkModeShortcut={false}
          swapLabel="⇄ swap applications"
          dockLabel="split-dock here · the source tile closes"
        />
      </AppShell>
      <ImportDialog />
      {/*
       * Mounted unconditionally and rendering nothing until the navigation
       * slice's `launcher` is set. That is what lets a serialisable tile verb
       * open it: the descriptor dispatches, and the shell already has the
       * modal ready to notice.
       */}
      <LauncherDialog />
      <ExportNotice />
      <ObjectMenu />
      <ContextHelp />
    </>
  );
}

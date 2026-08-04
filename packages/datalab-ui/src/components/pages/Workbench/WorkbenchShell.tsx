import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, Button, IconButton, Surface, Toolbar, Text } from "@hyperslop-systems/pbui";
import { useDispatch, useSelector } from "react-redux";
import { AcceptBanner, MouseDocLine, ObjectMenu, usePbui } from "../../../pbui";
import type { RootState } from "../../../store";
import { countLeaves } from "../../../store/layout";
import { allApps } from "../../../appkit/registry";
import { commitImport, kindFor } from "../../../store/effects";
import { layoutActions } from "../../../store/layout";
import { BundleDialog, LauncherDialog, NodeView, StageBar, WorkspaceStrip } from "../../organisms";
import { useAnyEscapeSurface, useEscapeSurface } from "../../../appkit/useTransientSurface";
import { isEditableTarget, routeWorkbenchKey } from "@hyperslop-systems/pbui";
import styles from "./Workbench.module.css";

/**
 * The shell: chrome, a split tree, and the three PBUI surfaces.
 *
 * Holds no chart state whatsoever — a masthead, a workspace strip, a split
 * tree, the accept banner, the object menu and the mouse documentation line.
 * Everything a tile shows lives in the world, which is what this file existing
 * at 100-odd lines demonstrates: the prototype's equivalent is 314 lines
 * because it also holds `labelFor`, `describe` and `actionsFor`
 * (pbui-gog.jsx:2458-2772).
 *
 * **It also holds no application state** (DATADROP-7 DR-52), which is the
 * change this ticket made. The signed-out gate, the `?first=1` URL read, the
 * `useMeQuery` call and the persistence effect were all in here, and all four
 * are routing/session/authentication concerns rather than shell concerns. They
 * ended up here because there was only ever one shell; they moved out the
 * moment there could be five.
 *
 * What is left takes props, so an embedded instance renders the same component
 * as the product with a different configuration rather than a different
 * component. That identity is the whole basis of the tutorial's claim to be
 * executable documentation.
 */
export interface WorkbenchShellProps {
  /**
   * The DATALAB wordmark and its tagline.
   *
   * The product wants it; an instance embedded in a page that already has a
   * masthead does not, and five of them down one page would be absurd.
   *
   * **`?? stage.chrome`, never `&&`** (DATADROP-8 §5.6). Three chrome props now
   * have two possible sources: the stage says what this part of the product
   * looks like, and the instance may override. An instance that says nothing
   * defers to the stage; an instance that says `false` wins. `&&` would make
   * "say nothing" indistinguishable from "say false" and every embedded panel
   * would lose its workspace strip.
   */
  masthead?: boolean;
  /**
   * The workspace strip.
   *
   * Hidden by a stage that holds exactly one workspace, and by a tour section
   * that pins its reader to one layout so the lesson's prose can name what is
   * on screen.
   */
  workspaces?: boolean;
  /** The stage switcher in the masthead. Off for the sign-in stage. */
  stageBar?: boolean;
  /** Extra ambient text for the mouse-doc line, appended to the tile counts. */
  ambient?: string;
  /**
   * Expand to fill the window, and come back.
   *
   * Supplied by an embedded instance, absent in the product — which already
   * fills the window, so a control that promised to do it again would be a lie.
   *
   * Fifteen tiles in a 660px band down a scrolling page is not enough room to
   * do the work a lesson asks for, and asking a reader to open the application
   * in another tab defeats the point of embedding it. The shell renders the
   * control; the instance owns the state, because it owns the box being
   * resized.
   */
  fullFrame?: boolean;
  onToggleFullFrame?: () => void;
}

/**
 * The import dialog, rendered by the shell because it is modal over the whole
 * workbench and opened from a menu three components down.
 *
 * A separate component so the shell does not re-render on every keystroke in
 * the text area: `BundleDialog` holds the text, and only `pendingImport`
 * becoming non-null crosses this boundary.
 *
 * Rendered BEFORE `<ObjectMenu />` so the menu's stacking context wins — it is
 * `z-index: 100` against the dialog's 60, which is what makes right-clicking
 * inside a dialog work at all.
 */
function ImportDialog() {
  const dispatch = useDispatch();
  const pending = useSelector((state: RootState) => state.layout.pendingImport ?? null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setError(null);
    dispatch(layoutActions.closeImport());
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
        // swallowed; the reducer closes the dialog itself on success.
        if (!result.ok) setError(result.reason ?? "that import did not apply");
      }}
    />
  );
}

/**
 * What an export did, stated once, at the moment the user is about to paste.
 *
 * The sentence about what a bundle contains and what it does not is the whole
 * of §7.6 in the interface: it names sources and filter values, which may
 * themselves be sensitive, and it holds no rows and no credentials. Both halves
 * matter and neither is obvious from a JSON blob on a clipboard.
 *
 * The failure case is why this exists at all. The one clipboard write that
 * predates this ticket is `navigator.clipboard?.writeText(secret)` — correct,
 * minimal, and silent — so a browser that refuses leaves the user believing the
 * copy worked.
 */
function ExportNotice() {
  const dispatch = useDispatch();
  const notice = useSelector((state: RootState) => state.layout.notice ?? null);
  const close = useCallback(() => dispatch(layoutActions.dismissNotice()), [dispatch]);
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
  const space = useSelector((state: RootState) =>
    state.layout.spaces.find((s) => s.id === state.layout.currentSpaceId),
  );
  const stage = useSelector((state: RootState) =>
    state.layout.stages.find((s) => s.id === state.layout.currentStageId),
  );
  // Workspaces in THIS stage, not in the layout: the count under the canvas
  // should agree with the strip above it, and the strip is now stage-scoped.
  const spaceCount = useSelector(
    (state: RootState) =>
      state.layout.spaces.filter((s) => s.stageId === state.layout.currentStageId).length,
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
   * no listeners at all — and, more importantly, an Escape meant for the object
   * menu or a pending accept is never intercepted by a workbench that is not
   * covering the window.
   *
   * `ownsEscape` is the DATALAB-VIEW-001 half. Both this and `Dialog` listen on
   * `window`, so one Escape used to close the launcher *and* leave full frame,
   * and no amount of `stopPropagation` in either could order them — listeners
   * on one node do not propagate to each other (design-doc/02 §11.5). The
   * surface stack answers it directly: full frame acts only while it is the
   * topmost open surface.
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
   * the launcher also the most destructive. Selecting a result switches
   * workspace and focuses a placement; nothing about the layout changes.
   *
   * New-view rows are offered only when the active tile is already a launcher,
   * because `+chart` from a working tile has nowhere to go that is not an
   * implicit split or a destroyed view. The launcher says so rather than
   * guessing.
   */
  // `?? null` and not a bare `!== null`: the field is optional, so it is
  // `undefined` until the launcher is opened for the first time — and
  // `undefined !== null` is true, which reads as "permanently open". That
  // suppressed Mod+K entirely and pinned the active-tile outline on, neither of
  // which any unit test could see because both take booleans as arguments.
  const launcherOpen = useSelector((state: RootState) => (state.layout.launcher ?? null) !== null);
  const activePlacementId = useSelector((state: RootState) => state.layout.activePlacementId);
  // Any dialog, menu or expanded panel anywhere on the page. The shortcut
  // router needs the fact, not the identity.
  const anySurfaceOpen = useAnyEscapeSurface();
  const renaming = useSelector((state: RootState) => (state.layout.renamingId ?? null) !== null);

  /**
   * Which workbench a key press belongs to.
   *
   * The design proposed `onKeyDownCapture` on this element, on the argument
   * that only the workbench containing focus should react. Correct in spirit
   * and wrong in practice: browsing the product, DOM focus is very often on
   * `<body>` — after a page load, and after Escape closes the object menu —
   * so a React handler bound here never fires and the shortcut is dead exactly
   * when a user would reach for it.
   *
   * So the rule is stated directly rather than inherited from the event path:
   *
   *  1. the workbench that CONTAINS focus reacts, which keeps five embedded
   *     instances from all opening at once;
   *  2. when nothing on the page owns focus, a LONE workbench reacts, because
   *     a page with one workbench cannot be ambiguous about which one is meant.
   *
   * A page with several instances and focus on `<body>` therefore does nothing,
   * which is the honest answer — there is no way to tell which was intended.
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
        layoutActions.openLauncher({
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

  const counts =
    `${space ? countLeaves(space.tree) : 0} tiles · ` +
    `${spaceCount} workspaces · ${docCount} documents`;

  return (
    <>
      <div
        ref={shellRef}
        className={styles.shell}
        // Marks this subtree as one workbench, so the shortcut listener above
        // can count how many are on the page and tell "the only one" from
        // "one of five".
        data-workbench-shell=""
        // Scopes the active-tile outline (§10.3). Shown only while a keyboard
        // operation needs a target; an always-on border would read as "this
        // view is selected", which is not a concept the product has.
        data-launcher-open={launcherOpen || undefined}
      >
        {chrome.masthead && (
          <Surface tone="inverted" border="none">
            <Toolbar tight>
              <Text size="title" strong>
                <span className={styles.wordmark}>DATALAB</span>
              </Text>
              {/* The tagline names the four things the workbench does, in the
                  order a session actually goes: load a source, look at it, ask
                  what a value is, and end up somewhere. It is the only prose in
                  the shell chrome, so it stays on the tiny scale. */}
              <Text size="tiny" tone="faint">
                <span className={styles.tagline}>DATA · EXPLORE · INSPECT · UNDERSTAND</span>
              </Text>
              {/* Top right, as the request asked. Inside the masthead rather
                  than beside the workspace strip, because a stage outranks a
                  workspace and the sign-in stage hides the strip entirely. */}
              {chrome.stageBar && <StageBar />}
            </Toolbar>
          </Surface>
        )}

        <AcceptBanner />

        {(chrome.workspaces || onToggleFullFrame) && (
          <div className={styles.chrome}>
            {chrome.workspaces && <WorkspaceStrip />}
            <span className={styles.chromeSpacer} />
            {onToggleFullFrame && (
              <span className={styles.chromeAction}>
                <IconButton
                  variant="framed"
                  size="tiny"
                  glyph={fullFrame ? "⤡" : "⤢"}
                  accessibleName={fullFrame ? "leave full frame (Esc)" : "fill the window"}
                  title={
                    fullFrame
                      ? "shrink back into the page — Esc does the same"
                      : "fill the window, for room to work"
                  }
                  onClick={onToggleFullFrame}
                />
              </span>
            )}
          </div>
        )}

        <div className={styles.canvas}>{space && <NodeView node={space.tree} />}</div>

        <MouseDocLine ambient={ambient ? `${counts} · ${ambient}` : counts} />
      </div>
      <ImportDialog />
      {/*
       * Mounted unconditionally and rendering nothing until `layout.launcher` is
       * set. That is what lets a serialisable tile verb open it: the descriptor
       * dispatches, and the shell already has the modal ready to notice.
       */}
      <LauncherDialog root={shellRef} />
      <ExportNotice />
      <ObjectMenu />
    </>
  );
}

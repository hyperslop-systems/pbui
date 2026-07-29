import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useMeQuery } from "../../../api/client";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import { RenderBoundary } from "../../../appkit/RenderBoundary";
import { usePersistence } from "../../../appkit/usePersistence";
import { Button, Callout, Text } from "@hyperslop-systems/pbui";
import type { RootState } from "../../../store";
import { layoutActions } from "../../../store/layout";
import { worldActions } from "../../../store/world";
import { rootSource } from "../../../model/graphicAuthoring";
import { welcomeDemoInstallation } from "../../../demo/welcome";
import {
  ACCOUNT_STAGE_ID,
  SIGNIN_STAGE_ID,
  landingStageFor,
  stageIsVisible,
} from "../../../store/stages";
import { WorkbenchProviders } from "./WorkbenchProviders";
import { WorkbenchShell } from "./WorkbenchShell";
import styles from "./Workbench.module.css";

/**
 * The application.
 *
 * Everything here is a *session* concern rather than a shell concern: who is
 * signed in, where a first sign-in should land, and where this browser's layout
 * is stored. All four used to live inside the shell, and all four had to leave
 * for the landing page to be possible (DATADROP-7 DR-52).
 *
 * The failure modes are the argument. With five instances on a page and this
 * code still in the shell:
 *
 *  - five `GET /v1/me` requests on load, and — worse — five tutorial sections
 *    forcing themselves to the `welcome` workspace for an anonymous visitor,
 *    which is what every landing-page visitor is. Every embedded workbench
 *    would show the sign-in tile.
 *  - five instances racing to consume one `?first=1` query parameter and
 *    rewrite one URL. Exactly one wins; the other four have already jumped to
 *    the account workspace, discarding their seeded layout.
 *
 * There is no equivalent risk in the shell itself, which is now a pure function
 * of the store beneath it. That is the property that makes `WorkbenchInstance`
 * safe.
 *
 * This component requires a `<Provider>` above it; `main.tsx` supplies the one
 * store the product has.
 */
export interface WorkbenchProps {
  /**
   * Where to persist, or null for memory-only.
   *
   * **Defaults to null, and the default is the point** (DR-47). Persistence
   * used to be an unconditional effect in the shell, which is correct while
   * there is one workbench per page and destructive the moment there is not —
   * five embedded instances would each write to one key, so the reader's real
   * layout would be overwritten by whichever tutorial section they last
   * scrolled past, with no error and no symptom until they next reloaded.
   *
   * Defaulting to null means an embedded instance that forgets to opt out is
   * inert rather than destructive. `main.tsx` opts in, in one place, in a file
   * whose job is to know that it is the application.
   */
  persistKey?: string | null;
}

export function Workbench({ persistKey = null }: WorkbenchProps = {}) {
  const dispatch = useDispatch();
  const { data: me } = useMeQuery();

  /**
   * The signed-out gate (DR-31), as of DATADROP-14.
   *
   * ONE gate, at the application, not a check per tile. A per-tile check is a
   * promise to remember it on every future tile, and that promise is always
   * broken. It is not a security boundary either way — the server denies the
   * data regardless — but it is the difference between a coherent shell and
   * twelve tiles all saying "401".
   *
   * **What changed.** It used to be a single boolean, `lockedOut`, that forced
   * every anonymous visitor onto the sign-in stage. That did two jobs at once —
   * "show them how to sign in" and "show them nothing else" — and DATADROP-14
   * splits them: a stranger lands on `welcome` with a stock dataset and can
   * reach `sign in` from the switcher whenever they choose to.
   *
   * The rule is now "land somewhere legal", stated once, and it covers the
   * sign-OUT direction for free: when `authenticated` goes true → false the
   * current stage may be `work`, which is no longer visible, and the same
   * effect moves them. Written as an arrival rule ("on load, pick a stage") it
   * would not have.
   */
  const authed = me?.authenticated === true;
  const principalKey = me
    ? [
        me.auth_mode,
        me.authenticated ? "authenticated" : "anonymous",
        me.kind,
        me.user?.id ?? "",
        me.token_id ?? "",
        [...me.scopes].sort().join(","),
      ].join(":")
    : "loading";

  /**
   * The gate sets a STAGE, not a workspace (DATADROP-8 DR-59).
   *
   * This is the line that proves the two hardwired workspaces were always
   * stages: an application was forcing a *layout* value, twice, because there
   * was no layer at which "which part of the product am I in" could be said.
   *
   * Three properties, each corresponding to a bug this would otherwise ship:
   *
   *  1. **`if (!me) return`.** While `GET /v1/me` is in flight `me` is
   *     undefined and `authed` is therefore false. Without this guard every
   *     load flashes the anonymous layout before correcting itself, and a
   *     signed-in user watches their workspace appear, vanish and reappear.
   *  2. **Membership is checked before anything is written.** `stages` is a new
   *     array identity on any layout change, so an unconditional dispatch here
   *     would fire far more often than the state actually changes. Check first,
   *     write second.
   *  3. **It is an invariant, not an arrival rule.** "The current stage must be
   *     one I may see" is also true on the way out, which is what makes
   *     signing out move you off `work` with no separate handling.
   */
  const stages = useSelector((state: RootState) => state.layout.stages);
  const currentStageId = useSelector((state: RootState) => state.layout.currentStageId);

  useEffect(() => {
    if (!me) return;
    const current = stages.find((stage) => stage.id === currentStageId);
    if (current && stageIsVisible(current, authed)) return;
    dispatch(layoutActions.setCurrentStage(landingStageFor(authed)));
  }, [me, authed, stages, currentStageId, dispatch]);

  /**
   * A failed sign-in returns to the sign-in stage, whatever the rule above says.
   *
   * The callback lands at `/ui/?auth_error=…`, and someone who has just been
   * refused by the identity provider is unambiguously trying to sign in — so
   * this overrides "land somewhere legal", which would otherwise put them on
   * `welcome` where the message they need is not rendered.
   *
   * It only reads the parameter. `SignInApp` is what strips it, because it is
   * what displays it, and two consumers racing to consume and rewrite one query
   * parameter is the failure documented at the top of this file (DR-96).
   */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("auth_error")) return;
    dispatch(layoutActions.setCurrentStage(SIGNIN_STAGE_ID));
  }, [dispatch]);

  /**
   * A first sign-in lands in the account stage rather than wherever this
   * browser was last, because a new user has nothing to go back to.
   *
   * **This is the ONE consumer of `?first=1`** (DATADROP-14 DR-96). The sign-up
   * tile wants the same signal for its welcome state and reads
   * `layout.justSignedUp` instead: two components racing to consume and rewrite
   * one query parameter means exactly one wins, and the loser has already acted
   * on a value that is then erased — the failure this file documents at length
   * for the multi-instance case.
   *
   * The flag is true exactly once, so it is read and stripped rather than
   * stored, and `justSignedUp` is excluded from `save()`'s enumeration for the
   * same reason.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("first") !== "1") return;
    dispatch(layoutActions.setJustSignedUp(true));
    dispatch(layoutActions.setCurrentStage(ACCOUNT_STAGE_ID));
    params.delete("first");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
  }, [dispatch]);

  /**
   * Point the visitor's document at the public dataset, once, on arrival.
   *
   * ## The defect this fixes
   *
   * DATADROP-14 seeds a `public_read` welcome drop so that a stranger sees the
   * product working on real data. `SourceApp`'s browser correctly selected it —
   * `welcome (public)` / `census`, with a source chip — and the chart and table
   * beside it both said **"no source — load one from the sources tile"**,
   * because selecting a drop in the BROWSER does not point the chart DOCUMENT
   * at anything. `makeStore` creates the active document with an empty source
   * (`{ kind: "stream", drop: "" }`), and only clicking the chip re-points it.
   *
   * So the promise — see the product work before being asked for anything —
   * was delivered as an empty chart next to a populated file picker. Found in
   * review; I had seen it and mistaken it for the intended interaction.
   *
   * ## Why the rules are as narrow as they are
   *
   *  - **Anonymous only.** A signed-in user has their own drops, and pointing
   *    them at demo data would be worse than an empty document.
   *  - **Only when the document has no source.** `drop === ""` is the empty
   *    state `newDoc(null)` produces; a restored layout with real work in it
   *    must never be overwritten.
   *  - **Once per mount**, guarded by a ref. Without it, pressing ＋ for a new
   *    document would have it silently filled with the demo dataset a frame
   *    later, which is obnoxious and very hard to attribute.
   *  - **Here, not in `SourceApp`.** This is a session concern — what a
   *    first-time visitor should be looking at — and `Workbench` is where those
   *    live (DR-52). In `SourceApp` it would run once per embedded tour panel.
   */
  const claimed = useRef(false);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);
  const activeSourceDrop = useSelector((state: RootState) => {
    const doc = state.world.activeDocId ? state.world.docs[state.world.activeDocId] : undefined;
    return doc ? (rootSource(doc)?.drop ?? "") : "";
  });

  /**
   * Install the finished public demo documents once the server has advertised
   * their immutable dataset versions.
   *
   * The pinned welcome layouts bind directly to these ids. They are versioned
   * ids rather than ambient UUIDs: a future authored-demo revision can mint v2
   * without mutating a user's persisted document under an old meaning.
   */
  const demosClaimed = useRef(false);
  useEffect(() => {
    if (demosClaimed.current || !me?.welcome) return;
    const { documents, activateDocId } = welcomeDemoInstallation(
      me.welcome,
      authed,
      activeDocId,
      activeSourceDrop,
    );
    if (Object.keys(documents).length === 0) return;
    demosClaimed.current = true;
    dispatch(worldActions.addDocs(documents));
    if (activateDocId) dispatch(worldActions.setActiveDoc(activateDocId));
  }, [me, authed, activeDocId, activeSourceDrop, dispatch]);

  useEffect(() => {
    if (claimed.current) return;
    if (!me || authed) return;
    const welcome = me.welcome;
    if (!welcome?.dataset || !welcome.version || !welcome.path) return;
    if (!activeDocId || activeSourceDrop !== "") return;

    claimed.current = true;
    dispatch(
      worldActions.setDocSource({
        docId: activeDocId,
        source: {
          kind: "dataset",
          drop: welcome.drop,
          dataset: welcome.dataset,
          version: welcome.version,
          path: welcome.path,
        },
      }),
    );
  }, [me, authed, activeDocId, activeSourceDrop, dispatch]);

  usePersistence(persistKey);

  return (
    <RenderBoundary
      resetKey={principalKey}
      fallback={(error, reset) => <WorkbenchFailure error={error} reset={reset} />}
    >
      <div className={styles.app}>
        {/*
          No instance scope, and its absence is the point.

          Sign-in is a product stage, not a special render tree. On the sign-in
          stage the shell hides the picker entirely; on every other stage the
          picker derives its entries from the stage definition. A single provider
          tree keeps the URL, picker, and canvas on the same routing source of
          truth and avoids a second hidden allow-list.
        */}
        <AnalysisProvider principalKey={principalKey}>
          <WorkbenchProviders>
            {/* No chrome props: the stage decides. */}
            <WorkbenchShell />
          </WorkbenchProviders>
        </AnalysisProvider>
      </div>
    </RenderBoundary>
  );
}

export function WorkbenchFailure({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.app} role="alert">
      <Callout variant="warning" title="The workbench could not render">
        <Text size="small" prose>
          {error.message}
        </Text>
        <div style={{ marginTop: "var(--pbui-space-3)" }}>
          <Button onClick={reset}>Try the workbench again</Button>
        </div>
      </Callout>
    </div>
  );
}

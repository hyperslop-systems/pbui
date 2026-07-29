import { useDispatch, useSelector } from "react-redux";
import { useMeQuery } from "../../api/client";
import { registerApp, type AppProps } from "../../appkit/registry";
import { SignUpPanel } from "../../components/organisms";
import type { RootState } from "../../store";
import { layoutActions } from "../../store/layout";
import { ACCOUNT_STAGE_ID } from "../../store/stages";

/**
 * The way in for someone new — the container half.
 *
 * Everything visible is `SignUpPanel`; this holds the query, the store read and
 * the one action. The split is the codebase's rule — the container keeps the
 * hooks and the fetches, the panel takes data and callbacks — and it is what
 * makes the panel's four states reachable from a story.
 *
 * ## It does not read `?first=1`
 *
 * `Workbench` reads and strips that parameter and records the fact in the
 * store; this reads the store (DATADROP-14 DR-96). Two components racing to
 * consume and rewrite one query parameter means exactly one wins, and the loser
 * has already acted on a value that is then erased — the failure `Workbench.tsx`
 * documents at length for the multi-instance case.
 */
function SignUpApp(_props: AppProps) {
  const dispatch = useDispatch();
  const { data: me } = useMeQuery();
  const justSignedUp = useSelector((state: RootState) => state.layout.justSignedUp === true);

  return (
    <SignUpPanel
      signupEnabled={me?.signup_enabled ?? false}
      issuer={me?.provider?.issuer ?? null}
      returnPath={returnPath()}
      justSignedUp={justSignedUp}
      name={me?.user?.name ?? null}
      onOpenAccount={() => dispatch(layoutActions.setCurrentStage(ACCOUNT_STAGE_ID))}
    />
  );
}

/** Where to come back to. Same-origin path only; the server re-validates. */
function returnPath(): string {
  return window.location.pathname + window.location.search;
}

registerApp({
  id: "signup",
  title: "sign up",
  // The phase colour for "come in". The one place a tile takes a brand colour,
  // and it is the tile whose whole job is to teach the phase vocabulary.
  tone: "var(--brand-import)",
  docBound: false,
  // Not duplicable: a second invitation is an identical invitation, and the
  // rule in registry.ts asks for the reason to be written down rather than
  // inferred from `docBound`.
  duplicable: false,
  // A pure function of `me` and one boolean, so a second one renders identical
  // pixels forever.
  singleton: true,
  Component: SignUpApp,
});

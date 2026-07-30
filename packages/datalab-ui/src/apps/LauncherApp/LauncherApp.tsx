import { registerApp, type AppProps } from "../../appkit/registry";
import { ViewSwitcher } from "../../components/organisms";

/**
 * What an empty tile shows: a button per application.
 *
 * `useAvailableApps`, not `useScopedApps`. The launcher used the instance-only
 * scope, so on the sign-in stage it offered every registered application while
 * Replace beside it offered three — a pre-existing inconsistency that
 * DR-95 made visible by making both of them filter (DATADROP-14).
 *
 * ## The count is the other half of DR-95's mitigation
 *
 * DR-95 accepted a real loss when the tile picker started hiding unavailable
 * applications rather than greying them: a user on the welcome stage who has
 * read about the token manager looks for it, does not find it, and has no way
 * to learn it exists on the account stage. Greying at least showed the rule.
 *
 * It was accepted on the strength of two mitigations — the stage bar naming the
 * alternatives, and this line. So this is not a nicety: without it the decision
 * was made on a promise that was only half kept, and the argument for hiding
 * gets weaker rather than the interface getting better.
 *
 * It says the count rather than naming what is missing, deliberately. Listing
 * the excluded applications here would reconstruct exactly the greyed list DR-95
 * removed, one tile over. A number tells the reader that a boundary exists and
 * where to go about it; the stage bar is where they act on it.
 */
function LauncherApp({ placementId }: AppProps) {
  return <ViewSwitcher placementId={placementId} mode="launcher" />;
}

registerApp({
  id: "launcher",
  title: "new tile",
  tone: "var(--pbui-pane-alt)",
  docBound: false,
  duplicable: false,
  singleton: false,
  Component: LauncherApp,
});

import { useDispatch, useSelector } from "react-redux";
import { allApps, registerApp, type AppProps } from "../../appkit/registry";
import { useAvailableApps } from "../../appkit/AppScope";
import type { RootState } from "../../store";
import { layoutActions } from "../../store/layout";
import { AppBody, Stack, Text, Button } from "@hyperslop-systems/pbui";

/**
 * What an empty tile shows: a button per application.
 *
 * `useAvailableApps`, not `useScopedApps`. The launcher used the instance-only
 * scope, so on the sign-in stage it offered every registered application while
 * the tile dropdown beside it offered three — a pre-existing inconsistency that
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
function LauncherApp({ leafId }: AppProps) {
  const dispatch = useDispatch();
  const apps = useAvailableApps();
  const stageName = useSelector(
    (state: RootState) =>
      state.layout.stages.find((stage) => stage.id === state.layout.currentStageId)?.name ?? null,
  );

  // `launcher` is filtered from the buttons — swapping an empty tile for an
  // empty tile is not a choice — so it is excluded from both counts, or the
  // arithmetic in the sentence below does not add up on screen.
  const offered = apps.filter((app) => app.id !== "launcher");
  const registered = allApps().filter((app) => app.id !== "launcher");
  const hidden = registered.length - offered.length;

  return (
    <AppBody>
      <Stack gap={3}>
        <Text size="small" tone="faint" prose>
          Empty tile — choose an application. Chart, table, pipeline and encoding bind to a chart
          DOCUMENT and can be re-pointed; the rest are shared views over the world.
        </Text>

        <Stack direction="row" gap={2} wrap>
          {offered.map((app) => (
            <Button
              key={app.id}
              variant="raised"
              fill={app.tone}
              onClick={() => dispatch(layoutActions.setLeafApp({ nodeId: leafId, app: app.id }))}
            >
              {app.title}
            </Button>
          ))}
        </Stack>

        {hidden > 0 && (
          <Text size="tiny" tone="faint" prose>
            {stageName ? (
              <>
                The <strong>{stageName}</strong> stage offers {offered.length} of{" "}
                {registered.length} applications.
              </>
            ) : (
              <>
                This stage offers {offered.length} of {registered.length} applications.
              </>
            )}{" "}
            The other {hidden} are on other stages — switch with the control at the top right.
          </Text>
        )}
      </Stack>
    </AppBody>
  );
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

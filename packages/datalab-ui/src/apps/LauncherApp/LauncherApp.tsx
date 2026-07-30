import { useDispatch } from "react-redux";
import { Button, Stack, Text } from "@hyperslop-systems/pbui";
import { registerApp, type AppProps } from "../../appkit/registry";
import { useAvailableApps } from "../../appkit/AppScope";
import { layoutActions } from "../../store/layout";
import styles from "./LauncherApp.module.css";

/**
 * What an empty tile shows: a way into the launcher, not the launcher itself.
 *
 * It used to render the complete view grid inline. That was the only search
 * surface the product had, and it inherited every problem of living inside a
 * rectangle the user chose for something else: in a narrow tile the grid
 * reflowed to one column, in a short one it scrolled, and result geometry
 * changed with every split. DATALAB-VIEW-001 moves the list into a modal, so
 * this becomes an empty state whose whole job is to open it.
 *
 * ## The quick-create buttons come from the registry
 *
 * Three creatable applications, taken in registration order rather than named
 * here. A hard-coded list would be a second place to remember when an
 * application is added, and it would silently offer something a tour panel's
 * instance scope forbids — `useAvailableApps` is already the answer to "what
 * may this workbench offer, here".
 *
 * They prefill the query rather than creating directly, so the modal is still
 * where creation happens and there is one path to reason about.
 */
function LauncherApp({ placementId }: AppProps) {
  const dispatch = useDispatch();
  const apps = useAvailableApps();
  const quick = apps.filter((app) => app.id !== "launcher").slice(0, 3);

  const open = () => dispatch(layoutActions.openLauncher({ kind: "fill-launcher", placementId }));

  return (
    <div className={styles.root}>
      <Stack gap={3}>
        <Text size="small" tone="faint">
          OPEN A VIEW
        </Text>

        <Button variant="raised" onClick={open}>
          Search views…
        </Button>

        {quick.length > 0 && (
          <div className={styles.quick}>
            {quick.map((app) => (
              <Button key={app.id} fill={app.tone} onClick={open}>
                + {app.title}
              </Button>
            ))}
          </div>
        )}

        <Text size="tiny" tone="faint" prose>
          Search existing views, or type <strong>+</strong> for a new one and <strong>ws2</strong>{" "}
          to look in one workspace.
        </Text>
      </Stack>
    </div>
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

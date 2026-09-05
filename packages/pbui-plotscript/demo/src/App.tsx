import { Button, Text } from "@hyperslop-systems/pbui";
import { AppShell } from "@hyperslop-systems/pbui-workbench";
import { useMemo } from "react";
import { STORAGE_KEY, createDemoWorkbench } from "./workbench";

export function App() {
  const { workbench, host, restored } = useMemo(createDemoWorkbench, []);
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clear
    }
    // The document AND the host: drafts and runner state are keyed by the
    // same example ids, and without clearing them the remounted tiles keep
    // showing the edited scripts (review finding P2 on PR #22).
    workbench.reset();
    host.drafts.clear();
    void host.runner.disposeAll();
  };
  return (
    <AppShell
      wordmark="Scripted plots"
      tagline={restored ? "restored from this browser" : "seeded"}
      mastheadActions={
        <Button size="tiny" variant="framed" onClick={reset}>
          reset to the examples
        </Button>
      }
      strip={<workbench.WorkspaceStrip addLabel="workspace" />}
      stripActions={
        <Text size="tiny" tone="faint">
          Mod+K opens the launcher · Mod+Enter runs a script
        </Text>
      }
    >
      <workbench.Surface />
      <workbench.Launcher />
      <workbench.Rebalance />
    </AppShell>
  );
}

import { Button, Text } from "@hyperslop-systems/pbui";
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
    <div className="shell">
      <div className="strip">
        <Text size="small" strong>
          scripted plots
        </Text>
        <workbench.WorkspaceStrip addLabel="new workspace" />
        <span className="spacer" />
        <Text size="tiny" tone="faint">
          {restored ? "restored from this browser" : "seeded"} · Mod+K opens the launcher · Mod+Enter runs a script
        </Text>
        <Button size="tiny" variant="bare" onClick={reset}>
          reset to the examples
        </Button>
      </div>
      <workbench.Surface />
      <workbench.Launcher />
      <workbench.Rebalance />
    </div>
  );
}

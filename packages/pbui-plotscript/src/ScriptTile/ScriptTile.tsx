import { AppBody, Button, Callout, Chip, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import { CodeEditor } from "@hyperslop-systems/pbui-editor";
import { byteLength, describeScriptResultProblem } from "@hyperslop-systems/pbui-sandbox";
import { useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import { useEffect, useState } from "react";
import { readPlotScript } from "../document";
import { useDraft } from "../draftStore";
import { PLOT_BINDING, type PlotScriptHost } from "../host";
import { useScriptRun, type ScriptRunState } from "../runner";
import styles from "./ScriptTile.module.css";

export interface ScriptTileProps extends AppProps {
  host: PlotScriptHost;
}

const STATUS_LABEL: Record<ScriptRunState["status"], string> = {
  idle: "not run",
  running: "running…",
  ok: "ok",
  invalid: "invalid result",
  error: "error",
};

/**
 * The editor tile: a `CodeEditor` over the script's draft, a run/auto
 * toolbar, and a pane for what the last run said.
 *
 * The document is written only when a run succeeds, with the source that
 * succeeded, so `PlotScriptDoc.source` is always "what the plot shows" and a
 * reload draws the last good plot rather than a half-typed line.
 */
export function ScriptTile({ view, host }: ScriptTileProps) {
  const workbench = useWorkbench();
  const id = view.documents[PLOT_BINDING] ?? "";
  const doc = workbench.useDocument();
  const script = id ? readPlotScript(doc, id) : null;
  const draft = useDraft(host.drafts, id);
  const run = useScriptRun(host.runner, id);
  const [auto, setAuto] = useState(true);

  // Seed the draft from the document on first sight, and run once so a
  // freshly opened tile shows its plot without a keystroke. `run.status` is
  // a dependency so a host reset (drafts cleared, runner disposed to idle)
  // seeds and runs again from the restored document; the guards make every
  // other status change a no-op. Persisting a successful run into the
  // document is NOT this tile's job — see connectPlotScriptDocuments.
  useEffect(() => {
    if (!script) return;
    host.drafts.seed(script.id, script.source);
    if (run.status === "idle" && host.runner.getState(script.id).status === "idle") {
      void host.runner.run(script.id, script.source);
    }
    // The document's source only matters at seed time; later runs come from the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id, run.status]);

  if (!id) return <EmptyState message="this tile names no script" hint={`bind it: view.documents.${PLOT_BINDING}`} />;
  if (!script) return <EmptyState message={`no script "${id}" in this workbench`} hint="open one from the launcher, or seed the document" />;

  const source = draft ?? script.source;
  const bytes = byteLength(source);
  const tone = run.status === "error" || run.status === "invalid" ? "var(--pbui-danger)" : run.status === "ok" ? "var(--pbui-ok)" : "var(--pbui-tone-neutral)";

  const onChange = (next: string) => {
    host.drafts.set(script.id, next);
    if (auto) host.runner.schedule(script.id, next);
  };
  const runNow = () => void host.runner.run(script.id, host.drafts.get(script.id) ?? source);

  return (
    <div data-part="plot-script" className={styles.app}>
      <Toolbar tight>
        <Button size="tiny" variant="raised" onClick={runNow} title="Mod+Enter">
          run
        </Button>
        <Button size="tiny" variant="bare" selected={auto} aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
          auto
        </Button>
        <Chip label={STATUS_LABEL[run.status]} tone={tone} state={run.status === "running" ? "active" : undefined} />
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {run.ms !== null ? `${Math.round(run.ms)} ms · ` : ""}
          {bytes} bytes · {source.split("\n").length} lines
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <div className={styles.editor}>
          <CodeEditor value={source} onValueChange={onChange} onRun={runNow} accessibleName={`script ${script.name}`} language="javascript" />
        </div>
        <RunPane run={run} />
      </AppBody>
    </div>
  );
}

function RunPane({ run }: { run: ScriptRunState }) {
  const message = run.status === "error" ? run.error?.message : run.status === "invalid" && run.problem ? describeScriptResultProblem(run.problem) : null;
  if (!message && run.logs.length === 0) return null;
  return (
    <div data-part="plot-script-output" className={styles.output} aria-live="polite">
      {message ? (
        <Callout variant="danger" title={run.status === "invalid" ? "the script returned something the plot cannot draw" : "the script threw"}>
          <Text size="tiny" className={styles.message}>
            {message}
          </Text>
        </Callout>
      ) : null}
      {run.logs.map((log, index) => (
        <Text key={index} size="tiny" tone={log.level === "error" || log.level === "warn" ? "danger" : "faint"} className={styles.log}>
          {log.level === "log" ? "" : `${log.level}: `}
          {log.text}
        </Text>
      ))}
    </div>
  );
}

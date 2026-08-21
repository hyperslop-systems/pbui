import { Button, CheckboxRow, Chip, EmptyState, JsonBlock, SelectInput, Text, TextArea, Toolbar } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SANDBOX_UI_KINDS, type DispatchIntent, type UINode } from "../../contracts";
import type { SandboxHost } from "../../host/hostOptions";
import { reducePluginIntent } from "../../host/useProgramInstance";
import { useInstances, type InstanceSnapshot } from "../../instances";
import { UINodeRenderer } from "../../render/UINodeRenderer";
import { countNodes } from "../../validate/uiSchema";
import styles from "./ReplTile.module.css";

export interface ReplTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
}

export interface ReplLine {
  id: number;
  code: string;
  value?: unknown;
  error?: string;
  durationMs: number;
}

const HISTORY_KEEP = 50;

export const REPL_HELP = [
  "$plugin — the definePlugin result, live (patch it, then re-render)",
  "$ui — the ui.* helpers",
  "$state / $global — this instance's state and globalState",
  "$render(state?, global?, widget?) — the tree the program would build",
  "$event(handler, args?, state?, global?, widget?) — the intents a handler would emit",
  "Enter runs · Shift+Enter newline · ↑/↓ history · let/const do not persist; use $plugin.scratch = …",
];

export function isUINode(value: unknown): value is UINode {
  return typeof value === "object" && value !== null && (SANDBOX_UI_KINDS as readonly string[]).includes((value as { kind?: unknown }).kind as string);
}

export function isIntentList(value: unknown): value is DispatchIntent[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === "object" && (item.scope === "plugin" || item.scope === "verb"));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !("$type" in value);
}

/** One line for the timeline: what the value was, in a few words. */
export function summariseValue(value: unknown): string {
  if (isUINode(value)) return `UINode ${value.kind} (${countNodes(value)} nodes)`;
  if (isIntentList(value)) return `${value.length} intent${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object" && "$type" in value) {
    const marker = value as { $type: string; $text?: string; name?: string; message?: string };
    if (marker.$type === "error") return `${marker.name}: ${marker.message}`;
    return marker.$text ? `${marker.$type} ${marker.$text}` : marker.$type;
  }
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** Running instances a REPL can target: anything loaded, the playground's draft included. */
function targets(all: InstanceSnapshot[]): InstanceSnapshot[] {
  return all.filter((s) => s.programId !== null && s.status !== "idle" && s.status !== "loading");
}

/**
 * A REPL into the selected sandbox (guide §4.5). Every line goes through
 * `engine.evaluate`, which the bootstrap implements with a direct eval, so
 * the line sees the live `$plugin`, the helpers and the program's own
 * top-level names — the same under both engines.
 */
export function ReplTile({ host }: ReplTileProps) {
  const all = useInstances(host.instances, (r) => r.all());
  const selected = useInstances(host.instances, (r) => r.selectedViewId());
  const running = useMemo(() => targets(all), [all]);
  const [follow, setFollow] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const target = (follow ? running.find((s) => s.viewId === selected) : undefined) ?? running.find((s) => s.viewId === chosen) ?? running[running.length - 1] ?? null;
  const targetId = target?.viewId ?? "";
  const titleOf = useCallback(
    (s: InstanceSnapshot) => host.library.getState().programs[s.programId ?? ""]?.title ?? s.programId ?? "?",
    [host.library],
  );

  const [code, setCode] = useState("");
  const [lines, setLines] = useState<ReplLine[]>([]);
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<string[]>([]);
  const cursorRef = useRef<number>(-1);
  const nextId = useRef(1);

  const run = useCallback(async () => {
    const text = code.trim();
    if (!text || !target || !target.instanceId) return;
    const { instanceId, programId, version, viewId } = target;
    historyRef.current = [...historyRef.current.filter((h) => h !== text), text].slice(-HISTORY_KEEP);
    cursorRef.current = -1;
    setCode("");
    setBusy(true);
    const started = performance.now();
    const id = nextId.current++;
    let line: ReplLine;
    try {
      const { value } = await host.engine.evaluate({ instanceId, code: text, pluginState: host.states.get(viewId) ?? {}, globalState: target.globalState });
      line = { id, code: text, value, durationMs: performance.now() - started };
      host.instances.record({ kind: "evaluate", viewId, programId: programId!, version, instanceId, code: text, durationMs: line.durationMs, ok: true, summary: summariseValue(value) });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      line = { id, code: text, error: message, durationMs: performance.now() - started };
      host.instances.record({ kind: "evaluate", viewId, programId: programId!, version, instanceId, code: text, durationMs: line.durationMs, ok: false, summary: message });
    }
    setLines((current) => [...current, line].slice(-200));
    setBusy(false);
  }, [code, target, host]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void run();
      return;
    }
    const history = historyRef.current;
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && history.length > 0 && (code === "" || cursorRef.current !== -1)) {
      event.preventDefault();
      const position = cursorRef.current === -1 ? history.length : cursorRef.current;
      const next = event.key === "ArrowUp" ? Math.max(0, position - 1) : Math.min(history.length, position + 1);
      cursorRef.current = next === history.length ? -1 : next;
      setCode(next === history.length ? "" : history[next]!);
    }
  };

  const applyIntents = async (intents: DispatchIntent[]) => {
    if (!target || !target.programId) return;
    const { viewId, programId, version, instanceId } = target;
    for (const intent of intents) {
      if (intent.scope === "plugin") {
        const { next, applied } = reducePluginIntent(host.states.get(viewId), intent);
        if (applied) host.states.set(viewId, next);
        host.instances.record({ kind: "intent", viewId, programId, version, instanceId, intent, outcome: applied ? "applied" : "ignored", detail: "from the REPL" });
      } else {
        const outcome = await host.perform(intent.verb, { provenance: { programId } });
        host.instances.record({ kind: "intent", viewId, programId, version, instanceId, intent, outcome: outcome === "performed" ? "performed" : "rejected", detail: `from the REPL${outcome === "performed" ? "" : `: ${outcome}`}` });
      }
    }
  };

  return (
    <div data-part="sandbox-repl" className={styles.app}>
      <Toolbar tight className={styles.header}>
        {running.length > 0 ? (
          <SelectInput
            size="tiny"
            variant="framed"
            value={targetId}
            options={running.map((s) => ({ value: s.viewId, label: `${titleOf(s)} · v${s.version} · ${s.viewId}` }))}
            accessibleName="which instance the REPL targets"
            onValueChange={(next) => {
              setChosen(next);
              setFollow(false);
              host.instances.select(next);
            }}
          />
        ) : null}
        <CheckboxRow size="tiny" label="follow selection" checked={follow} onCheckedChange={setFollow} />
        <span className={styles.spacer} />
        {target ? <Chip label={target.status} state={target.status === "error" ? "stale" : undefined} /> : null}
        <Button size="tiny" variant="framed" disabled={!target?.handle} onClick={() => target?.handle?.rerender()} title="render the program again, e.g. after patching $plugin">
          re-render
        </Button>
        <Button size="tiny" variant="bare" disabled={lines.length === 0} onClick={() => setLines([])}>
          clear
        </Button>
      </Toolbar>

      {!target ? (
        <EmptyState message="no program is running" hint="open a program tile; the REPL follows the tile you click" />
      ) : lines.length === 0 ? (
        <div className={styles.help} data-part="repl-help">
          <Text size="tiny" tone="faint">
            evaluating inside {titleOf(target)} ({target.instanceId})
          </Text>
          {REPL_HELP.map((line) => (
            <Text key={line} size="tiny" tone="faint">
              {line}
            </Text>
          ))}
        </div>
      ) : (
        <ol className={styles.log} aria-label="REPL results">
          {lines.map((line) => (
            <ResultLine key={line.id} line={line} host={host} onSetState={(value) => target && host.states.set(target.viewId, value)} onApplyIntents={applyIntents} />
          ))}
        </ol>
      )}

      <div className={styles.input}>
        <TextArea
          code
          rows={3}
          value={code}
          onValueChange={(next) => {
            setCode(next);
            if (next === "") cursorRef.current = -1;
          }}
          onKeyDown={onKeyDown}
          accessibleName="REPL input"
          placeholder={target ? "$state" : "open a program first"}
          disabled={!target || busy}
        />
        <Toolbar tight>
          <span className={styles.spacer} />
          <Button size="tiny" variant="raised" onClick={() => void run()} disabled={!target || busy || code.trim() === ""}>
            run
          </Button>
        </Toolbar>
      </div>
    </div>
  );
}

function ResultLine({ line, host, onSetState, onApplyIntents }: { line: ReplLine; host: SandboxHost; onSetState(value: unknown): void; onApplyIntents(intents: DispatchIntent[]): void }) {
  const [rendered, setRendered] = useState(false);
  const value = line.value;
  const tree = isUINode(value);
  const intents = isIntentList(value);
  return (
    <li className={styles.line} data-part="repl-line" data-ok={line.error ? "false" : "true"}>
      <Text size="tiny" tone="faint" className={styles.echo}>
        › {line.code}
      </Text>
      {line.error ? (
        <Text size="tiny" tone="danger" className={styles.mono}>
          {line.error}
        </Text>
      ) : tree && rendered ? (
        <UINodeRenderer tree={value} onEvent={() => {}} renderReference={host.renderReference} accessiblePrefix="repl" />
      ) : (
        <JsonBlock value={value ?? null} maxHeight={240} />
      )}
      <Toolbar tight className={styles.actions}>
        <Text size="micro" tone="faint">
          {line.durationMs.toFixed(1)} ms
        </Text>
        {tree ? (
          <Button size="tiny" variant="bare" onClick={() => setRendered((r) => !r)}>
            {rendered ? "show json" : "render here"}
          </Button>
        ) : null}
        {isPlainObject(value) && !tree ? (
          <Button size="tiny" variant="bare" onClick={() => onSetState(value)}>
            set as state
          </Button>
        ) : null}
        {intents ? (
          <Button size="tiny" variant="bare" onClick={() => onApplyIntents(value)}>
            apply intents
          </Button>
        ) : null}
      </Toolbar>
    </li>
  );
}

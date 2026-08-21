import { Button, Callout, Chip, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, useState, type ReactNode } from "react";
import type { ProgramErrorPayload, UIReference, VerbLike } from "../contracts";
import type { ProgramEngine } from "../engine";
import { useLibrary, type ProgramLibrary, type ProgramRecord } from "../library";
import { useProgramInstance } from "../host/useProgramInstance";
import { UINodeRenderer } from "../render/UINodeRenderer";
import type { ProgramStateStore } from "../state";
import styles from "./ScriptTile.module.css";

/** The binding key: `view.documents.program` names the program this tile runs. */
export const PROGRAM_BINDING = "program";

export interface ScriptTileOptions {
  library: ProgramLibrary;
  engine: ProgramEngine;
  states: ProgramStateStore;
  /** Resolve one of the view's OTHER bindings (`product: "2049"`) into a reference; null when it cannot. */
  resolve(key: string, id: string): UIReference | null;
  /** A hook: the product's descriptor environment, read live so `canApprove` flips re-render programs. */
  useEnv(): Record<string, unknown>;
  /** Perform a verb a program emitted; the product routes it with `actor: "human"` and the provenance. */
  perform(verb: VerbLike, options: { provenance: { programId: string } }): Promise<string>;
  /** The product's `<Presentation>` for a `ref` node. */
  renderReference(reference: UIReference, label: string): ReactNode;
  /** Offered on an error: how to hand the failure to the agent. Omit for no button. */
  askToFix?(program: ProgramRecord, error: ProgramErrorPayload): void;
}

export interface ScriptTileProps {
  placementId: string;
  view: AppView;
  options: ScriptTileOptions;
}

/**
 * One program as a tile: the header says what it is and who wrote it, the
 * body is the program's widgets rendered with pbui atoms, a disclosure shows
 * the instance log, and an error shows the message with a way to hand it to
 * the agent — an error is a tile too.
 */
export function ScriptTile({ placementId, view, options }: ScriptTileProps) {
  const programId = view.documents[PROGRAM_BINDING] ?? "";
  const program = useLibrary(options.library, (state) => (programId ? (state.programs[programId] ?? null) : null));
  const env = options.useEnv();
  const [showLog, setShowLog] = useState(false);

  const bindingsKey = JSON.stringify(view.documents);
  const documents = useMemo(() => {
    const out: Record<string, UIReference | null> = {};
    for (const [key, id] of Object.entries(view.documents)) {
      if (key === PROGRAM_BINDING) continue;
      out[key] = options.resolve(key, id);
    }
    return out;
    // view.documents is a fresh map per document; its serialisation is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingsKey, options.resolve]);

  const instance = useProgramInstance({
    engine: options.engine,
    program,
    viewId: view.id,
    placementId,
    states: options.states,
    documents,
    env,
    perform: options.perform,
    onError: (error) => {
      if (program) options.library.recordError(program.id, { phase: error.phase ?? "render", message: error.message, at: new Date().toISOString() });
    },
  });

  if (!programId) {
    return (
      <div className={styles.app}>
        <EmptyState message="this tile names no program" hint="ask the agent to make one, or open one from the launcher" />
      </div>
    );
  }
  if (!program) {
    return (
      <div className={styles.app}>
        <EmptyState message={`program ${programId} is not in the library`} hint="it was removed; close this tile or ask the agent to recreate it" />
      </div>
    );
  }

  return (
    <div data-part="script-app" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <Chip label={`generated · v${program.version} · by ${program.by}`} tone="var(--pbui-tone-widget)" />
        {program.pinned ? <Chip label="pinned" /> : null}
        <span className={styles.spacer} />
        <Button size="tiny" variant="bare" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>
          {showLog ? "hide details" : "details"}
        </Button>
      </Toolbar>

      {instance.error ? (
        <Callout variant="warning" title={`program error (${instance.error.phase ?? "run"}, ${instance.error.code})`}>
          <Text size="tiny" prose>
            {instance.error.message}
          </Text>
          <Toolbar tight>
            <Button size="tiny" variant="framed" onClick={instance.reset}>
              Reset state
            </Button>
            {options.askToFix ? (
              <Button size="tiny" variant="framed" onClick={() => options.askToFix?.(program, instance.error!)}>
                Ask the agent to fix this
              </Button>
            ) : null}
          </Toolbar>
        </Callout>
      ) : null}

      <div className={styles.body}>
        {instance.status === "loading" ? (
          <Text size="tiny" tone="faint">
            loading…
          </Text>
        ) : null}
        {(instance.meta?.widgets ?? []).map((widgetId) => (
          <section key={widgetId} data-part="program-widget" data-widget={widgetId} className={styles.widget}>
            <UINodeRenderer
              tree={instance.trees[widgetId] ?? null}
              onEvent={(ref, payload) => instance.onEvent(widgetId, ref, payload)}
              renderReference={options.renderReference}
              accessiblePrefix={program.title}
            />
          </section>
        ))}
      </div>

      {showLog ? (
        <section data-part="program-log" className={styles.log} aria-label="program log">
          <Text size="micro" tone="faint">
            state resets on reload · engine {options.engine.kind} · {instance.log.length} entries
          </Text>
          {instance.log.length === 0 ? (
            <Text size="micro" tone="faint">
              nothing yet
            </Text>
          ) : (
            instance.log.map((entry, index) => (
              <Text key={index} size="micro" tone={entry.kind === "error" ? "danger" : "default"} className={styles.logLine}>
                {entry.outcome ? `[${entry.outcome}] ` : ""}
                {entry.text}
              </Text>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

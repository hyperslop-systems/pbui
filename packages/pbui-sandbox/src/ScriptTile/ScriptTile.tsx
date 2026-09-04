import { Button, Callout, Chip, EmptyState, Text, TileHeader, Toolbar } from "@hyperslop-systems/pbui";
import { useWorkbench } from "@hyperslop-systems/pbui-workbench";
import { commands } from "@hyperslop-systems/workbench-core";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, useState } from "react";
import type { ProgramErrorPayload, UIReference } from "../contracts";
import type { SandboxHost } from "../host/hostOptions";
import { useProgramInstance } from "../host/useProgramInstance";
import { formatEntry, useInstances, type InstanceRegistry } from "../instances";
import { useLibrary, type ProgramRecord } from "../library";
import { UINodeRenderer } from "../render/UINodeRenderer";
import styles from "./ScriptTile.module.css";

/** The binding key: `view.documents.program` names the program this tile runs. */
export const PROGRAM_BINDING = "program";

/** The devtools' app ids the tile opens; defined here so the tile and the factory agree. */
export const INSPECTOR_APP_ID = "program-inspector";
export const SOURCE_APP_ID = "program-source";

export interface ScriptTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
}

/**
 * One program as a tile: the header says what it is and who wrote it, the
 * body is the program's widgets rendered with pbui atoms, a disclosure shows
 * this instance's slice of the timeline, and an error shows the message with
 * a way to hand it to the agent — an error is a tile too.
 *
 * Focusing or clicking the tile makes it the selected sandbox (guide §4.1),
 * which is what the REPL and the timeline's default filter follow.
 */
export function ScriptTile({ placementId, view, host }: ScriptTileProps) {
  const programId = view.documents[PROGRAM_BINDING] ?? "";
  const program = useLibrary(host.library, (state) => (programId ? (state.programs[programId] ?? null) : null));
  const env = host.useEnv();
  const [showLog, setShowLog] = useState(false);
  const highlight = useInstances(host.instances, (r) => r.get(view.id)?.highlight ?? null);

  const bindingsKey = JSON.stringify(view.documents);
  const documents = useMemo(() => {
    const out: Record<string, UIReference | null> = {};
    for (const [key, id] of Object.entries(view.documents)) {
      if (key === PROGRAM_BINDING) continue;
      out[key] = host.resolve(key, id);
    }
    return out;
    // view.documents is a fresh map per document; its serialisation is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingsKey, host.resolve]);

  const instance = useProgramInstance({
    engine: host.engine,
    program,
    viewId: view.id,
    placementId,
    states: host.states,
    instances: host.instances,
    documents,
    env,
    perform: host.perform,
    onError: (error) => {
      if (program) host.library.recordError(program.id, { phase: error.phase ?? "render", message: error.message, at: new Date().toISOString() });
    },
  });

  const select = () => host.instances.select(view.id);

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
    // A tile has no focus of its own; a focusable container that notices
    // focus inside it (a button, an input) or a click is how "the tile the
    // user is looking at" becomes the selected sandbox.
    <div data-part="script-app" className={styles.app} tabIndex={-1} onFocusCapture={select} onClickCapture={select}>
      <TileHeader
        title={`generated · v${program.version} · by ${program.by}`}
        actions={
          <>
            {host.devtools ? <DevtoolButtons programId={program.id} viewId={view.id} placementId={placementId} /> : null}
            <Button size="tiny" variant="bare" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>
              {showLog ? "hide details" : "details"}
            </Button>
          </>
        }
      >
        {program.pinned ? <Chip label="pinned" /> : null}
      </TileHeader>

      {instance.error ? (
        <Callout variant="danger" title={`program error (${instance.error.phase ?? "run"}, ${instance.error.code})`}>
          <Text size="tiny" prose>
            {instance.error.message}
          </Text>
          <Toolbar tight>
            <Button size="tiny" variant="framed" onClick={instance.reset}>
              Reset state
            </Button>
            {host.askAgent ? (
              <Button size="tiny" variant="framed" onClick={() => askToFix(host, program, instance.error!)}>
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
              renderReference={host.renderReference}
              accessiblePrefix={program.title}
              highlightPath={highlight}
            />
          </section>
        ))}
      </div>

      {showLog ? <ProgramLog instances={host.instances} viewId={view.id} engine={host.engine.kind} /> : null}
    </div>
  );
}

function askToFix(host: SandboxHost, program: ProgramRecord, error: ProgramErrorPayload) {
  host.askAgent?.(`the program {0} failed (${error.phase ?? "run"}): ${error.message}. Please fix it with sandbox_update_app.`, [
    { type: "program", id: program.id, value: { title: program.title } },
  ]);
}

/** Separate so only a tile with its details open subscribes to the (busy) timeline. */
function ProgramLog({ instances, viewId, engine }: { instances: InstanceRegistry; viewId: string; engine: string }) {
  const timeline = useInstances(instances, (r) => r.timeline());
  const entries = timeline.filter((entry) => entry.viewId === viewId);
  return (
    <section data-part="program-log" className={styles.log} aria-label="program log">
      <Text size="micro" tone="faint">
        state resets on reload · engine {engine} · {entries.length} entries
      </Text>
      {entries.length === 0 ? (
        <Text size="micro" tone="faint">
          nothing yet
        </Text>
      ) : (
        entries.map((entry) => (
          <Text key={entry.seq} size="micro" tone={entry.kind === "error" ? "danger" : "default"} className={styles.logLine}>
            {formatEntry(entry)}
          </Text>
        ))
      )}
    </section>
  );
}

/** Needs the workbench context, so it is its own component and only mounts when devtools are registered. */
function DevtoolButtons({ programId, viewId, placementId }: { programId: string; viewId: string; placementId: string }) {
  const workbench = useWorkbench();
  return (
    <>
      <Button size="tiny" variant="bare" onClick={() => workbench.execute(commands.open(INSPECTOR_APP_ID, { program: programId, view: viewId }, { near: placementId }))}>
        inspect
      </Button>
      <Button size="tiny" variant="bare" onClick={() => workbench.execute(commands.open(SOURCE_APP_ID, { program: programId }, { near: placementId }))}>
        source
      </Button>
    </>
  );
}

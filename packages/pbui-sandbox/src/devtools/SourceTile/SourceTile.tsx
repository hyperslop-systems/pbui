import { Button, Chip, Dialog, DiffHunk, EmptyState, SelectInput, Text, Toolbar } from "@hyperslop-systems/pbui";
import { CodeEditor } from "@hyperslop-systems/pbui-editor";
import { useWorkbench } from "@hyperslop-systems/pbui-workbench";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, useState } from "react";
import type { SandboxHost } from "../../host/hostOptions";
import { useInstances } from "../../instances";
import { useLibrary, type ProgramRecord, type ProgramVersion } from "../../library";
import { byteLength } from "../../limits";
import { PROGRAM_BINDING } from "../../ScriptTile";
import { diffLines, trimContext } from "../diffLines";
import type { PlaygroundStore } from "../playgroundStore";
import styles from "./SourceTile.module.css";

export const PLAYGROUND_APP_ID_FOR_SOURCE = "sandbox-playground";

export interface SourceTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
  /** Where *edit in playground* puts the source; omit to hide that button. */
  playground?: PlaygroundStore;
}

type Pane = "source" | "versions" | "diff";
const PANES: Pane[] = ["source", "versions", "diff"];

/** Every version of a program, current first, in one shape. */
export function versionsOf(record: ProgramRecord): ProgramVersion[] {
  return [
    { version: record.version, source: record.source, title: record.title, bindings: record.bindings, meta: record.meta, by: record.by, at: record.updatedAt },
    ...record.history,
  ];
}

/** What *edit in playground* does to the draft: the program's source and binding keys, and where it came from. */
export function seedPlaygroundFrom(store: PlaygroundStore, record: ProgramRecord, version?: ProgramVersion): void {
  const source = version?.source ?? record.source;
  const keys = version?.bindings ?? record.bindings;
  const current = store.get().bindings;
  const bindings: Record<string, string> = {};
  for (const key of keys) bindings[key] = current[key] ?? "";
  store.set({ source, bindings, fromProgramId: record.id });
}

function formatTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleTimeString(undefined, { hour12: false });
}

/**
 * A program's source and its past (guide §4.8): the current source with line
 * numbers, every version the library kept, a diff between any two, and
 * rollback — which is an ordinary update whose source happens to be old.
 */
export function SourceTile({ view, host, playground }: SourceTileProps) {
  const programId = view.documents[PROGRAM_BINDING] ?? "";
  const record = useLibrary(host.library, (state) => (programId ? (state.programs[programId] ?? null) : null));
  const running = useInstances(host.instances, (r) => r.all());
  const [pane, setPane] = useState<Pane>("source");
  const [confirm, setConfirm] = useState<number | null>(null);

  if (!record) {
    return (
      <div className={styles.app}>
        <EmptyState message={programId ? `program ${programId} is not in the library` : "this tile names no program"} hint="open it from a program tile's source button" />
      </div>
    );
  }

  const rollback = (version: number) => {
    const next = host.library.rollback(record.id, version);
    setConfirm(null);
    for (const snapshot of running.filter((s) => s.programId === record.id)) {
      host.instances.record({ kind: "note", viewId: snapshot.viewId, programId: record.id, version: next.version, instanceId: null, text: `rolled back to v${version} (now v${next.version})` });
    }
  };

  return (
    <div data-part="program-source" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <Chip label={`${record.title} · v${record.version} · ${record.by}`} tone="var(--pbui-tone-widget)" />
        {record.pinned ? <Chip label="pinned" /> : null}
        <span className={styles.spacer} />
        {PANES.map((p) => (
          <Button key={p} size="tiny" variant="bare" selected={pane === p} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {p}
          </Button>
        ))}
      </Toolbar>

      {pane === "source" ? (
        <>
          <Toolbar tight>
            <Text size="tiny" tone="faint">
              {byteLength(record.source)} bytes · {record.source.split("\n").length} lines · updated {formatTime(record.updatedAt)}
            </Text>
            <span className={styles.spacer} />
            <Button size="tiny" variant="bare" onClick={() => void navigator.clipboard?.writeText(record.source)}>
              copy
            </Button>
            {playground && host.devtools ? <EditInPlayground record={record} playground={playground} /> : null}
            {host.askAgent ? (
              <Button size="tiny" variant="bare" onClick={() => host.askAgent?.("improve the program {0}: ", [{ type: "program", id: record.id, value: { title: record.title } }])}>
                ask the agent to improve it
              </Button>
            ) : null}
          </Toolbar>
          <SourceListing source={record.source} />
        </>
      ) : null}

      {pane === "versions" ? (
        <ol className={styles.versions} aria-label="versions">
          {versionsOf(record).map((entry, index) => (
            <li key={entry.version} className={styles.version} data-part="program-version" data-version={entry.version}>
              <Text size="tiny" strong>
                v{entry.version}
              </Text>
              <Text size="tiny" tone="faint">
                {index === 0 ? "current · " : ""}
                {entry.by} · {formatTime(entry.at)} · {byteLength(entry.source)} bytes · {entry.title}
              </Text>
              <span className={styles.spacer} />
              {index > 0 ? (
                <Button size="tiny" variant="framed" onClick={() => (record.pinned ? setConfirm(entry.version) : rollback(entry.version))}>
                  roll back to v{entry.version}
                </Button>
              ) : null}
              {playground && host.devtools && index > 0 ? <EditInPlayground record={record} version={entry} playground={playground} /> : null}
            </li>
          ))}
          <Text size="micro" tone="faint">
            history: {record.history.length} version{record.history.length === 1 ? "" : "s"} · {record.history.reduce((n, v) => n + byteLength(v.source), 0)} bytes
          </Text>
        </ol>
      ) : null}

      {pane === "diff" ? <DiffPane record={record} /> : null}

      {confirm !== null ? (
        <Dialog
          title={`Roll back ${record.title} to v${confirm}?`}
          onClose={() => setConfirm(null)}
          footer={
            <Toolbar tight>
              <Button size="small" variant="framed" onClick={() => setConfirm(null)}>
                keep v{record.version}
              </Button>
              <Button size="small" variant="raised" onClick={() => rollback(confirm)}>
                roll back
              </Button>
            </Toolbar>
          }
        >
          <Text size="small" prose>
            This program is pinned. Rolling back writes v{record.version + 1} with the source of v{confirm}; every tile showing it reloads.
          </Text>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * The source, read-only, with real highlighting (PBUI-PLOTKIT-1). This was a
 * hand-built `<pre><ol><li>` with CSS-counter line numbers; the editor draws
 * the gutter itself and keeps the text selectable and searchable.
 */
function SourceListing({ source }: { source: string }) {
  return (
    <div className={styles.code} data-part="source-listing">
      <CodeEditor readOnly language="javascript" value={source} onValueChange={() => {}} accessibleName="program source" />
    </div>
  );
}

function DiffPane({ record }: { record: ProgramRecord }) {
  const versions = versionsOf(record);
  const [base, setBase] = useState(() => String(versions[1]?.version ?? versions[0]!.version));
  const [target, setTarget] = useState(() => String(versions[0]!.version));
  const [full, setFull] = useState(false);
  const hunk = useMemo(() => {
    const from = versions.find((v) => String(v.version) === base) ?? versions[0]!;
    const to = versions.find((v) => String(v.version) === target) ?? versions[0]!;
    const whole = diffLines(from.source, to.source);
    return full ? whole : trimContext(whole, 3);
  }, [versions, base, target, full]);
  const options = versions.map((v) => ({ value: String(v.version), label: `v${v.version} · ${v.by}` }));
  return (
    <>
      <Toolbar tight>
        <SelectInput size="tiny" variant="framed" value={base} options={options} accessibleName="diff base version" onValueChange={setBase} />
        <Text size="tiny" tone="faint">
          →
        </Text>
        <SelectInput size="tiny" variant="framed" value={target} options={options} accessibleName="diff target version" onValueChange={setTarget} />
        <span data-part="diff-summary">
          <Text size="tiny" tone="faint">
            +{hunk.added} −{hunk.removed}
          </Text>
        </span>
        <span className={styles.spacer} />
        <Button size="tiny" variant="bare" selected={full} aria-pressed={full} onClick={() => setFull((f) => !f)}>
          {full ? "changes only" : "whole file"}
        </Button>
      </Toolbar>
      {hunk.rows.length === 0 ? <EmptyState message="no differences" hint="pick two different versions" /> : <DiffHunk hunk={hunk} />}
    </>
  );
}

/** Needs the workbench context; only mounts when devtools are registered. */
function EditInPlayground({ record, version, playground }: { record: ProgramRecord; version?: ProgramVersion; playground: PlaygroundStore }) {
  const workbench = useWorkbench();
  return (
    <Button
      size="tiny"
      variant="bare"
      onClick={() => {
        seedPlaygroundFrom(playground, record, version);
        workbench.verbs.openView(PLAYGROUND_APP_ID_FOR_SOURCE, {});
      }}
    >
      {version ? `edit v${version.version} in playground` : "edit in playground"}
    </Button>
  );
}

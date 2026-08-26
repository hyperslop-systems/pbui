import { Button, Chip, EmptyState, SelectInput, Text, TextArea, Toolbar } from "@hyperslop-systems/pbui";
import { useWorkbench } from "@hyperslop-systems/pbui-workbench";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, useState } from "react";
import type { SandboxHost } from "../../host/hostOptions";
import { formatEntry, useInstances, type TimelineEntry } from "../../instances";
import { useLibrary } from "../../library";
import { DEFAULT_LIMITS } from "../../limits";
import { INSPECTOR_APP_ID } from "../../ScriptTile";
import styles from "./TimelineTile.module.css";

export interface TimelineTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
}

export const TIMELINE_KINDS: TimelineEntry["kind"][] = ["load", "render", "event", "intent", "error", "evaluate", "note"];

/** The `events` argument `sandbox_test` takes, from one instance's event entries, oldest first. */
export function eventsForReplay(entries: readonly TimelineEntry[], viewId: string): { handler: string; args?: unknown }[] {
  return entries
    .filter((entry): entry is Extract<TimelineEntry, { kind: "event" }> => entry.kind === "event" && entry.viewId === viewId)
    .map((entry) => (entry.args === undefined ? { handler: entry.handler } : { handler: entry.handler, args: entry.args }));
}

/** Is this entry's duration past the engine's default limit for its phase? (A product with custom limits sees the defaults here.) */
export function overLimit(entry: TimelineEntry): boolean {
  if (entry.kind === "render") return entry.durationMs > DEFAULT_LIMITS.renderMs;
  if (entry.kind === "event") return entry.durationMs > DEFAULT_LIMITS.eventMs;
  if (entry.kind === "load") return entry.durationMs > DEFAULT_LIMITS.loadMs;
  if (entry.kind === "evaluate") return entry.durationMs > DEFAULT_LIMITS.evaluateMs;
  return false;
}

function formatTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

const ALL = "*";
const SELECTED = "@selected";
const SHOW_AT_MOST = 300;

/**
 * Everything that happened to every instance, newest first (guide §4.6):
 * vm-system's dispatch timeline over the registry's ring, with durations
 * against the limits, filters, a pause, and the one export that matters —
 * an instance's events as the `events` argument of `sandbox_test`.
 */
export function TimelineTile({ host }: TimelineTileProps) {
  const timeline = useInstances(host.instances, (r) => r.timeline());
  const selected = useInstances(host.instances, (r) => r.selectedViewId());
  const programs = useLibrary(host.library, (state) => state.programs);
  const [scope, setScope] = useState<string>(ALL);
  const [kinds, setKinds] = useState<Set<TimelineEntry["kind"]>>(() => new Set(TIMELINE_KINDS));
  const [paused, setPaused] = useState<readonly TimelineEntry[] | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const source = paused ?? timeline;
  const scopeViewId = scope === SELECTED ? selected : scope === ALL ? null : scope;
  const views = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of timeline) if (!seen.has(entry.viewId)) seen.set(entry.viewId, entry.programId);
    return [...seen.entries()].map(([viewId, programId]) => ({ viewId, title: programs[programId]?.title ?? programId }));
  }, [timeline, programs]);
  const rows = useMemo(() => {
    // "selected sandbox" with nothing selected matches nothing, and says so.
    const filtered = source.filter((entry) => kinds.has(entry.kind) && (scope === ALL || entry.viewId === scopeViewId));
    return filtered.slice(-SHOW_AT_MOST).reverse();
  }, [source, kinds, scope, scopeViewId]);

  const toggleKind = (kind: TimelineEntry["kind"]) =>
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const copyEvents = async () => {
    const viewId = scopeViewId ?? rows[0]?.viewId;
    if (!viewId) return;
    const json = JSON.stringify(eventsForReplay(source, viewId), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setExported(null);
      host.instances.record({ kind: "note", viewId, programId: host.instances.get(viewId)?.programId ?? "?", version: host.instances.get(viewId)?.version ?? 0, instanceId: null, text: "events copied as sandbox_test events" });
    } catch {
      // No clipboard (permissions, insecure context): show it to select by hand (guide R14).
      setExported(json);
    }
  };

  return (
    <div data-part="sandbox-timeline" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <SelectInput
          size="tiny"
          variant="framed"
          value={scope}
          accessibleName="which instance's entries to show"
          options={[
            { value: ALL, label: "all instances" },
            { value: SELECTED, label: "selected sandbox" },
            ...views.map((v) => ({ value: v.viewId, label: `${v.title} · ${v.viewId}` })),
          ]}
          onValueChange={setScope}
        />
        <span className={styles.spacer} />
        <Button size="tiny" variant="framed" selected={paused !== null} aria-pressed={paused !== null} onClick={() => setPaused((p) => (p ? null : timeline))}>
          {paused ? "resume" : "pause"}
        </Button>
        <Button size="tiny" variant="bare" onClick={() => void copyEvents()} disabled={rows.length === 0} title="the events of one instance, oldest first, as the `events` argument of sandbox_test">
          copy as events
        </Button>
        <Button size="tiny" variant="bare" onClick={() => host.instances.clearTimeline()} disabled={timeline.length === 0}>
          clear
        </Button>
      </Toolbar>
      <div role="group" aria-label="kinds">
        <Toolbar tight className={styles.kinds}>
          {TIMELINE_KINDS.map((kind) => (
            <Button key={kind} size="tiny" variant="bare" selected={kinds.has(kind)} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>
              {kind}
            </Button>
          ))}
        </Toolbar>
      </div>

      {exported !== null ? (
        <TextArea code rows={6} value={exported} onValueChange={() => {}} accessibleName="events as JSON (the clipboard was not available)" readOnly />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState message={timeline.length === 0 ? "nothing has happened yet" : "nothing matches the filters"} hint={timeline.length === 0 ? "open a program tile and use it" : "widen the kinds or the instance"} />
      ) : (
        <ol className={styles.list} aria-label="dispatch timeline">
          {rows.map((entry) => (
            <Row key={entry.seq} entry={entry} host={host} title={programs[entry.programId]?.title ?? entry.programId} />
          ))}
        </ol>
      )}
      <Text size="micro" tone="faint">
        {rows.length} of {source.length} entries{paused ? " · paused" : ""}
      </Text>
    </div>
  );
}

function Row({ entry, host, title }: { entry: TimelineEntry; host: SandboxHost; title: string }) {
  const snapshot = host.instances.get(entry.viewId);
  const live = snapshot?.handle && snapshot.instanceId === entry.instanceId ? snapshot.handle : null;
  const danger = entry.kind === "error" || (entry.kind === "intent" && (entry.outcome === "rejected" || entry.outcome === "ignored")) || (entry.kind === "evaluate" && !entry.ok) || overLimit(entry);
  return (
    <li className={styles.row} data-part="timeline-row" data-kind={entry.kind} data-seq={entry.seq} data-danger={danger ? "true" : undefined}>
      <Text size="micro" tone="faint" className={styles.time}>
        {formatTime(entry.at)}
      </Text>
      <Chip label={`${title} v${entry.version}`} tone="var(--pbui-tone-widget)" />
      <Text size="tiny" strong className={styles.kind}>
        {entry.kind}
      </Text>
      <Text size="tiny" tone={danger ? "danger" : "default"} className={styles.line}>
        {formatEntry(entry)}
      </Text>
      <span className={styles.actions}>
        {entry.kind === "event" && live ? (
          <Button size="tiny" variant="bare" onClick={() => live.fire(entry.widgetId, { handler: entry.handler }, entry.args)} title="send the same event again">
            fire again
          </Button>
        ) : null}
        {entry.kind === "error" && host.devtools ? <InspectButton programId={entry.programId} viewId={entry.viewId} /> : null}
        {entry.kind === "error" && host.askAgent ? (
          <Button
            size="tiny"
            variant="bare"
            onClick={() =>
              host.askAgent?.(`the program {0} failed (${entry.phase}): ${entry.message}. Please fix it with sandbox_update_app.`, [
                { type: "program", id: entry.programId, value: { title } },
              ])
            }
          >
            ask the agent
          </Button>
        ) : null}
      </span>
      {entry.kind === "event" && entry.intents.length > 0 ? (
        <ul className={styles.intents}>
          {entry.intents.map((intent, index) => (
            <li key={index}>
              <Text size="micro" tone="faint">
                → {intent.scope === "verb" ? `verb ${intent.verb.kind}` : `${intent.actionType} ${JSON.stringify(intent.payload ?? null)}`}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Needs the workbench context; only mounts when devtools are registered. */
function InspectButton({ programId, viewId }: { programId: string; viewId: string }) {
  const workbench = useWorkbench();
  return (
    <Button size="tiny" variant="bare" onClick={() => workbench.verbs.openView(INSPECTOR_APP_ID, { program: programId, view: viewId })}>
      inspect
    </Button>
  );
}

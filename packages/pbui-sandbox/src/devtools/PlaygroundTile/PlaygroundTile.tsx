import { Button, Chip, Dialog, SelectInput, Text, TextArea, TextInput, Toolbar } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UIReference } from "../../contracts";
import type { SandboxHost } from "../../host/hostOptions";
import { useProgramInstance } from "../../host/useProgramInstance";
import { useLibrary, type ProgramRecord } from "../../library";
import { byteLength, DEFAULT_LIMITS } from "../../limits";
import { UINodeRenderer } from "../../render/UINodeRenderer";
import { countNodes } from "../../validate/uiSchema";
import { usePlayground, type PlaygroundStore } from "../playgroundStore";
import styles from "./PlaygroundTile.module.css";

/** The draft runs as this program id and under this view id; the registry lists it like any instance. */
export const DRAFT_PROGRAM_ID = "draft";
export const PLAYGROUND_VIEW_ID = "playground";

export interface PlaygroundTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
  store: PlaygroundStore;
  /** Milliseconds after the last keystroke before the draft reloads; default 400. */
  reloadMs?: number;
}

/**
 * A draft program, run live (guide §4.7, D4): the editor on one side, the
 * bindings and the rendered draft on the other. Every pause in typing is a
 * fresh load (the draft version bumps, so the instance id changes, exactly
 * as a library update reloads a tile); clicks work; the REPL can target it;
 * the timeline shows it. Saving puts it in the library as a human's program.
 */
export function PlaygroundTile({ placementId, host, store, reloadMs = 400 }: PlaygroundTileProps) {
  const draft = usePlayground(store, (d) => d);
  const programs = useLibrary(host.library, (state) => state.programs);
  const env = host.useEnv();

  // The instance reloads from `loaded`, which follows `draft.source` after a pause.
  const [loaded, setLoaded] = useState(draft.source);
  const [draftVersion, setDraftVersion] = useState(1);
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      setLoaded(draft.source);
      setDraftVersion((v) => v + 1);
    }, reloadMs);
    return () => clearTimeout(timer);
  }, [draft.source, reloadMs]);

  const program = useMemo<ProgramRecord>(
    () => ({
      id: DRAFT_PROGRAM_ID,
      title: "draft",
      source: loaded,
      version: draftVersion,
      bindings: Object.keys(draft.bindings),
      meta: { widgets: ["main"] },
      by: "human",
      pinned: false,
      history: [],
      createdAt: draft.updatedAt,
      updatedAt: draft.updatedAt,
    }),
    // bindings/updatedAt do not reload the instance; the source does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, draftVersion],
  );

  const bindingsKey = JSON.stringify(draft.bindings);
  const documents = useMemo(() => {
    const out: Record<string, UIReference | null> = {};
    for (const [key, id] of Object.entries(draft.bindings)) out[key] = id ? host.resolve(key, id) : null;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingsKey, host.resolve]);

  const instance = useProgramInstance({
    engine: host.engine,
    program,
    viewId: PLAYGROUND_VIEW_ID,
    placementId,
    states: host.states,
    instances: host.instances,
    documents,
    env,
    perform: host.perform,
  });

  const size = byteLength(draft.source);
  const tooBig = size > DEFAULT_LIMITS.sourceBytes;
  const pending = loaded !== draft.source;
  const canSave = !tooBig && !pending && instance.status === "ready" && instance.meta !== null;
  const from = draft.fromProgramId ? (programs[draft.fromProgramId] ?? null) : null;
  const [confirmLoad, setConfirmLoad] = useState<string | null>(null);

  const saveAsNew = async () => {
    const meta = instance.meta!;
    const record = host.library.putProgram({
      title: meta.title,
      source: draft.source,
      bindings: meta.bindings,
      meta: { ...(meta.declaredId ? { declaredId: meta.declaredId } : {}), widgets: meta.widgets },
      by: "human",
    });
    store.set({ fromProgramId: record.id });
    host.instances.record({ kind: "note", viewId: PLAYGROUND_VIEW_ID, programId: DRAFT_PROGRAM_ID, version: draftVersion, instanceId: null, text: `saved as ${record.id} (${record.title})` });
    // The product's own verb opens it, so the trace sees a program appear.
    await host.perform({ kind: "program.open", programId: record.id, documents: draft.bindings }, { provenance: { programId: record.id } });
  };

  const update = () => {
    if (!from) return;
    const meta = instance.meta!;
    const record = host.library.putProgram({
      id: from.id,
      title: meta.title,
      source: draft.source,
      bindings: meta.bindings,
      meta: { ...(meta.declaredId ? { declaredId: meta.declaredId } : {}), widgets: meta.widgets },
      by: "human",
    });
    host.instances.record({ kind: "note", viewId: PLAYGROUND_VIEW_ID, programId: DRAFT_PROGRAM_ID, version: draftVersion, instanceId: null, text: `updated ${record.id} to v${record.version}` });
  };

  const loadFrom = (id: string) => {
    const record = programs[id];
    if (!record) return;
    const bindings: Record<string, string> = {};
    for (const key of record.bindings) bindings[key] = draft.bindings[key] ?? "";
    store.set({ source: record.source, bindings, fromProgramId: record.id });
    setConfirmLoad(null);
  };

  const askAgent = () => {
    const failure = instance.error ? ` It fails at ${instance.error.phase ?? "run"} with ${instance.error.code}: ${instance.error.message}.` : "";
    host.askAgent?.(`Here is a program draft from the playground.${failure} Please review or fix it and reply with the corrected source:\n\n${draft.source}`, []);
  };

  const untouched = draft.source === store.get().source && draft.fromProgramId === null && draft.source.includes('id: "my-draft"');

  return (
    <div data-part="sandbox-playground" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <Chip label={from ? `editing ${from.id} · v${from.version}` : "new draft"} tone="var(--pbui-tone-widget)" />
        <Chip label={pending ? "reloading…" : instance.status} state={instance.status === "error" ? "stale" : undefined} />
        <span className={styles.spacer} />
        <SelectInput
          size="tiny"
          variant="framed"
          value=""
          placeholder="load from…"
          accessibleName="load a library program into the draft"
          options={Object.values(programs).map((p) => ({ value: p.id, label: `${p.title} · v${p.version}` }))}
          onValueChange={(id) => (untouched ? loadFrom(id) : setConfirmLoad(id))}
        />
        <Button size="tiny" variant="raised" disabled={!canSave} onClick={() => void saveAsNew()}>
          save as new
        </Button>
        {from ? (
          <Button size="tiny" variant="framed" disabled={!canSave} onClick={update}>
            update {from.id}
          </Button>
        ) : null}
        {host.askAgent ? (
          <Button size="tiny" variant="framed" onClick={askAgent}>
            ask the agent
          </Button>
        ) : null}
        <Button size="tiny" variant="bare" onClick={() => store.reset()}>
          clear
        </Button>
      </Toolbar>

      <div className={styles.split}>
        <div className={styles.editor}>
          <TextArea
            code
            rows={24}
            value={draft.source}
            onValueChange={(source) => store.set({ source })}
            accessibleName="draft source"
            invalid={instance.status === "error" || tooBig}
            spellCheck={false}
          />
          <div data-part="playground-status">
          <Text size="tiny" tone={instance.error || tooBig ? "danger" : "faint"} className={styles.status}>
            {tooBig
              ? `source is ${size} bytes, the limit is ${DEFAULT_LIMITS.sourceBytes}`
              : instance.error
                ? `${instance.error.phase ?? "run"} · ${instance.error.code} · ${instance.error.message}`
                : instance.meta
                  ? `ok · ${instance.meta.widgets.join(", ")} · ${Object.values(instance.trees).reduce((n, t) => n + countNodes(t), 0)} nodes · ${size} bytes`
                  : "loading…"}
          </Text>
          </div>
        </div>

        <div className={styles.side}>
          <BindingsPicker host={host} draft={draft.bindings} declared={instance.meta?.bindings ?? []} documents={documents} onChange={(bindings) => store.set({ bindings })} />
          <section data-part="playground-preview" className={styles.preview} aria-label="draft preview">
            {(instance.meta?.widgets ?? []).map((widgetId) => (
              <UINodeRenderer
                key={widgetId}
                tree={instance.trees[widgetId] ?? null}
                onEvent={(ref, payload) => instance.onEvent(widgetId, ref, payload)}
                renderReference={host.renderReference}
                accessiblePrefix="draft"
              />
            ))}
          </section>
        </div>
      </div>

      {confirmLoad ? (
        <Dialog
          title="Replace the draft?"
          onClose={() => setConfirmLoad(null)}
          footer={
            <Toolbar tight>
              <Button size="small" variant="framed" onClick={() => setConfirmLoad(null)}>
                keep my draft
              </Button>
              <Button size="small" variant="raised" onClick={() => loadFrom(confirmLoad)}>
                replace
              </Button>
            </Toolbar>
          }
        >
          <Text size="small" prose>
            Loading {programs[confirmLoad]?.title ?? confirmLoad} discards what is in the editor now.
          </Text>
        </Dialog>
      ) : null}
    </div>
  );
}

function BindingsPicker({
  host,
  draft,
  declared,
  documents,
  onChange,
}: {
  host: SandboxHost;
  draft: Record<string, string>;
  declared: string[];
  documents: Record<string, UIReference | null>;
  onChange(bindings: Record<string, string>): void;
}) {
  const [newKey, setNewKey] = useState("");
  const keys = [...new Set([...declared, ...Object.keys(draft)])];
  const set = (key: string, id: string) => onChange({ ...draft, [key]: id });
  const remove = (key: string) => {
    const next = { ...draft };
    delete next[key];
    onChange(next);
  };
  return (
    <section data-part="playground-bindings" className={styles.bindings} aria-label="bindings">
      {keys.length === 0 ? (
        <Text size="tiny" tone="faint">
          no bindings — declare `bindings: ["product"]` in the draft, or add one
        </Text>
      ) : null}
      {keys.map((key) => {
        const choices = host.bindingChoices?.(key) ?? [];
        const reference = documents[key] ?? null;
        return (
          <div key={key} className={styles.binding} data-key={key}>
            <Text size="tiny" strong className={styles.key}>
              {key}
            </Text>
            {choices.length > 0 ? (
              <SelectInput
                size="tiny"
                variant="framed"
                value={draft[key] ?? ""}
                placeholder="— unbound —"
                accessibleName={`binding ${key}`}
                options={choices.map((c) => ({ value: c.id, label: c.label }))}
                onValueChange={(id) => set(key, id)}
              />
            ) : (
              <TextInput size="tiny" width="compact" value={draft[key] ?? ""} placeholder="id" accessibleName={`binding ${key}`} onValueChange={(id) => set(key, id)} />
            )}
            {reference ? host.renderReference(reference, `${reference.type}:${reference.id}`) : draft[key] ? <Text size="tiny" tone="danger">unresolved</Text> : null}
            {!declared.includes(key) ? (
              <Button size="tiny" variant="bare" onClick={() => remove(key)} title={`remove the ${key} binding`}>
                ×
              </Button>
            ) : null}
          </div>
        );
      })}
      <div className={styles.binding}>
        <TextInput size="tiny" width="compact" value={newKey} placeholder="new key" accessibleName="new binding key" onValueChange={setNewKey} />
        <Button
          size="tiny"
          variant="bare"
          disabled={!newKey.trim() || newKey.trim() in draft}
          onClick={() => {
            set(newKey.trim(), "");
            setNewKey("");
          }}
        >
          add binding
        </Button>
      </div>
    </section>
  );
}

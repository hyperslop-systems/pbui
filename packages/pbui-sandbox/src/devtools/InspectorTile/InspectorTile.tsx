import { Button, Chip, EmptyState, JsonBlock, KeyValueList, SelectInput, Text, TileHeader } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, useState } from "react";
import type { SandboxHost } from "../../host/hostOptions";
import { useInstances, type InstanceSnapshot } from "../../instances";
import { useLibrary } from "../../library";
import { useProgramState } from "../../state";
import { countNodes } from "../../validate/uiSchema";
import { PROGRAM_BINDING } from "../../ScriptTile";
import styles from "./InspectorTile.module.css";
import { StatePane } from "./StatePane";
import { TreeOutline, treeDepth } from "./TreeOutline";

/** The optional second binding: which running view of the program to inspect. */
export const VIEW_BINDING = "view";

export interface InspectorTileProps {
  placementId: string;
  view: AppView;
  host: SandboxHost;
}

type Pane = "state" | "bindings" | "tree" | "meta";
const PANES: Pane[] = ["state", "bindings", "tree", "meta"];

/**
 * Which instance a program inspector shows (guide §4.4): the view it was
 * opened for, else the selected sandbox when it runs this program, else the
 * most recent; the user can switch among the program's instances.
 */
export function chooseInstance(candidates: InstanceSnapshot[], wanted: string | undefined, selected: string | null, chosen: string | null): InstanceSnapshot | null {
  const byId = (id: string | null | undefined) => (id ? candidates.find((s) => s.viewId === id) : undefined);
  return byId(chosen) ?? byId(wanted) ?? byId(selected) ?? candidates[candidates.length - 1] ?? null;
}

/**
 * A program's running instance from the host's side of the boundary: the
 * state (editable), the bindings the product resolved, the render tree as an
 * outline that can highlight and fire, and the instance's meta and timings.
 */
export function InspectorTile({ view, host }: InspectorTileProps) {
  const programId = view.documents[PROGRAM_BINDING] ?? "";
  const wanted = view.documents[VIEW_BINDING];
  const program = useLibrary(host.library, (state) => (programId ? (state.programs[programId] ?? null) : null));
  const all = useInstances(host.instances, (r) => r.all());
  const selected = useInstances(host.instances, (r) => r.selectedViewId());
  const candidates = useMemo(() => all.filter((s) => s.programId === programId), [all, programId]);
  const [chosen, setChosen] = useState<string | null>(null);
  const snapshot = chooseInstance(candidates, wanted, selected, chosen);
  const targetViewId = snapshot?.viewId ?? "";
  const state = useProgramState(host.states, targetViewId);
  const [pane, setPane] = useState<Pane>("state");

  if (!programId) {
    return (
      <div className={styles.app}>
        <EmptyState message="this inspector names no program" hint="open it from a program tile's inspect button" />
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className={styles.app}>
        <TileHeader title={program?.title ?? programId} />
        <EmptyState message={`${program?.title ?? programId} is not running`} hint="open it in a tile (launcher, or an object's menu) and come back" />
      </div>
    );
  }

  const handle = snapshot.handle;
  const widgets = snapshot.meta?.widgets ?? [];

  return (
    <div data-part="program-inspector" className={styles.app}>
      <TileHeader
        title={`${program?.title ?? programId} · v${snapshot.version}`}
        actions={PANES.map((p) => (
          <Button key={p} size="tiny" variant="bare" selected={pane === p} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {p}
          </Button>
        ))}
      >
        <Chip label={snapshot.status} state={snapshot.status === "error" ? "stale" : undefined} />
        {candidates.length > 1 ? (
          <SelectInput
            size="tiny"
            variant="framed"
            value={targetViewId}
            options={candidates.map((s) => ({ value: s.viewId, label: `${s.viewId} · v${s.version} · ${s.placementIds.length} tile${s.placementIds.length === 1 ? "" : "s"}` }))}
            accessibleName="which instance to inspect"
            onValueChange={(next) => {
              setChosen(next);
              host.instances.select(next);
            }}
          />
        ) : null}
      </TileHeader>

      <div className={styles.body}>
        {pane === "state" ? (
          <StatePane
            state={state}
            disabled={!handle}
            onApply={(next) => {
              host.states.set(targetViewId, next);
              host.instances.record({ kind: "note", viewId: targetViewId, programId, version: snapshot.version, instanceId: snapshot.instanceId, text: "state set from the inspector" });
            }}
            onReset={() => handle?.reset()}
          />
        ) : null}

        {pane === "bindings" ? <BindingsPane snapshot={snapshot} host={host} /> : null}

        {pane === "tree"
          ? widgets.map((widgetId) => {
              const tree = snapshot.trees[widgetId];
              if (!tree) {
                return (
                  <Text key={widgetId} size="tiny" tone="faint">
                    {widgetId}: not rendered yet
                  </Text>
                );
              }
              return (
                <section key={widgetId} data-part="inspector-tree" data-widget={widgetId}>
                  <Text size="tiny" tone="faint">
                    {widgetId} · {countNodes(tree)} nodes · depth {treeDepth(tree)}
                  </Text>
                  <TreeOutline
                    tree={tree}
                    highlight={snapshot.highlight}
                    disabled={!handle}
                    onHover={(path) => host.instances.publish(targetViewId, { highlight: path })}
                    onFire={(ref, payload) => handle?.fire(widgetId, ref, payload)}
                  />
                </section>
              );
            })
          : null}

        {pane === "meta" ? <MetaPane snapshot={snapshot} engine={host.engine.kind} /> : null}
      </div>
    </div>
  );
}

function BindingsPane({ snapshot, host }: { snapshot: InstanceSnapshot; host: SandboxHost }) {
  const documents = snapshot.globalState?.shared.documents ?? {};
  const env = snapshot.globalState?.shared.env ?? {};
  const keys = [...new Set([...(snapshot.meta?.bindings ?? []), ...Object.keys(documents)])];
  return (
    <>
      {keys.length === 0 ? (
        <Text size="tiny" tone="faint">
          this program declares no bindings
        </Text>
      ) : (
        keys.map((key) => {
          const reference = documents[key] ?? null;
          return (
            <div key={key} className={styles.binding} data-part="inspector-binding" data-key={key}>
              <Text size="tiny" strong className={styles.key}>
                {key}
              </Text>
              {reference ? (
                host.renderReference(reference, `${reference.type}:${reference.id}`)
              ) : (
                <Text size="tiny" tone="danger">
                  unresolved{key in documents ? "" : " (declared, not bound)"}
                </Text>
              )}
              {reference?.value ? <JsonBlock value={reference.value} maxHeight={120} /> : null}
            </div>
          );
        })
      )}
      <Text size="tiny" tone="faint">
        env
      </Text>
      <JsonBlock value={env} maxHeight={120} />
    </>
  );
}

function MetaPane({ snapshot, engine }: { snapshot: InstanceSnapshot; engine: string }) {
  const t = snapshot.timings;
  const ms = (value: number | undefined) => (value === undefined ? "—" : `${value.toFixed(1)} ms`);
  return (
    <>
      <KeyValueList
        dense
        items={[
          { key: "instance", value: <span className={styles.mono}>{snapshot.instanceId ?? "—"}</span> },
          { key: "engine", value: <span className={styles.mono}>{engine}</span> },
          { key: "placements", value: <span className={styles.mono}>{snapshot.placementIds.join(", ") || "—"}</span> },
          { key: "load", value: <span className={styles.mono}>{ms(t.loadMs)}</span> },
          { key: "last render", value: <span className={styles.mono}>{`${ms(t.lastRenderMs)} · ${t.renders} renders`}</span> },
          { key: "last event", value: <span className={styles.mono}>{`${ms(t.lastEventMs)} · ${t.events} events`}</span> },
          { key: "errors", value: <span className={styles.mono}>{`${t.errors} (${t.timeouts} timeouts)`}</span> },
        ]}
      />
      {snapshot.error ? (
        <Text size="tiny" tone="danger" className={styles.mono}>
          {snapshot.error.phase ?? "run"} · {snapshot.error.code} · {snapshot.error.message}
        </Text>
      ) : null}
      <Text size="tiny" tone="faint">
        meta
      </Text>
      <JsonBlock value={snapshot.meta ?? null} maxHeight={200} />
    </>
  );
}

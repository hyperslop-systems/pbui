import { LauncherShell, legalRelations, linkVerbs, type LauncherShellGroup, type PortId } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";

/**
 * The relation palette (design §6.8.5, Phase 6): for a destination port,
 * every (source output on screen, legal relation) pair the product's
 * translators allow, grouped by source tile, filtered as you type; Enter
 * performs `port.derive`. On `LauncherShell`, like the show chooser. With
 * a `source` already chosen (from a wire's menu), only its relations show.
 */
export function RelationPalette() {
  const workbench = useWorkbench();
  const state = workbench.useShellState((s) => s.relationPalette);
  const snapshot = useLinkSnapshot(workbench);
  const [query, setQuery] = useState("");
  if (!state) return null;

  const destination = snapshot.ports.get(state.destination);
  const close = () => {
    workbench.dispatch({ kind: "relation.palette.close" });
    setQuery("");
  };
  if (!destination) {
    close();
    return null;
  }
  const sources = [...snapshot.ports.values()].filter((port) => port.declaration.direction !== "in" && port.viewId !== destination.viewId && (!state.source || port.id === state.source));
  const q = query.trim().toLowerCase();
  const groups: LauncherShellGroup[] = [];
  for (const source of sources) {
    const rows = legalRelations(source.id, destination.id, snapshot, workbench.links.deps)
      .map((relation) => ({ id: `${source.id}|${relation.id}`, title: relation.label ?? relation.id, detail: `${destination.tileTitle} · ${destination.declaration.name} ← ${relation.id} ← ${source.tileTitle} · ${source.declaration.name}` }))
      .filter((row) => !q || `${row.title} ${row.detail}`.toLowerCase().includes(q));
    if (rows.length > 0) groups.push({ label: `${source.tileTitle.toUpperCase()} · ${source.declaration.name}`, rows });
  }
  const choose = (rowId: string) => {
    const [source, relation] = rowId.split("|") as [PortId, string];
    workbench.execute(linkVerbs.derive(source, destination.id, relation) as Extract<ReturnType<typeof linkVerbs.derive>, { kind: "port.derive" }>);
    close();
  };
  return (
    <LauncherShell
      title={`DERIVE ${destination.tileTitle} · ${destination.declaration.name} THROUGH…`}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      onChoose={choose}
      onClose={close}
      status={groups.length > 0 ? "pick a relation: the port then reads its source through it" : `no relation on screen produces a <${destination.declaration.contract.valueType}>`}
      enterVerb={() => "derive"}
      searchLabel="filter relations"
      placeholder="type to filter relations"
      emptyText="no relation matches"
    />
  );
}

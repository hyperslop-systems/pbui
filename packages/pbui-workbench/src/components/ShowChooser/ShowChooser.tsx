import { LauncherShell, labelOf, type LauncherShellGroup } from "@hyperslop-systems/pbui";
import type { Choice } from "@hyperslop-systems/workbench-core";
import { useState } from "react";
import { useWorkbench } from "../../context";

/**
 * The "show" chooser (design §6.8.4): when a show resolves to several
 * targets of equal rank, the candidates come back as the command's
 * `choices` and the shell offers them in the launcher's shell — anchored,
 * searchable, Enter commits. Two groups: EXISTING TARGETS (ports on screen)
 * and NEW TARGETS (placements a tile could be opened at). Choosing executes
 * the same `show` with the candidate's id, re-resolved on a fresh snapshot.
 */
export function ShowChooser() {
  const workbench = useWorkbench();
  const chooser = workbench.useShellState((state) => state.showChooser);
  const [query, setQuery] = useState("");
  if (!chooser) return null;

  const { command: show, choices } = chooser;
  const subject = labelOf(show.subject, workbench.links.deps);
  const matches = (choice: Choice) => !query.trim() || `${choice.label} ${choice.explanation}`.toLowerCase().includes(query.trim().toLowerCase());
  const row = (choice: Choice) => ({
    id: choice.id,
    title: choice.label,
    detail: choice.available ? choice.explanation : `${choice.because ?? choice.explanation}`,
    disabled: !choice.available,
  });
  const existing = choices.filter((choice) => !choice.id.startsWith("spawn:") && matches(choice));
  const spawns = choices.filter((choice) => choice.id.startsWith("spawn:") && matches(choice));
  const groups: LauncherShellGroup[] = [
    ...(existing.length > 0 ? [{ label: "EXISTING TARGETS", rows: existing.map(row) }] : []),
    ...(spawns.length > 0 ? [{ label: "NEW TARGETS", rows: spawns.map(row) }] : []),
  ];
  const close = () => {
    workbench.dispatch({ kind: "show.chooser.close" });
    setQuery("");
  };
  const choose = (candidateId: string) => {
    workbench.execute({ ...show, candidateId });
    close();
  };
  const available = choices.filter((choice) => choice.available).length;

  return (
    <LauncherShell
      title={`SHOW ${subject}${show.role ? ` AS ${show.role}` : ""}`}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      onChoose={choose}
      onClose={close}
      status={available > 1 ? `${available} targets rank equally; pick one — Esc leaves everything as it is` : "pick a target"}
      enterVerb={(rowId) => (rowId?.startsWith("spawn:") ? "open and show" : "show here")}
      searchLabel="filter targets"
      placeholder="type to filter targets"
      emptyText="no target matches"
    />
  );
}

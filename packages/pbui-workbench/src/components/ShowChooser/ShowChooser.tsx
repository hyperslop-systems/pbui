import { LauncherShell, labelOf, linkVerbs, type LauncherShellGroup, type ShowCandidate } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { useWorkbench } from "../../context";

/**
 * The "show" chooser (design §6.8.4): when a show resolves to several
 * targets of equal rank, the candidates are offered in the launcher's shell
 * — anchored, searchable, Enter commits — instead of the toy's centered
 * routing modal. Two groups: EXISTING TARGETS (ports on screen, each with
 * its state and why it ranks where it does) and NEW TARGETS (placements a
 * tile could be opened at). Choosing performs the same `show` verb with the
 * candidate's id, which the handler re-resolves on a fresh snapshot.
 */
export function ShowChooser() {
  const workbench = useWorkbench();
  const chooser = workbench.useWorkbenchState((state) => state.showChooser);
  const [query, setQuery] = useState("");
  if (!chooser) return null;

  const { query: show, resolution } = chooser;
  const subject = labelOf(show.subject, workbench.links.deps);
  const matches = (candidate: ShowCandidate) => !query.trim() || `${candidate.title} ${candidate.explanation}`.toLowerCase().includes(query.trim().toLowerCase());
  const row = (candidate: ShowCandidate) => ({
    id: candidate.candidateId,
    title: candidate.title,
    detail: candidate.status.kind === "available" ? candidate.explanation : `${candidate.status.because}`,
    disabled: candidate.status.kind !== "available",
  });
  const existing = resolution.candidates.filter((candidate) => candidate.kind === "existing-port" && matches(candidate));
  const spawns = resolution.candidates.filter((candidate) => candidate.kind === "spawn" && matches(candidate));
  const groups: LauncherShellGroup[] = [
    ...(existing.length > 0 ? [{ label: "EXISTING TARGETS", rows: existing.map(row) }] : []),
    ...(spawns.length > 0 ? [{ label: "NEW TARGETS", rows: spawns.map(row) }] : []),
  ];
  const close = () => {
    workbench.store.setState({ showChooser: null });
    setQuery("");
  };
  const choose = (candidateId: string) => {
    workbench.perform(
      linkVerbs.show(show.subject, {
        ...(show.role ? { role: show.role } : {}),
        ...(show.disposition ? { disposition: show.disposition } : {}),
        ...(show.from ? { from: show.from } : {}),
        candidateId,
      }),
    );
    close();
  };
  const winnerIds = new Set(resolution.winners.map((winner) => winner.candidateId));

  return (
    <LauncherShell
      title={`SHOW ${subject}${show.role ? ` AS ${show.role}` : ""}`}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      onChoose={choose}
      onClose={close}
      status={resolution.ambiguous ? `${resolution.winners.length} targets rank equally; pick one — Esc leaves everything as it is` : "pick a target"}
      enterVerb={(rowId) => (rowId && winnerIds.has(rowId) ? "show here" : rowId?.startsWith("spawn:") ? "open and show" : "show here")}
      searchLabel="filter targets"
      placeholder="type to filter targets"
      emptyText="no target matches"
    />
  );
}

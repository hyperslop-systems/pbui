import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const workspaceDescriptor: PresentationDescriptor<"workspace"> = {
  ptype: "workspace",
  tone: TONES.workspace,

  label: (ref) => ref.value?.name ?? `workspace ${ref.id}`,

  describe: (ref) => ({ presentationType: "workspace", id: ref.id, ...ref.value }),

  actions: (ref) => [
    {
      label: "Go to it",
      verb: { kind: "workspace.select", workspaceId: ref.id },
      // Recomputed from the value on every render, never stored: the rule
      // that makes a verb unavailable has to be re-decided, or a stale
      // "already here" survives a switch.
      ...(ref.value?.active ? { disabledBecause: "you are already here" } : {}),
    },
    { label: "Duplicate", verb: { kind: "workspace.clone", workspaceId: ref.id } },
    { label: "Rename…", verb: { kind: "workspace.rename", workspaceId: ref.id, name: ref.value?.name ?? "" } },
    {
      label: "Delete",
      verb: { kind: "workspace.delete", workspaceId: ref.id },
      danger: true,
    },
    {
      label: "Ask the agent what is in it",
      verb: { kind: "askAgent", template: "what is in the workspace {0}?", refs: [ref] },
    },
  ],
};

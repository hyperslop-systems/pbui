import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const proposalDescriptor: PresentationDescriptor<"proposal"> = {
  ptype: "proposal",
  tone: TONES.proposal,

  label: (ref) => ref.value?.title ?? `proposal ${ref.id}`,

  describe: (ref) => ({ presentationType: "proposal", id: ref.id, ...ref.value }),

  actions: (ref, env) => {
    const decided = ref.value?.decision ? `already ${ref.value.decision.value}d` : undefined;
    const gate = decided ?? (env.canApprove ? undefined : "needs approver role");
    return [
      { label: "Inspect", verb: { kind: "inspect", ref } },
      {
        label: "Approve",
        verb: { kind: "resolveProposal", id: ref.id, decision: "approve" },
        danger: true,
        disabledBecause: gate,
      },
      {
        label: "Reject",
        verb: { kind: "resolveProposal", id: ref.id, decision: "reject" },
        disabledBecause: decided,
      },
      {
        label: "Ask for the reasoning",
        verb: { kind: "askAgent", template: "why are you proposing {0}?", refs: [ref] },
      },
    ];
  },
};

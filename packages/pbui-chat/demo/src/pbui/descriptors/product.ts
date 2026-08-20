import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";
import type { Action } from "../verbs";

export const productDescriptor: PresentationDescriptor<"product"> = {
  ptype: "product",
  tone: TONES.product,

  label: (ref) => ref.value?.name ?? `product ${ref.id}`,

  describe: (ref) => ({
    presentationType: "product",
    id: ref.id,
    ...ref.value,
  }),

  actions: (ref, env) => {
    const low =
      ref.value?.stock !== undefined && ref.value.reorderPoint !== undefined && ref.value.stock <= ref.value.reorderPoint;
    const actions: Action[] = [
      { label: "Inspect", verb: { kind: "inspect", ref } },
      { label: "Add to watchlist", verb: { kind: "watch", ref } },
      {
        label: "Compare with…",
        verb: { kind: "compareWith", left: ref },
        description: "pick another product to compare against",
      },
      {
        label: "Ask the agent why it sells",
        verb: { kind: "askAgent", template: "why does {0} sell the way it does?", refs: [ref] },
      },
      {
        label: low ? "Draft a reorder (stock is low)" : "Draft a reorder",
        verb: { kind: "reorder", productId: ref.id },
        danger: true,
        disabledBecause: env.canApprove ? undefined : "needs approver role",
      },
    ];
    return actions;
  },
};

import { library } from "../../sandbox";
import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * A program, as an object: what the agent mentions as `[[program:prg-7|…]]`
 * and what a tile's title could be. *Inspect* is the "view source" door —
 * `describe()` reads the source from the library, so the inspector shows the
 * code without the value carrying it around.
 */
export const programDescriptor: PresentationDescriptor<"program"> = {
  ptype: "program",
  tone: TONES.program,

  label: (ref) => ref.value?.title ?? `program ${ref.id}`,

  describe: (ref) => {
    const record = library.getState().programs[ref.id];
    return {
      presentationType: "program",
      id: ref.id,
      ...ref.value,
      ...(record
        ? { version: record.version, bindings: record.bindings, by: record.by, pinned: record.pinned, lastError: record.lastError?.message, source: record.source }
        : { missing: "not in this browser's library" }),
    };
  },

  actions: (ref) => {
    const record = library.getState().programs[ref.id];
    const bindings = record?.bindings ?? ref.value?.bindings ?? [];
    const pinned = record?.pinned ?? ref.value?.pinned ?? false;
    return [
      {
        label: "Open in a tile",
        verb: { kind: "program.open", programId: ref.id },
        ...(bindings.length > 0
          ? { disabledBecause: `needs ${bindings.map((b) => `a "${b}" binding`).join(", ")}; open it from that object's menu or ask the agent` }
          : {}),
        ...(record ? {} : { disabledBecause: "this program is not in the library" }),
      },
      { label: "View source", verb: { kind: "inspect", ref } },
      { label: pinned ? "Unpin" : "Pin (the agent must ask before changing it)", verb: { kind: "program.pin", programId: ref.id, pinned: !pinned } },
      { label: "Remove", verb: { kind: "program.remove", programId: ref.id }, danger: true },
      {
        label: "Ask the agent to improve it",
        verb: { kind: "askAgent", template: "improve the program {0}: ", refs: [ref] },
      },
    ];
  },
};

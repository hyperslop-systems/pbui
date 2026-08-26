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

};

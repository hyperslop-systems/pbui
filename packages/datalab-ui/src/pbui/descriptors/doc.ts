import type { PresentationDescriptor } from "../registry";
import type { DocId } from "../types";

/**
 * `<doc>` — a live chart document (α, β, γ …).
 *
 * A document is an identity plus a legacy chart format (guide §7.3, DR-8), which is why
 * snapshotting is a deep copy and a permalink is the same object encoded. There
 * is no separate document-specification type and there must not be one.
 */
export const docDescriptor: PresentationDescriptor<DocId> = {
  ptype: "doc",
  tone: "var(--pbui-tone-doc)",

  label: (docId, env) => env.nameOf(docId),

  describe: (docId, env) => {
    const table = env.tableFor(docId);
    return {
      presentationType: "chart document",
      name: env.nameOf(docId),
      active: env.activeDocId === docId,
      source: table?.source ?? "(no source)",
      rows_loaded: table?.row_count ?? 0,
    };
  },

};

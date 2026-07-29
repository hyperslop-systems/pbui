import { describeSource } from "../../model/graphicAuthoring";
import type { SourceRef } from "../../model/table";
import type { PresentationDescriptor } from "../registry";
import type { Action } from "../verbs";

/** `<source>` — a stream or a dataset file that can be loaded or inspected. */

export const sourceDescriptor: PresentationDescriptor<SourceRef> = {
  ptype: "source",
  tone: "var(--pbui-tone-source)",

  label: (source) => describeSource(source),

  describe: (source, env) => {
    const table = env.tableFor(null);
    const loaded = table && table.source.drop === source.drop ? table : null;
    return {
      presentationType: "source",
      ...source,
      ...(loaded
        ? {
            rows_loaded: loaded.row_count,
            truncated: loaded.truncated,
            // "at least N+1", not "N". When a table is truncated the server has
            // proved a further row exists — it asks for limit + 1 and discards
            // the extra — so claiming N is claiming the sample is the whole
            // source. TruncationBanner.tsx shipped exactly that defect.
            total_rows: loaded.truncated
              ? `at least ${(loaded.row_count + 1).toLocaleString()}`
              : loaded.row_count,
            selection: loaded.strategy === "latest" ? "the most recent rows" : "the first rows",
          }
        : { note: "not currently loaded" }),
    };
  },

  actions: (source, env) => {
    const actions: Action[] = [
      {
        label: `Load into chart ${env.nameOf(env.activeDocId)}`,
        verb: { kind: "setSource", docId: env.activeDocId, source },
      },
      { label: "New chart document from it", verb: { kind: "newDoc", source } },
    ];

    actions.push({ label: "Inspect", verb: { kind: "inspect", ptype: "source", value: source } });
    actions.push({
      label: "Add to watchlist",
      verb: { kind: "watch", ptype: "source", value: source },
    });
    return actions;
  },
};

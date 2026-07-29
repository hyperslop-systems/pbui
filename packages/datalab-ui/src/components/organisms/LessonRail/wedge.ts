import { CHANNELS } from "../../../model/graphic";
import { compileTableDocument, rootView } from "../../../model/graphicAuthoring";
import type { Table } from "../../../model/table";
import type { RootState } from "../../../store";

/** Explain a canonical schema wedge without executing rows on the render path. */
export function wedgeOf(state: RootState): string | null {
  const docId = state.world.activeDocId;
  const doc = docId ? state.world.docs[docId] : undefined;
  if (!doc) return null;
  const cached = Object.values(state.datadrop.queries).find(
    (entry) => (entry?.data as { source?: unknown } | undefined)?.source,
  )?.data as Table | undefined;
  if (!cached) return null;

  const compiled = compileTableDocument(doc, cached);
  const logical = compiled.logical;
  const view = logical?.views[logical.rootView];
  const fields = view ? logical?.relations[view.relation]?.fields : [];
  const names = new Set((fields ?? []).map((field) => field.name));
  const authoringView = rootView(doc);
  const lost = CHANNELS.filter((channel) => {
    const mapped = authoringView.encodings[channel]?.name;
    return mapped != null && !names.has(mapped);
  });
  return lost.length > 0
    ? `chart ${doc.name} maps ${lost.join(" and ")} to a field the pipeline no longer produces — a group∑ transform changes the schema. Re-map it, or`
    : null;
}

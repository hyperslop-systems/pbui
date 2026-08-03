import { useDispatch, useSelector } from "react-redux";
import { IconButton, SelectInput, SectionLabel, Toolbar } from "@hyperslop-systems/pbui";
import { DocChip } from "../../atoms";
import type { RootState } from "../../../store";
import { layoutActions } from "../../../store/layout";
import { worldActions } from "../../../store/world";
import type { DocId } from "../../../pbui";
import type { ViewId } from "../../../store/layout";
import { rootSource } from "../../../model/graphicAuthoring";

/**
 * The strip atop every document-bound tile: which document am I a view of?
 *
 * Ported from pbui-gog.jsx:1302-1317. The dropdown re-points the tile and ＋
 * spawns a new document into it. Two tiles pointed at one document stay in
 * lockstep because they are views of one object rather than copies — which is
 * the property the whole window manager rests on.
 */
export function DocBar({ viewId, docId }: { viewId: ViewId; docId: DocId | null }) {
  const dispatch = useDispatch();
  const docs = useSelector((state: RootState) =>
    state.world.docOrder.map((id) => state.world.docs[id]!),
  );
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);
  const shown = docId ?? activeDocId;

  return (
    <Toolbar tight bordered>
      <SectionLabel>Doc</SectionLabel>
      {shown && <DocChip docId={shown} />}

      <SelectInput
        accessibleName="which document this tile shows"
        variant="framed"
        size="tiny"
        value={shown ?? ""}
        onValueChange={(docId) =>
          dispatch(layoutActions.setViewDocument({ viewId, docId: docId || null }))
        }
        options={
          docs.length === 0
            ? [{ value: "", label: "(no documents)" }]
            : docs.map((doc) => ({
                value: doc.id,
                label: `${doc.name} · ${rootSource(doc)?.drop || "—"}`,
              }))
        }
      />

      <IconButton
        variant="framed"
        size="tiny"
        glyph="＋"
        accessibleName="new document in this tile"
        title="new chart document — this tile re-points to it"
        onClick={() => {
          const action = worldActions.newDoc(null);
          dispatch(action);
          dispatch(layoutActions.setViewDocument({ viewId, docId: action.payload.id }));
        }}
      />
    </Toolbar>
  );
}

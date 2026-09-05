import { useDispatch, useSelector } from "react-redux";
import { IconButton, SelectInput, SectionLabel, Toolbar } from "@hyperslop-systems/pbui";
import { DocChip } from "../../atoms";
import type { AppDispatch, RootState } from "../../../store";
import { rebindView } from "../../../store/workbenchVerbs";
import { worldActions } from "../../../store/world";
import type { DocId } from "../../../pbui";
import { rootSource } from "../../../model/graphicAuthoring";

/**
 * The strip atop every document-bound tile: which document am I a view of?
 *
 * Ported from pbui-gog.jsx:1302-1317. The dropdown re-points the tile and ＋
 * spawns a new document into it. Two tiles pointed at one document stay in
 * lockstep because they are views of one object rather than copies — which
 * is the property the whole window manager rests on.
 *
 * Re-pointing is a `view.configure` on the core, reached through a store
 * thunk (a molecule may not import `appkit`): the new document's stub is in
 * the workbench the moment the world has the document, because the graphic
 * source writes it synchronously.
 */
export function DocBar({ viewId, docId }: { viewId: string; docId: DocId | null }) {
  const dispatch = useDispatch<AppDispatch>();
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
        onValueChange={(next) => void dispatch(rebindView(viewId, next || null))}
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
          dispatch(rebindView(viewId, action.payload.id));
        }}
      />
    </Toolbar>
  );
}

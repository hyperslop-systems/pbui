import { useDispatch, useSelector } from "react-redux";
import { registerApp, type AppProps } from "../../appkit/registry";
import { DocBar } from "../../components/molecules";
import { PipelinePanel, type PipelineStepView } from "../../components/organisms";
import { fieldsAtRelation, orderedTransformIds, rootView } from "../../model/graphicAuthoring";
import {
  draftToTransform,
  newTransformDraft,
  transformToDraft,
  type TransformDraft,
  type TransformKind,
} from "../../model/transformEditor";
import { usePbui, type FieldRef } from "../../pbui";
import type { RootState } from "../../store";
import { worldActions } from "../../store/world";
import { useDocAnalysisResult } from "../useTable";

function PipelineApp({ view }: AppProps) {
  const docId = view.documents.primary ?? null;
  const dispatch = useDispatch();
  const pbui = usePbui();
  const { doc, table, pipeline } = useDocAnalysisResult(docId);
  const activeDocId = useSelector((state: RootState) => state.world.activeDocId);
  const target = doc?.id ?? activeDocId;
  const transformIds = doc ? orderedTransformIds(doc) : [];
  const transforms = doc ? transformIds.map((id) => doc.transforms[id]!).map(transformToDraft) : [];
  const outputFields = doc && table ? fieldsAtRelation(doc, table, rootView(doc).relation) : [];

  const fieldsBefore = (index: number) => {
    if (!doc || !table) return [];
    const transformId = transformIds[index];
    const relation = transformId ? doc.transforms[transformId]?.input : rootView(doc).relation;
    return relation ? fieldsAtRelation(doc, table, relation) : [];
  };

  const add = async (kind: TransformKind) => {
    if (!table || !doc) return;
    const schema = outputFields;
    let draft = newTransformDraft(kind, schema);
    if (kind === "filter" || kind === "summarize") {
      const result = await pbui.accept({
        types: "field",
        prompt:
          kind === "filter"
            ? `FILTER (chart ${pbui.environment.nameOf(target)}) — click the FIELD to filter on`
            : `GROUP BY (chart ${pbui.environment.nameOf(target)}) — click a nominal or temporal FIELD`,
        filter: (reference) => {
          const field = schema.find((item) => item.name === (reference.value as FieldRef).name);
          return Boolean(field && (kind === "filter" || field.type !== "q"));
        },
      });
      if (!result) return;
      const name = (result.value as FieldRef).name;
      draft =
        draft.kind === "filter"
          ? { ...draft, field: name }
          : draft.kind === "summarize"
            ? { ...draft, by: name }
            : draft;
    }
    dispatch(
      worldActions.addTransform({
        docId: target,
        transform: draftToTransform(draft, schema),
      }),
    );
  };

  const views: PipelineStepView[] = transforms.map((step, index) => ({
    step,
    available: fieldsBefore(index).map((field) => field.name),
    dropped: undefined,
  }));

  const change = (draft: TransformDraft) => {
    const index = transforms.findIndex((candidate) => candidate.id === draft.id);
    const original = doc?.transforms[draft.id];
    if (!original) return;
    dispatch(
      worldActions.updateTransform({
        docId: target,
        transform: { ...draftToTransform(draft, fieldsBefore(index)), input: original.input },
      }),
    );
  };

  return (
    <>
      <DocBar viewId={view.id} docId={docId} />
      <PipelinePanel
        steps={views}
        outputFields={outputFields.map((field) => field.name)}
        outputRows={pipeline?.rows.length ?? 0}
        docId={target}
        onAdd={(kind) => void add(kind)}
        onToggle={(transformId) =>
          dispatch(worldActions.toggleTransform({ docId: target, transformId }))
        }
        onMoveUp={(transformId) =>
          dispatch(worldActions.moveTransform({ docId: target, transformId, by: -1 }))
        }
        onRemove={(transformId) =>
          dispatch(worldActions.removeTransform({ docId: target, transformId }))
        }
        onChange={change}
      />
    </>
  );
}

registerApp({
  id: "pipeline",
  title: "pipeline",
  tone: "var(--pbui-tone-step)",
  docBound: true,
  duplicable: true,
  singleton: false,
  Component: PipelineApp,
});

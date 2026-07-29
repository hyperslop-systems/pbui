import { registerApp, type AppProps } from "../../appkit/registry";
import { orderedTransformIds } from "../../model/graphicAuthoring";
import { worldActions } from "../../store/world";
import { Step, TutorialBody, TutorialHead } from "./Tutorial";

const base = () => ({
  id: crypto.randomUUID(),
  input: { kind: "source" as const, sourceId: "pending" },
  enabled: true,
  state: "complete" as const,
});

function Tut2(_props: AppProps) {
  return (
    <TutorialBody>
      <TutorialHead title="2 · pipeline verbs">
        A chart's data is the output of a chain of tidyverse-style transforms: filter ⊳ derive ⊳
        group∑ ⊳ sort ⊳ limit. Load <code>lab / temps</code> first.
      </TutorialHead>
      <Step
        n={1}
        runLabel="filter station ≠ roof"
        run={({ dispatch, state }) =>
          dispatch(
            worldActions.addTransform({
              docId: state.world.activeDocId,
              transform: {
                ...base(),
                kind: "core:filter",
                predicate: {
                  kind: "call",
                  function: "ne",
                  arguments: [
                    { kind: "field", field: { name: "data.station" } },
                    { kind: "literal", value: "roof" },
                  ],
                },
              },
            }),
          )
        }
      >
        <strong>filter</strong> keeps rows. Watch the row count and chart update.
      </Step>
      <Step
        n={2}
        runLabel="derive load = temp_c / humidity"
        run={({ dispatch, state }) =>
          dispatch(
            worldActions.addTransform({
              docId: state.world.activeDocId,
              transform: {
                ...base(),
                kind: "core:extend",
                name: "load",
                semanticType: "quantitative",
                expression: {
                  kind: "call",
                  function: "divide",
                  arguments: [
                    { kind: "field", field: { name: "data.temp_c" } },
                    { kind: "field", field: { name: "data.humidity" } },
                  ],
                },
              },
            }),
          )
        }
      >
        <strong>derive</strong> computes a new first-class column.
      </Step>
      <Step
        n={3}
        runLabel="group station → mean temp_c"
        run={({ dispatch, state }) =>
          dispatch(
            worldActions.addTransform({
              docId: state.world.activeDocId,
              transform: {
                ...base(),
                kind: "core:aggregate",
                groupBy: [{ name: "data.station" }],
                measures: [
                  {
                    name: "mean_data.temp_c",
                    function: "mean",
                    field: { name: "data.temp_c" },
                  },
                ],
              },
            }),
          )
        }
      >
        <strong>group∑</strong> is split-apply-combine.
      </Step>
      <Step
        n={4}
        runLabel="toggle the first transform off"
        run={({ dispatch, state }) => {
          const docId = state.world.activeDocId;
          const doc = docId ? state.world.docs[docId] : undefined;
          const first = doc ? orderedTransformIds(doc)[0] : undefined;
          if (first) dispatch(worldActions.toggleTransform({ docId, transformId: first }));
        }}
      >
        <strong>Transforms are objects, not history.</strong> Disable one without deleting it for an
        instant A/B comparison.
      </Step>
    </TutorialBody>
  );
}

registerApp({
  id: "tut2",
  title: "tutorial 2 · pipeline",
  tone: "var(--pbui-selected)",
  docBound: false,
  duplicable: false,
  singleton: true,
  Component: Tut2,
});

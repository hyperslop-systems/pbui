import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { createEvalEngine } from "./engines/evalEngine";
import { COUNTER_PROGRAM } from "./fixtures/programs";
import type { SandboxHost } from "./host/hostOptions";
import { createInstanceRegistry } from "./instances";
import { createProgramLibrary, memoryStorage } from "./library";
import { ScriptTile } from "./ScriptTile";
import { createProgramStateStore } from "./state";
import { InspectorTile } from "./devtools/InspectorTile/InspectorTile";
import { ReplTile } from "./devtools/ReplTile/ReplTile";
import { TimelineTile } from "./devtools/TimelineTile/TimelineTile";

/**
 * PBUI-VISUAL-1: the devtools tiles the Devtools.stories.tsx fixtures do not
 * cover (inspector, REPL, timeline) with a REAL running instance behind
 * them, so the visual audit can drive them with actual content instead of
 * their empty states. One host, one running Counter program, four tiles.
 */
const meta: Meta = { title: "Visual Audit/Sandbox Devtools" };
export default meta;

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "visual-audit", storage: memoryStorage(), now: () => "2026-09-04T12:00:00.000Z" });
  // No explicit `id`: putProgram treats a given id as an UPDATE of an
  // existing program and throws "no program <id>" on a fresh library (see
  // Devtools.stories.tsx). Ids mint sequentially, so the first program here
  // becomes "prg-1", which the views below reference.
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" });
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry({ now: () => "2026-09-04T12:00:00.000Z" }),
    resolve: () => null,
    useEnv: () => NONE,
    perform: async () => "performed",
    renderReference: (reference, label) => <span>{label || reference.id}</span>,
    bindingChoices: () => [],
  };
}

const view = (id: string, documents: Record<string, string>) => ({ id, appId: "x", documents, title: "" }) as never;

const frame = { display: "flex", flexDirection: "column" as const, height: "100%", border: "1px solid var(--pbui-line, #cbd5e1)", overflow: "auto" };

export const AllDevtools: StoryObj = {
  name: "script tile + inspector + timeline + REPL, one running instance",
  render: function AllDevtoolsStory() {
    const host = useMemo(makeHost, []);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8, height: 640 }}>
        <div style={frame}>
          <ScriptTile placementId="n-script" view={view("v-1", { program: "prg-1" })} host={host} />
        </div>
        <div style={frame}>
          <InspectorTile placementId="n-inspector" view={view("v-2", { program: "prg-1", view: "v-1" })} host={host} />
        </div>
        <div style={frame}>
          <TimelineTile placementId="n-timeline" view={view("v-3", {})} host={host} />
        </div>
        <div style={frame}>
          <ReplTile placementId="n-repl" view={view("v-4", {})} host={host} />
        </div>
      </div>
    );
  },
};

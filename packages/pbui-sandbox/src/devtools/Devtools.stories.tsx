import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { createEvalEngine } from "../engines/evalEngine";
import { COUNTER_PROGRAM, DAYS_OF_COVER_PROGRAM, PRODUCT_2049 } from "../fixtures/programs";
import type { SandboxHost } from "../host/hostOptions";
import { createInstanceRegistry } from "../instances";
import { createProgramLibrary, memoryStorage } from "../library";
import { createProgramStateStore } from "../state";
import { PlaygroundTile } from "./PlaygroundTile/PlaygroundTile";
import { createPlaygroundStore } from "./playgroundStore";
import { SourceTile } from "./SourceTile/SourceTile";

/**
 * The devtools tiles, each over an in-memory host (the same shape the tests
 * build): an eval engine, a memory-backed library, no product router.
 * Added with PBUI-PLOTKIT-1, when both tiles moved onto pbui-editor's
 * CodeEditor, so the change could be seen and not only asserted.
 */
const meta: Meta = { title: "Sandbox/Devtools" };
export default meta;

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "story", storage: memoryStorage(), now: () => "2026-09-01T12:00:00.000Z" });
  // Ids are minted sequentially; an explicit id is an UPDATE of an existing
  // program, which is how the counter gets a v2 for the diff pane to show.
  library.putProgram({ title: "Days of cover", source: DAYS_OF_COVER_PROGRAM, bindings: ["product"], meta: { widgets: ["main"] }, by: "agent" }); // prg-1
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM.replace('"Count: "', '"Total: "'), bindings: [], meta: { widgets: ["main"] }, by: "agent" }); // prg-2 v1
  library.putProgram({ id: "prg-2", title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" }); // prg-2 v2
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry(),
    resolve: (key, id) => (key === "product" && id === "2049" ? PRODUCT_2049 : null),
    useEnv: () => NONE,
    perform: async () => "performed",
    renderReference: (reference, label) => <span>{label || reference.id}</span>,
    bindingChoices: (key) => (key === "product" ? [{ id: "2049", label: "Gold Maple" }] : []),
  };
}

const view = (documents: Record<string, string>) => ({ id: "v-story", appId: "x", documents, title: "" }) as never;

const frame = { display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 520, border: "1px solid var(--pbui-line)" } as const;

export const Playground: StoryObj = {
  name: "playground: the draft in a CodeEditor, run live",
  render: function PlaygroundStory() {
    const host = useMemo(makeHost, []);
    const store = useMemo(() => createPlaygroundStore({ key: "story-pg", storage: memoryStorage(), debounceMs: 0 }), []);
    return (
      <div style={frame}>
        <PlaygroundTile placementId="n-pg" view={view({})} host={host} store={store} />
      </div>
    );
  },
};

export const Source: StoryObj = {
  name: "source: a read-only CodeEditor with versions and diff",
  render: function SourceStory() {
    const host = useMemo(makeHost, []);
    return (
      <div style={frame}>
        <SourceTile placementId="n-src" view={view({ program: "prg-2" })} host={host} />
      </div>
    );
  },
};

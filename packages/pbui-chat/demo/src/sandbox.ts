import {
  COUNTER_PROGRAM,
  DAYS_OF_COVER_PROGRAM,
  createEvalEngine,
  createInstanceRegistry,
  createProgramLibrary,
  createProgramStateStore,
  type ProgramEngine,
  type UIReference,
} from "@hyperslop-systems/pbui-sandbox";
import { createQuickJsEngine } from "@hyperslop-systems/pbui-sandbox/quickjs";
import { categoryReference, metalReference, orderReference, productById, productReference } from "./world";

/*
 * The generative half of the demo: the library every program and generated
 * action lives in, the engine that runs them, and the state their tiles keep.
 *
 * The library is deliberately NOT the workbench document (guide D5):
 * `resetLayout()` replaces the whole document, and "reset layout" must never
 * delete a program the user kept. Tiles reference programs by id through
 * `view.documents.program`, exactly as a `sku` tile references a product.
 */
export const LIBRARY_STORAGE_KEY = "pbui-chat-demo.generated.v1";

export const library = createProgramLibrary({
  key: LIBRARY_STORAGE_KEY,
  onRejected: (reason, error) => {
    console.warn(`generated library ${reason} failed: ${error instanceof Error ? error.message : String(error)}`);
  },
});

/**
 * Which engine runs programs. QuickJS in a Web Worker by default — real
 * isolation, a 100 ms interrupt on a runaway render, the tab stays
 * responsive — with `?engine=eval` (or `localStorage["pbui-chat-demo.engine"]
 * = "eval"`) to fall back to the same-thread eval engine for debugging with
 * real stack traces. Both honour the same contracts (guide D2).
 */
function chooseEngine(): ProgramEngine {
  const wanted =
    (typeof location !== "undefined" && new URLSearchParams(location.search).get("engine")) ||
    (typeof localStorage !== "undefined" ? localStorage.getItem(`${LIBRARY_STORAGE_KEY}.engine`) : null);
  if (wanted !== "eval" && typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
      return createQuickJsEngine({ worker });
    } catch (error) {
      console.warn(`QuickJS worker unavailable, falling back to eval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return createEvalEngine();
}

export const engine: ProgramEngine = chooseEngine();

export const programStates = createProgramStateStore();

/** What is running, the timeline, and the selected sandbox — what the devtools read. */
export const instances = createInstanceRegistry();

// A console door for the demo — `__pbuiDemo.library.getState()` — so a
// reviewer can inspect the library and a browser test can seed it without
// a model on the other end. Nothing in the product reads it.
if (typeof window !== "undefined") {
  (window as unknown as { __pbuiDemo?: unknown }).__pbuiDemo = { library, engine, programStates, instances };
}

/**
 * How a program's bindings become the references in
 * `globalState.shared.documents`. A key the demo does not know resolves to
 * null, which the program sees and can say something about.
 */
export function resolveDemoBinding(key: string, id: string): UIReference | null {
  switch (key) {
    case "product": {
      const product = productById(id);
      return product ? (productReference(product).value as UIReference) : null;
    }
    case "metal":
      return metalReference(id).value as UIReference;
    case "category":
      return categoryReference(id).value as UIReference;
    case "order":
      return orderReference(id).value as UIReference;
    default:
      return null;
  }
}

/**
 * Seed the library once with the two programs the guide uses as worked
 * examples (§3.7, §5.2). Shipped programs are `by: "human"` and pinned, so
 * the agent cannot remove them without the user's approval; a user who
 * removes them is not re-seeded, because `seeded` is sticky.
 */
export function seedLibrary(): void {
  if (library.getState().seeded) return;
  library.putProgram({
    title: "Minimal Counter",
    source: COUNTER_PROGRAM,
    bindings: [],
    meta: { declaredId: "minimal-counter", widgets: ["main"] },
    by: "human",
    pinned: true,
  });
  library.putProgram({
    title: "Days of cover",
    source: DAYS_OF_COVER_PROGRAM,
    bindings: ["product"],
    meta: { declaredId: "days-of-cover", widgets: ["main"] },
    by: "human",
    pinned: true,
  });
  library.markSeeded();
}

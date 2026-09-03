import { documentSlotPort } from "@hyperslop-systems/pbui";
import { PROGRAM_DOCUMENT_FORMAT } from "./connect";
import { defineWorkbenchApp, type AppProps, type WorkbenchApp } from "@hyperslop-systems/pbui-workbench";
import type { SandboxHost } from "./host/hostOptions";
import { PROGRAM_BINDING, ScriptTile } from "./ScriptTile";

export interface ScriptAppOptions {
  /** The launcher group; default "GENERATED". */
  group?: string;
  tone?: string;
}

/** The launcher group generated programs sit in, apart from the product's own applications. */
export const GENERATED_GROUP = "GENERATED";

/**
 * The one host application every program runs in (guide D7). Doc-bound to
 * `program`, so a tile names its program the way a `sku` tile names its
 * product: `commands.open("script", { program: "prg-7" })` twice goes to the
 * existing tile, `titleFor` reads the program's title, and nothing in
 * `pbui-workbench` changes.
 */
export function createScriptApp(host: SandboxHost, options: ScriptAppOptions = {}): WorkbenchApp {
  const { group = GENERATED_GROUP, tone = "var(--pbui-tone-widget)" } = options;
  return defineWorkbenchApp({
    // A program names its own inputs (`product`, `order`…) beyond the one
    // slot this manifest can declare, and they are per VIEW — two tiles may
    // run one program on two products — so they stay in `view.documents`
    // under `additionalBindings` (design doc 04 §9.4; formats unconstrained,
    // since an input may be any product document). The program binding
    // itself takes only program stubs.
    manifest: {
      id: "script",
      duplicatePlacement: "link",
      ports: [documentSlotPort(PROGRAM_BINDING, "the program this tile runs")],
      bindings: { [PROGRAM_BINDING]: { required: false, formats: [PROGRAM_DOCUMENT_FORMAT] } },
      additionalBindings: {},
      launch: "requires-bindings",
    },
    presentation: {
      title: "program",
      tone,
      group,
      blurb: "a program the agent wrote, running in the sandbox",
      titleFor: (view) => {
        if (view.title) return view.title;
        const id = view.documents[PROGRAM_BINDING] ?? "";
        return host.library.getState().programs[id]?.title ?? (id ? `program ${id}` : "program");
      },
      Component: (props: AppProps) => <ScriptTile placementId={props.placementId} view={props.view} host={host} />,
    },
  });
}

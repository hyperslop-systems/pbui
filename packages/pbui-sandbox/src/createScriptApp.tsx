import { documentSlotPort } from "@hyperslop-systems/pbui";
import { defineApp, type AppDescriptor, type AppProps } from "@hyperslop-systems/pbui-workbench";
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
 * product: `openView("script", { program: "prg-7" })` twice goes to the
 * existing tile, `titleFor` reads the program's title, and nothing in
 * `pbui-workbench` changes.
 */
export function createScriptApp(host: SandboxHost, options: ScriptAppOptions = {}): AppDescriptor {
  const { group = GENERATED_GROUP, tone = "var(--pbui-tone-widget)" } = options;
  return defineApp({
    id: "script",
    title: "program",
    tone,
    singleton: false,
    duplicable: false,
    ports: [documentSlotPort(PROGRAM_BINDING, "the program this tile runs")],
    group,
    blurb: "a program the agent wrote, running in the sandbox",
    titleFor: (view) => {
      if (view.title) return view.title;
      const id = view.documents[PROGRAM_BINDING] ?? "";
      return host.library.getState().programs[id]?.title ?? (id ? `program ${id}` : "program");
    },
    Component: (props: AppProps) => <ScriptTile placementId={props.placementId} view={props.view} host={host} />,
  });
}

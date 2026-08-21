import { defineApp, type AppDescriptor, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { SandboxHost } from "../host/hostOptions";
import { INSPECTOR_APP_ID, PROGRAM_BINDING } from "../ScriptTile";
import { InspectorTile } from "./InspectorTile/InspectorTile";

export interface SandboxDevtoolsOptions {
  /** The launcher group; default "SANDBOX". */
  group?: string;
  tone?: string;
}

export const SANDBOX_GROUP = "SANDBOX";

/**
 * The devtools as ordinary app descriptors (guide D8): register them beside
 * `createScriptApp(host)`. Marks `host.devtools` so the script tile shows
 * its inspect/source buttons — the same host object must be passed to both.
 */
export function createSandboxDevtools(host: SandboxHost, options: SandboxDevtoolsOptions = {}): AppDescriptor[] {
  const { group = SANDBOX_GROUP, tone = "var(--pbui-tone-widget)" } = options;
  host.devtools = true;
  const titleOf = (view: { documents: Record<string, string>; title?: string }, prefix: string) => {
    if (view.title) return view.title;
    const id = view.documents[PROGRAM_BINDING] ?? "";
    return `${prefix} · ${host.library.getState().programs[id]?.title ?? (id || "program")}`;
  };
  return [
    defineApp({
      id: INSPECTOR_APP_ID,
      title: "inspector",
      tone,
      singleton: false,
      docBound: true,
      duplicable: false,
      bindings: [PROGRAM_BINDING],
      group,
      blurb: "a running program's state, bindings, render tree and timings",
      titleFor: (view) => titleOf(view, "inspect"),
      Component: (props: AppProps) => <InspectorTile placementId={props.placementId} view={props.view} host={host} />,
    }),
  ];
}

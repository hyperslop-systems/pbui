import { defineApp, type AppDescriptor, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { SandboxHost } from "../host/hostOptions";
import { INSPECTOR_APP_ID, PROGRAM_BINDING } from "../ScriptTile";
import { InspectorTile } from "./InspectorTile/InspectorTile";
import { ReplTile } from "./ReplTile/ReplTile";
import { TimelineTile } from "./TimelineTile/TimelineTile";
import { PlaygroundTile } from "./PlaygroundTile/PlaygroundTile";
import { createPlaygroundStore, type PlaygroundStore } from "./playgroundStore";

export interface SandboxDevtoolsOptions {
  /** The launcher group; default "SANDBOX". */
  group?: string;
  tone?: string;
  /** Where the playground keeps its draft; default "pbui-sandbox.playground". Give each product its own. */
  playgroundKey?: string;
  /** A prepared store instead of one under `playgroundKey` (tests, non-browser hosts). */
  playground?: PlaygroundStore;
}

export const SANDBOX_GROUP = "SANDBOX";
export const REPL_APP_ID = "sandbox-repl";
export const TIMELINE_APP_ID = "sandbox-timeline";
export const PLAYGROUND_APP_ID = "sandbox-playground";

/**
 * The devtools as ordinary app descriptors (guide D8): register them beside
 * `createScriptApp(host)`. Marks `host.devtools` so the script tile shows
 * its inspect/source buttons — the same host object must be passed to both.
 */
export function createSandboxDevtools(host: SandboxHost, options: SandboxDevtoolsOptions = {}): AppDescriptor[] {
  const { group = SANDBOX_GROUP, tone = "var(--pbui-tone-widget)" } = options;
  host.devtools = true;
  const playground = options.playground ?? createPlaygroundStore({ key: options.playgroundKey ?? "pbui-sandbox.playground" });
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
    defineApp({
      id: REPL_APP_ID,
      title: "REPL",
      tone,
      singleton: true,
      group,
      blurb: "evaluate and inject code inside the selected program",
      Component: (props: AppProps) => <ReplTile placementId={props.placementId} view={props.view} host={host} />,
    }),
    defineApp({
      id: TIMELINE_APP_ID,
      title: "timeline",
      tone,
      singleton: true,
      group,
      blurb: "every load, render, event, intent and error across running programs",
      Component: (props: AppProps) => <TimelineTile placementId={props.placementId} view={props.view} host={host} />,
    }),
    defineApp({
      id: PLAYGROUND_APP_ID,
      title: "playground",
      tone,
      singleton: true,
      group,
      blurb: "write a program by hand, run it live, save it into the library",
      Component: (props: AppProps) => <PlaygroundTile placementId={props.placementId} view={props.view} host={host} store={playground} />,
    }),
  ];
}

import { documentSlotPort } from "@hyperslop-systems/pbui";
import { defineApp, type AppDescriptor, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { PLOT_BINDING, type PlotScriptHost } from "./host";
import { PlotTile } from "./PlotTile";
import { ScriptTile } from "./ScriptTile";

export const SCRIPT_APP_ID = "plot-script";
export const PLOT_APP_ID = "plot-view";

/**
 * Two applications, not one (design D6): the user can close the editor and
 * keep the plot, put them in different workspaces, or link a second plot to
 * the same script. Both are doc-bound to `plot`, which `describeWorkbench`
 * reports so an agent asked to open one knows what to bind.
 */
export function createPlotScriptApps(host: PlotScriptHost): AppDescriptor[] {
  const titleFor = (kind: string) => (view: AppView) => (view.documents[PLOT_BINDING] ? `${kind} · ${view.documents[PLOT_BINDING]}` : kind);
  return [
    defineApp({
      id: SCRIPT_APP_ID,
      title: "script",
      blurb: "a JavaScript plot script, run as you type",
      tone: "var(--pbui-tone-field)",
      singleton: false,
      ports: [documentSlotPort(PLOT_BINDING, "the plot script this tile is a view of")],
      titleFor: titleFor("script"),
      Component: (props: AppProps) => <ScriptTile {...props} host={host} />,
    }),
    defineApp({
      id: PLOT_APP_ID,
      title: "plot",
      blurb: "the plot a script returns",
      tone: "var(--pbui-cat-3)",
      singleton: false,
      ports: [documentSlotPort(PLOT_BINDING, "the plot script this tile is a view of")],
      titleFor: titleFor("plot"),
      Component: (props: AppProps) => <PlotTile {...props} host={host} />,
    }),
  ];
}

import {
  createWorkbenchCore,
  createWorkbenchLinks,
  describeWorkbench,
  isWorkbenchCommand,
  type CreateWorkbenchCoreOptions,
  type ExecuteResult,
  type GeometrySnapshot,
  type WorkbenchCommand,
  type WorkbenchCore,
  type WorkbenchLinks,
} from "@hyperslop-systems/workbench-core";
import type { LinkDeps } from "@hyperslop-systems/pbui";
import { createPresentationRegistry, labelOfView, manifestsOf, type AppPresentation, type PresentationRegistry, type WorkbenchApp } from "./app";
import { WorkbenchLauncher } from "./components/Launcher";
import { RebalanceStatusBadge } from "./components/RebalanceBadge";
import { WorkbenchRebalance } from "./components/RebalanceDialog";
import { WorkbenchSurface } from "./components/Surface";
import { WorkspaceStrip } from "./components/WorkspaceStrip";
import { WorkbenchContext } from "./context";
import { measureGeometry } from "./geometry";
import { createPlacementController } from "./placement";
import { createShellStore, isWorkbenchShellAction, useShellState } from "./shellState";
import type { LauncherProps, RebalanceProps, SurfaceProps, WorkbenchShell, WorkspaceStripProps } from "./types";
import type { RebalanceBadgeProps } from "./components/RebalanceBadge";
import { useSyncExternalStore } from "react";

export interface CreateWorkbenchShellOptions {
  core: WorkbenchCore;
  /** The React projections of the core's applications — a list of apps or presentations, or a registry. */
  apps: readonly (WorkbenchApp | AppPresentation)[] | PresentationRegistry;
}

/** Commands whose planning reads geometry; everything else executes without a DOM measurement. */
function needsGeometry(commands: readonly WorkbenchCommand[]): boolean {
  return commands.some((command) => {
    switch (command.kind) {
      case "placement.duplicate":
      case "placement.dock":
      case "placement.resize":
      case "view.show":
      case "workspace.create":
      case "show":
        return true;
      default:
        return false;
    }
  });
}

/**
 * The React shell over a core (guide §16.3, §14.1): bound components,
 * the shell-local store, placement mode, focus, and measurement. The shell
 * never constructs semantic handlers; components call `execute(command)`
 * and interpret the small result.
 */
export function createWorkbenchShell(options: CreateWorkbenchShellOptions): WorkbenchShell {
  const { core } = options;
  const links = core.links;
  if (!links) throw new Error("pbui-workbench: the shell's tiles read ports; pass `links: createWorkbenchLinks()` to createWorkbenchCore");
  const apps = isRegistry(options.apps) ? options.apps : createPresentationRegistry(options.apps);
  for (const presentation of apps.list()) {
    if (!core.apps.get(presentation.id)) throw new Error(`pbui-workbench: application "${presentation.id}" has a presentation but no manifest in the core`);
  }
  const shell = createShellStore();
  const placement = createPlacementController();
  let rootElement: HTMLElement | null = null;
  const root = () => rootElement;
  const measure = () => measureGeometry(rootElement);

  const execute = (input: WorkbenchCommand | readonly WorkbenchCommand[]): ExecuteResult => {
    const commands = Array.isArray(input) ? (input as readonly WorkbenchCommand[]) : [input as WorkbenchCommand];
    const geometry: GeometrySnapshot | null = needsGeometry(commands) ? measure() : null;
    const result = core.execute(commands, geometry ? { geometry } : {});
    // Several targets tie for a show: the chooser, never a guess. The
    // command is kept so a row re-executes it with the chosen candidate.
    if (!result.ok && result.code === "ambiguous" && result.choices && commands.length === 1 && commands[0]!.kind === "show") {
      shell.dispatch({ kind: "show.chooser.open", command: commands[0] as Extract<WorkbenchCommand, { kind: "show" }>, choices: result.choices });
    }
    return result;
  };

  const workbench: WorkbenchShell = {
    core,
    apps,
    shell,
    links,
    placement,
    useDocument: () => useSyncExternalStore(core.subscribe, () => core.getState().document, () => core.getState().document),
    useCoreState: (selector) => useSyncExternalStore(core.subscribe, () => selector(core.getState()), () => selector(core.getState())),
    useShellState: (selector) => useShellState(shell, selector),
    execute,
    preview: (input) => {
      const commands = Array.isArray(input) ? (input as readonly WorkbenchCommand[]) : [input as WorkbenchCommand];
      const geometry = needsGeometry(commands) ? measure() : null;
      return core.preview(commands, geometry ? { geometry } : {});
    },
    dispatch: (action) => shell.dispatch(action),
    perform(verb) {
      if (isWorkbenchShellAction(verb)) {
        shell.dispatch(verb);
        return true;
      }
      if (!isWorkbenchCommand(verb)) return false;
      const result = execute(verb);
      // An ambiguous show opened the chooser: the gesture was handled.
      return result.ok || (result.code === "ambiguous" && verb.kind === "show");
    },
    apply: (mutations) => core.apply(mutations),
    serialize: () => core.serialize(),
    restore: (json) => core.restore(json).ok,
    reset: (factory) => core.reset(factory).ok,
    activePlacementId: () => core.getState().session.activePlacementId,
    linkSnapshot: () => links.snapshot(core.getState().document),
    root,
    setRoot: (element) => {
      rootElement = element;
    },
    measure,
    focusPlacement(placementId) {
      // A frame later: the command has committed the document but React has
      // not rendered the new tile yet, so the element does not exist on this tick.
      const focus = () => {
        const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(placementId) : placementId.replace(/"/g, '\\"');
        const frame = (rootElement ?? globalThis.document)?.querySelector(`[data-placement-id="${escaped}"]`);
        // The tile CELL, not the application inside it: the cell is
        // programmatically focusable only, so Tab then moves into the app.
        const cell = frame?.closest<HTMLElement>('[data-part="workbench-tile"]');
        cell?.focus?.();
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
      else setTimeout(focus, 0);
    },
    describe(describeOptions = {}) {
      const { geometry, ...rest } = describeOptions;
      return describeWorkbench(core, {
        ...rest,
        presentations: (appId) => apps.get(appId),
        geometry: geometry ? measure() : null,
      });
    },
    Surface: function Surface(props: SurfaceProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkbenchSurface {...props} />
        </WorkbenchContext.Provider>
      );
    },
    Launcher: function Launcher(props: LauncherProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkbenchLauncher {...props} />
        </WorkbenchContext.Provider>
      );
    },
    WorkspaceStrip: function Strip(props: WorkspaceStripProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkspaceStrip {...props} />
        </WorkbenchContext.Provider>
      );
    },
    Rebalance: function Rebalance(props: RebalanceProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkbenchRebalance {...props} />
        </WorkbenchContext.Provider>
      );
    },
    RebalanceBadge: function Badge(props: RebalanceBadgeProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <RebalanceStatusBadge {...props} />
        </WorkbenchContext.Provider>
      );
    },
  };
  return workbench;
}

function isRegistry(value: readonly (WorkbenchApp | AppPresentation)[] | PresentationRegistry): value is PresentationRegistry {
  return !Array.isArray(value) && typeof (value as PresentationRegistry).get === "function";
}

export interface CreateWorkbenchOptions extends Omit<CreateWorkbenchCoreOptions, "apps" | "links"> {
  /** The applications, each declared once with `defineWorkbenchApp`. */
  apps: readonly WorkbenchApp[];
  /**
   * Tile linking: the link kernel's dependencies (a product with a compiled
   * presentation passes `presentation.linkDeps(...)`), or a collaborator
   * built with `createWorkbenchLinks`. Absent ⇒ the graph is what the
   * manifests' ports declare (equal ids and `<any>` reach).
   */
  links?: LinkDeps | WorkbenchLinks;
}

/**
 * The convenience the samples and most products use (guide §8.3): one call
 * that builds the core over the manifests and the shell over the
 * presentations. Labels for badges come from the presentations; a refused
 * command is reported to the console unless `onRefused` says otherwise.
 */
export function createWorkbench(options: CreateWorkbenchOptions): WorkbenchShell {
  const { apps, links: linkOption, ...coreOptions } = options;
  const presentations = createPresentationRegistry(apps);
  const labels = {
    view: (view: Parameters<typeof labelOfView>[0]) => labelOfView(view, presentations.get(view.appId)),
    app: (appId: string) => presentations.get(appId)?.title ?? appId,
  };
  const links = linkOption && "runtime" in linkOption ? linkOption : createWorkbenchLinks({ ...(linkOption ? { deps: linkOption } : {}), labels });
  const core = createWorkbenchCore({
    ...coreOptions,
    apps: manifestsOf(apps),
    links,
    onRefused: coreOptions.onRefused ?? ((command, code, because) => console.warn(`pbui-workbench: refused ${command.kind} — ${because} (${code})`)),
  });
  return createWorkbenchShell({ core, apps: presentations });
}

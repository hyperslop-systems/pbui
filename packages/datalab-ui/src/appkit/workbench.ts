import {
  createWorkbenchShell,
  type WorkbenchApp,
  type WorkbenchShell,
} from "@hyperslop-systems/pbui-workbench";
import { createManifestCatalog, type LayoutSpec } from "@hyperslop-systems/workbench-core";
import {
  createDatalabRuntime,
  type DatalabRuntime,
  type DatalabRuntimeOptions,
} from "../store/runtime";
import { defaultSeed, singleStageSeed, type DatalabSeed } from "../store/seed";
import { datalabWorkbenchApps } from "./workbenchApps";

/**
 * One Datalab workbench, React side (design §5.4, §9.3): the headless
 * runtime plus the pbui-workbench shell over its core. `WorkbenchInstance`
 * and the product's `Product` route each build ONE of these, in a ref, and
 * hand it to `DatalabWorkbenchProvider`; nothing about it is module-global.
 *
 * The shell's `execute` measures the mounted Surface before a command that
 * needs geometry (a split along the longer axis, a dock), so the controller
 * runs through it rather than through `core.execute` directly.
 */
export interface DatalabWorkbench extends DatalabRuntime {
  shell: WorkbenchShell;
  apps: readonly WorkbenchApp[];
}

export interface CreateDatalabWorkbenchOptions
  extends Omit<DatalabRuntimeOptions, "seed" | "apps" | "executor"> {
  /** The starting layout; default: the product's default seed (pinned stages and the work stage). */
  seed?: DatalabSeed;
  /** The applications; default: every registered one. */
  apps?: readonly WorkbenchApp[];
}

export function createDatalabWorkbench(
  options: CreateDatalabWorkbenchOptions = {},
): DatalabWorkbench {
  const apps = options.apps ?? datalabWorkbenchApps();
  const manifests = createManifestCatalog(apps.map((app) => app.manifest));
  const seed =
    options.seed ?? defaultSeed({ apps: manifests, ...(options.ids ? { ids: options.ids } : {}) });
  let shell: WorkbenchShell | null = null;
  const runtime = createDatalabRuntime({
    ...options,
    seed,
    apps: manifests,
    onRefused:
      options.onRefused ??
      ((command, code, because) =>
        console.warn(`datalab: refused ${command.kind} — ${because} (${code})`)),
    executor(core) {
      shell = createWorkbenchShell({ core, apps });
      return shell.execute;
    },
  });
  if (!shell) throw new Error("datalab: the shell was not built");
  return { ...runtime, shell, apps };
}

/** The product's default seed over the registered applications. */
export function datalabDefaultSeed(): DatalabSeed {
  return defaultSeed({
    apps: createManifestCatalog(datalabWorkbenchApps().map((app) => app.manifest)),
  });
}

/**
 * One workspace on one freshly-minted stage, over the registered
 * applications — what every embedded instance and every story seeds.
 * `allowed` narrows the stage's application list.
 */
export function datalabSingleStageSeed(
  name: string,
  spec: LayoutSpec,
  allowed: string[] | null = null,
): DatalabSeed {
  return singleStageSeed(name, spec, {
    apps: createManifestCatalog(datalabWorkbenchApps().map((app) => app.manifest)),
    allowed,
  });
}

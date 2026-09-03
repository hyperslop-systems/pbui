import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import {
  applyMutations,
  newId,
  type IdGenerator,
} from "@hyperslop-systems/workbench-protocol/client";
import {
  buildLayout,
  emptyDocument,
  split,
  tile,
  workspaceCreateMutation,
  type LayoutSpec,
  type ManifestCatalog,
} from "@hyperslop-systems/workbench-core";
import { WELCOME_DOC_IDS } from "../demo/welcome";
import { graphicStubMutation } from "./graphicSource";
import {
  emptyNavigation,
  type NavigationState,
  type StageChrome,
  type StageDefinition,
  type WorkspaceMeta,
} from "./navigation";
import {
  ACCOUNT_SPACE_ID,
  ACCOUNT_STAGE_ID,
  DEMO_SPACE_IDS,
  SIGNIN_SPACE_ID,
  SIGNIN_STAGE_ID,
  TEMPLATES_SPACE_ID,
  TOUR_SPACE_IDS,
  WELCOME_SPACE_ID,
  WELCOME_STAGE_ID,
  WORK_STAGE_ID,
} from "./stageIds";

/**
 * The seed compiler (design §7): product-friendly stage and workspace
 * definitions in, ONE workbench document plus navigation metadata out.
 *
 * Built through the protocol — `buildLayout` issues the same `viewCreate`
 * mutations a user would, `workspaceCreateMutation` the same
 * `workspaceCreate` — so whatever the applier accepts here is exactly what a
 * server running pkg/workbench would accept. There is no second tree model.
 *
 * ## Singletons are carried ACROSS workspaces (§7.2)
 *
 * The pinned layouts deliberately place the same singleton logical view in
 * several workspaces: `sources` is in the welcome page, in tour 1, in demo 7
 * and in `explore`. A call to `buildLayout` per workspace would mint a
 * second `sources` view and the core would refuse the document as
 * `duplicate_singleton` — or, worse, an older validator would accept four
 * unrelated tiles. The compiler threads `existingViewsByAppId` through every
 * workspace in document order, exactly as `workspace.create` does for one.
 *
 * ## Bound documents get identity stubs
 *
 * The welcome workspaces bind versioned demo documents the world may not hold
 * yet. The core validates every binding against its document store, so the
 * compiler writes an identity stub for every bound id (`graphicSource.ts`).
 */

export interface WorkspaceSeed {
  /** Fixed for a pinned workspace; minted otherwise. */
  id?: string;
  name: string;
  stageId: string;
  pinned?: boolean;
  apps?: string[] | null;
  spec: LayoutSpec;
}

export interface SeedInput {
  stages: StageDefinition[];
  workspaces: WorkspaceSeed[];
  /** The application catalog, for which applications are singletons. */
  apps: ManifestCatalog;
  /** Deterministic ids for tests and goldens; default `newId`. */
  ids?: IdGenerator;
  documentId?: string;
  documentName?: string;
  /** The workspace to start on, by id; default the first workspace of the first stage listed under `remembered`, else the first workspace. */
  current?: string;
  /** Per stage, the workspace it starts remembering; default its first. */
  remembered?: Record<string, string>;
}

export interface DatalabSeed {
  document: WorkbenchDocument;
  navigation: NavigationState;
  /** The workspace the core starts on. */
  workspaceId: string;
}

export function compileSeed(input: SeedInput): DatalabSeed {
  const ids = input.ids ?? newId;
  const singletonAppIds = new Set(
    input.apps
      .list()
      .filter((app) => app.viewCardinality === "one")
      .map((app) => app.id),
  );
  const existingViewsByAppId = new Map<string, string>();
  const mutations = [];
  const boundDocumentIds = new Set<string>();
  const workspace: Record<string, WorkspaceMeta> = {};
  const workspaceIds: string[] = [];
  const stageIds = new Set(input.stages.map((stage) => stage.id));

  for (const seed of input.workspaces) {
    if (!stageIds.has(seed.stageId))
      throw new Error(
        `datalab: workspace "${seed.name}" names a stage "${seed.stageId}" the seed does not define`,
      );
    const built = buildLayout(seed.spec, { singletonAppIds, existingViewsByAppId, ids });
    for (const view of built.views) {
      if (singletonAppIds.has(view.appId) && !existingViewsByAppId.has(view.appId))
        existingViewsByAppId.set(view.appId, view.viewId);
    }
    for (const id of boundIn(seed.spec)) boundDocumentIds.add(id);
    const id = seed.id ?? ids("ws");
    if (workspace[id]) throw new Error(`datalab: workspace id "${id}" is used twice in the seed`);
    mutations.push(...built.mutations, workspaceCreateMutation(id, seed.name, built.tree));
    workspace[id] = {
      stageId: seed.stageId,
      pinned: seed.pinned === true,
      apps: seed.apps ?? null,
    };
    workspaceIds.push(id);
  }

  const stubs = [...boundDocumentIds].map(graphicStubMutation);
  const document = applyMutations(
    emptyDocument({
      id: input.documentId ?? "datalab",
      name: input.documentName ?? "Datalab",
      ids,
    }),
    [...stubs, ...mutations],
  );

  const rememberedWorkspaceByStage: Record<string, string> = {};
  for (const stage of input.stages) {
    const own = workspaceIds.filter((id) => workspace[id]?.stageId === stage.id);
    const wanted = input.remembered?.[stage.id];
    const chosen = wanted && own.includes(wanted) ? wanted : own[0];
    if (chosen) rememberedWorkspaceByStage[stage.id] = chosen;
  }
  const workspaceId =
    input.current && workspace[input.current] ? input.current : (workspaceIds[0] ?? "");

  return {
    document,
    navigation: {
      ...emptyNavigation(),
      stages: input.stages,
      workspace,
      rememberedWorkspaceByStage,
    },
    workspaceId,
  };
}

function boundIn(spec: LayoutSpec, into: string[] = []): string[] {
  if (spec.kind === "tile") {
    for (const id of Object.values(spec.documents ?? {})) into.push(id);
    return into;
  }
  boundIn(spec.a, into);
  boundIn(spec.b, into);
  return into;
}

/* --------------------------------------------------- the pinned stages -- */

/**
 * The applications the welcome stage offers: the welcome and tutorial panes,
 * plus the four document-bound applications the tutorials drive, plus the
 * two doors (DATADROP-14: convert from where you are).
 */
const WELCOME_APPS = [
  "about",
  "tut1",
  "tut2",
  "tut3",
  "tut4",
  "lessons",
  "cheat",
  "modules",
  "brief",
  "sources",
  "inspector",
  "chart",
  "table",
  "pipeline",
  "encode",
  "launcher",
  "signin",
  "signup",
] as const;

/** Account surfaces, and nothing that reads a document. */
const ACCOUNT_APPS = ["profile", "tokens", "upload", "templates", "about", "launcher"] as const;

const FULL_CHROME: StageChrome = { masthead: true, workspaces: true, stageBar: true };

const chart = (docId: string, title: string) =>
  tile("chart", { documents: { primary: docId }, title });
const bound = (app: string, docId: string, title: string) =>
  tile(app, { documents: { primary: docId }, title });

/**
 * The hardwired stages (DATADROP-8 DR-59) and their workspaces, as
 * definitions. Fixed ids, not minted, which is what lets a stored layout be
 * matched against this build on every load. A code-defined stage and its
 * code-defined workspaces are taken wholesale from source; everything else
 * comes from storage. The one thing a pinned stage keeps from storage is
 * which workspace it was last on (DR-60), and that lives in navigation
 * metadata rather than in the definition.
 */
export function pinnedDefinitions(): { stages: StageDefinition[]; workspaces: WorkspaceSeed[] } {
  const stages: StageDefinition[] = [
    {
      id: SIGNIN_STAGE_ID,
      name: "sign in",
      apps: ["signin", "signup", "about"],
      // One workspace, so no strip; the stage bar is what gives a signed-out
      // visitor a route back to `welcome` after deciding not to sign in.
      chrome: { masthead: true, workspaces: false, stageBar: true },
      pinned: true,
      audience: "anonymous",
    },
    {
      id: WELCOME_STAGE_ID,
      name: "welcome",
      apps: [...WELCOME_APPS],
      chrome: { ...FULL_CHROME },
      pinned: true,
      // The one stage both sides of the door share.
      audience: "any",
    },
    {
      id: ACCOUNT_STAGE_ID,
      name: "account",
      apps: [...ACCOUNT_APPS],
      chrome: { ...FULL_CHROME },
      pinned: true,
      audience: "authenticated",
    },
    {
      id: WORK_STAGE_ID,
      name: "work",
      // Everything: the only stage with no allow-list at all.
      apps: null,
      chrome: { ...FULL_CHROME },
      pinned: true,
      audience: "authenticated",
    },
  ];

  const workspaces: WorkspaceSeed[] = [
    {
      id: SIGNIN_SPACE_ID,
      name: "sign in",
      stageId: SIGNIN_STAGE_ID,
      pinned: true,
      spec: split("row", 0.4, tile("signin"), split("col", 0.6, tile("signup"), tile("about"))),
    },
    {
      id: WELCOME_SPACE_ID,
      name: "start here",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split(
        "row",
        0.62,
        split(
          "col",
          0.52,
          chart(WELCOME_DOC_IDS.temperature, "Temperature by station"),
          chart(WELCOME_DOC_IDS.yieldByLine, "Yield by production line"),
        ),
        split(
          "col",
          0.54,
          chart(WELCOME_DOC_IDS.populationBars, "Population by region"),
          split(
            "col",
            0.45,
            tile("sources"),
            bound("table", WELCOME_DOC_IDS.populationBars, "Regional totals"),
          ),
        ),
      ),
    },
    {
      id: TOUR_SPACE_IDS[0],
      name: "1·objects",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split(
        "row",
        0.44,
        tile("tut1"),
        split("col", 0.55, tile("sources"), tile("inspector")),
      ),
    },
    {
      id: TOUR_SPACE_IDS[1],
      name: "2·pipeline",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split("row", 0.42, tile("tut2"), split("col", 0.5, tile("pipeline"), tile("table"))),
    },
    {
      id: TOUR_SPACE_IDS[2],
      name: "3·encode",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split("row", 0.42, tile("tut3"), split("col", 0.45, tile("encode"), tile("chart"))),
    },
    {
      id: TOUR_SPACE_IDS[3],
      name: "4·docs",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split("row", 0.42, tile("tut4"), split("col", 0.55, tile("charts"), tile("gallery"))),
    },
    {
      id: DEMO_SPACE_IDS[0],
      name: "5·climate",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split(
        "col",
        0.7,
        split(
          "row",
          0.5,
          chart(WELCOME_DOC_IDS.temperature, "Temperature by station"),
          chart(WELCOME_DOC_IDS.humidity, "Humidity by station"),
        ),
        split(
          "row",
          0.56,
          bound("pipeline", WELCOME_DOC_IDS.temperature, "Climate pipeline"),
          bound("table", WELCOME_DOC_IDS.temperature, "Climate readings"),
        ),
      ),
    },
    {
      id: DEMO_SPACE_IDS[1],
      name: "6·operations",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split(
        "row",
        0.72,
        split(
          "col",
          0.5,
          chart(WELCOME_DOC_IDS.yieldByLine, "Yield by line · 85% target"),
          chart(WELCOME_DOC_IDS.massYield, "Mass versus yield"),
        ),
        split(
          "col",
          0.45,
          bound("encode", WELCOME_DOC_IDS.yieldByLine, "Yield encoding"),
          bound("table", WELCOME_DOC_IDS.massYield, "Production batches"),
        ),
      ),
    },
    {
      id: DEMO_SPACE_IDS[2],
      name: "7·compare",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      spec: split(
        "col",
        0.7,
        split(
          "row",
          0.23,
          tile("sources"),
          split(
            "row",
            0.5,
            chart(WELCOME_DOC_IDS.populationScatter, "Population and land area"),
            chart(WELCOME_DOC_IDS.populationBars, "Population by region"),
          ),
        ),
        split(
          "row",
          0.46,
          tile("inspector"),
          bound("table", WELCOME_DOC_IDS.populationScatter, "Regional census"),
        ),
      ),
    },
    {
      id: ACCOUNT_SPACE_ID,
      name: "profile",
      stageId: ACCOUNT_STAGE_ID,
      pinned: true,
      spec: split("row", 0.38, tile("profile"), split("col", 0.55, tile("tokens"), tile("upload"))),
    },
    {
      id: TEMPLATES_SPACE_ID,
      name: "templates",
      stageId: ACCOUNT_STAGE_ID,
      pinned: true,
      // One tile: the library is a table with a detail pane and wants the width.
      spec: tile("templates"),
    },
  ];

  return { stages, workspaces };
}

/**
 * The work stage's four starting workspaces. NOT pinned: a starting point
 * the user owns — renameable, deletable, never re-created behind their back.
 * `build` is the daily cockpit: pipeline and encoding on the left, chart and
 * table on the right.
 */
export function workDefinitions(): WorkspaceSeed[] {
  const work = (name: string, spec: LayoutSpec): WorkspaceSeed => ({
    name,
    stageId: WORK_STAGE_ID,
    spec,
  });
  return [
    work(
      "build",
      split(
        "row",
        0.4,
        split("col", 0.55, tile("pipeline"), tile("encode")),
        split("col", 0.6, tile("chart"), tile("table")),
      ),
    ),
    work(
      "explore",
      split("row", 0.34, tile("sources"), split("col", 0.6, tile("chart"), tile("inspector"))),
    ),
    work(
      "gallery",
      split("row", 0.4, tile("charts"), split("col", 0.5, tile("gallery"), tile("compare"))),
    ),
    work(
      "help",
      split("row", 0.55, tile("about"), split("col", 0.45, tile("watch"), tile("trace"))),
    ),
  ];
}

export interface SeedOptions {
  apps: ManifestCatalog;
  ids?: IdGenerator;
}

/** The default layout: the four pinned stages, their workspaces, and the work stage's four user-owned ones; a signed-in user lands on `build`. */
export function defaultSeed(options: SeedOptions): DatalabSeed {
  const pinned = pinnedDefinitions();
  const ids = options.ids ?? newId;
  const buildId = ids("ws");
  const work = workDefinitions();
  work[0] = { ...work[0]!, id: buildId };
  return compileSeed({
    stages: pinned.stages,
    workspaces: [...pinned.workspaces, ...work],
    apps: options.apps,
    ids,
    current: buildId,
    remembered: { [WORK_STAGE_ID]: buildId },
  });
}

/**
 * One workspace on one freshly-minted stage: what every embedded instance and
 * every story that seeds a layout wants. `stageBar: false` because one stage
 * offers no choice; `masthead: false` because the embedding page has its own.
 */
export function singleStageSeed(
  name: string,
  spec: LayoutSpec,
  options: SeedOptions & { allowed?: string[] | null },
): DatalabSeed {
  const ids = options.ids ?? newId;
  const stageId = ids("stage");
  const workspaceId = ids("ws");
  return compileSeed({
    stages: [
      {
        id: stageId,
        name,
        apps: options.allowed ?? null,
        chrome: { masthead: false, workspaces: true, stageBar: false },
      },
    ],
    workspaces: [{ id: workspaceId, name, stageId, spec }],
    apps: options.apps,
    ids,
    current: workspaceId,
  });
}

/** Re-exported so seed authors need one import. */
export { split, tile };
export type { LayoutSpec };

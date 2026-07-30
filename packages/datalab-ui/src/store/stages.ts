import {
  createLayoutBuilder,
  split,
  type AppId,
  type AppView,
  type LayoutBuilder,
  type LayoutState,
  type Node,
  type Stage,
  type StageId,
  type ViewId,
  type Workspace,
} from "./layout";
import { WELCOME_DOC_IDS } from "../demo/welcome";
import { newId } from "./world";

/**
 * The hardwired stages (DATADROP-8 DR-59), and the workspaces that belong to
 * them.
 *
 * This file was `spaces.ts`. It defined two hardwired *workspaces* —
 * `ws-welcome` (sign in beside about) and `ws-account` (profile, tokens,
 * upload) — that sat in the same strip as the user's own and had to be
 * explained by a tooltip. They were always stages: `Workbench.tsx` had to
 * *force* the current workspace to one of them twice, an application forcing a
 * layout value, because there was no layer at which "which part of the product
 * am I in" could be said.
 *
 * Fixed ids, not `newId()`, which is what lets `mergeStages` match them across
 * reloads.
 *
 * ## What "hardwired" costs and buys
 *
 * A code-defined stage and its code-defined workspaces are taken wholesale from
 * source on every load; everything else comes from storage. A user who deleted
 * a tile from the account stage in a previous release gets it back; a user who
 * *added* one loses it. That asymmetry is the whole meaning of the word and is
 * the same rule `spaces.ts` stated.
 *
 * The one field a pinned stage keeps from storage is `currentSpaceId`, because
 * that is a memory of where the user was rather than a definition of what the
 * stage is (DR-60). Taking it from source too would reset the account stage to
 * its first workspace on every reload.
 */

export const SIGNIN_STAGE_ID: StageId = "stage-signin";
export const WELCOME_STAGE_ID: StageId = "stage-welcome";
export const ACCOUNT_STAGE_ID: StageId = "stage-account";
export const WORK_STAGE_ID: StageId = "stage-work";

/** The sign-in stage's single workspace. */
export const SIGNIN_SPACE_ID = "ws-signin";
/**
 * Where a signed-out visitor lands (DATADROP-14).
 *
 * The welcome stage's first workspace, ahead of the four tutorial ones: a
 * stranger who has just arrived wants to see the product work on real data, not
 * to be dropped into lesson one. The tutorials stay one click away in the
 * workspace strip.
 */
export const WELCOME_SPACE_ID = "ws-welcome";
/** The welcome stage's four tutorial workspaces. */
export const TOUR_SPACE_IDS = ["ws-tour-1", "ws-tour-2", "ws-tour-3", "ws-tour-4"] as const;
/** Finished product demonstrations, after the four teaching workspaces. */
export const DEMO_SPACE_IDS = ["ws-demo-5", "ws-demo-6", "ws-demo-7"] as const;
/** The account stage's workspaces. */
export const ACCOUNT_SPACE_ID = "ws-account";
/**
 * The templates workspace, which the stage menu's "templates …" opens.
 *
 * On the account stage rather than anywhere else because that is what the
 * request asked for: "a button on the top right that is used to manage account,
 * stored workspace templates, etc." The button is the stage menu, and account
 * management is a stage.
 */
export const TEMPLATES_SPACE_ID = "ws-templates";

/**
 * The applications the welcome stage offers.
 *
 * "The welcome global workspace has the welcome + tutorial panes available",
 * plus the four document-bound applications the tutorials actually drive — a
 * tutorial that says "map a field to y" needs an encoding tile to say it about.
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
  // DATADROP-14: convert from where you are.
  //
  // A visitor who has just built a chart out of the stock dataset is the most
  // likely person in the product to want an account, and making them find a
  // different stage first is how you lose them. `signup` is registered in
  // phase 6; an id here that no application claims is simply not offered, so
  // listing it early costs nothing.
  "signin",
  "signup",
] as const;

/** Account surfaces, and nothing that reads a document. */
const ACCOUNT_APPS = ["profile", "tokens", "upload", "templates", "about", "launcher"] as const;

const FULL_CHROME = { masthead: true, workspaces: true, stageBar: true } as const;

const demoLeaf = (builder: LayoutBuilder, app: AppId, docId: string, label: string): Node =>
  builder.leaf(app, docId, label);

export function pinnedStages(builder: LayoutBuilder = createLayoutBuilder()): {
  stages: Stage[];
  spaces: Workspace[];
  views: Record<string, AppView>;
  viewOrder: string[];
} {
  const leaf = builder.leaf.bind(builder);
  const singleton = builder.singleton.bind(builder);
  const stages: Stage[] = [
    {
      id: SIGNIN_STAGE_ID,
      name: "sign in",
      // "A login global workspace that only has help and sign in" — plus the
      // sign-up tile, which is the same door from the other side (DATADROP-14).
      // `signup` is registered in phase 6; an id no application claims is
      // simply not offered.
      apps: ["signin", "signup", "about"],
      // No stage bar. A visitor who is not signed in must not be offered a
      // switcher to a stage whose every tile would show 401 — the same
      // reasoning as the signed-out gate itself (DATADROP-5 DR-31): one gate at
      // the top rather than a check per tile.
      // DATADROP-14: the stage bar now offers this one, so it is no longer only
      // somewhere the gate puts you. `workspaces: false` stays — it has exactly
      // one workspace — and `stageBar: true` is what gives a signed-out visitor
      // a route back to `welcome` after deciding not to sign in.
      chrome: { masthead: true, workspaces: false, stageBar: true },
      currentSpaceId: SIGNIN_SPACE_ID,
      pinned: true,
      // Meaningless once you are signed in, so it disappears rather than
      // sitting in the switcher offering to sign you in again (DR-94).
      audience: "anonymous",
    },
    {
      id: WELCOME_STAGE_ID,
      name: "welcome",
      apps: [...WELCOME_APPS],
      chrome: { ...FULL_CHROME },
      // Where an anonymous visitor lands, ahead of the tutorials.
      currentSpaceId: WELCOME_SPACE_ID,
      pinned: true,
      // No audience: the one stage both sides of the door share. That is the
      // whole shape of DATADROP-14 — a stranger and a signed-in user look at
      // the same welcome stage, and the only difference is what else they can
      // reach from it.
      audience: "any",
    },
    {
      id: ACCOUNT_STAGE_ID,
      name: "account",
      apps: [...ACCOUNT_APPS],
      chrome: { ...FULL_CHROME },
      currentSpaceId: ACCOUNT_SPACE_ID,
      pinned: true,
      audience: "authenticated",
    },
    {
      id: WORK_STAGE_ID,
      name: "work",
      // Everything. This is the full view the product has today (request item
      // 3), and the only stage with no allow-list at all.
      apps: null,
      chrome: { ...FULL_CHROME },
      // Deliberately empty: the work stage owns no code-defined workspaces, so
      // there is no fixed id to name here. `mergeStages` and `defaultLayout`
      // both repair an unresolvable pointer to the stage's first workspace,
      // which is exactly what an empty string is asking them to do.
      //
      // A fixed `ws-build` would have been simpler and is wrong: it is an id
      // shared by every store in the process, and `test/instances.test.ts`
      // exists to fail on precisely that — a workspace id two stores agree on
      // that is not code-defined.
      currentSpaceId: "",
      pinned: true,
      // Twelve tiles of 401 before you are signed in. The server denies the
      // data either way; this is what stops us offering the route (DR-31).
      audience: "authenticated",
    },
  ];

  const spaces: Workspace[] = [
    {
      id: SIGNIN_SPACE_ID,
      name: "sign in",
      stageId: SIGNIN_STAGE_ID,
      pinned: true,
      // Three tiles as of DATADROP-14: sign in on the left, and sign up over
      // the glossary on the right. The two doors sit side by side because a
      // visitor who reaches this stage has not yet said which one they need,
      // and making them guess from a link label is what the sign-up tile
      // exists to stop.
      tree: split(
        "row",
        singleton("signin"),
        split("col", singleton("signup"), singleton("about"), 0.6),
        0.4,
      ),
    },
    {
      id: WELCOME_SPACE_ID,
      name: "start here",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      // Outcomes first: three deliberately-authored graphs consume most of the
      // screen. Sources and a bound table keep the dashboard inspectable rather
      // than making it look like a static marketing image.
      tree: split(
        "row",
        split(
          "col",
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.temperature, "Temperature by station"),
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.yieldByLine, "Yield by production line"),
          0.52,
        ),
        split(
          "col",
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.populationBars, "Population by region"),
          split(
            "col",
            singleton("sources"),
            demoLeaf(builder, "table", WELCOME_DOC_IDS.populationBars, "Regional totals"),
            0.45,
          ),
          0.54,
        ),
        0.62,
      ),
    },
    {
      id: TOUR_SPACE_IDS[0],
      name: "1·objects",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        singleton("tut1"),
        split("col", singleton("sources"), singleton("inspector"), 0.55),
        0.44,
      ),
    },
    {
      id: TOUR_SPACE_IDS[1],
      name: "2·pipeline",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        singleton("tut2"),
        split("col", leaf("pipeline"), leaf("table"), 0.5),
        0.42,
      ),
    },
    {
      id: TOUR_SPACE_IDS[2],
      name: "3·encode",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        singleton("tut3"),
        split("col", leaf("encode"), leaf("chart"), 0.45),
        0.42,
      ),
    },
    {
      id: TOUR_SPACE_IDS[3],
      name: "4·docs",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        singleton("tut4"),
        split("col", singleton("charts"), singleton("gallery"), 0.55),
        0.42,
      ),
    },
    {
      id: DEMO_SPACE_IDS[0],
      name: "5·climate",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "col",
        split(
          "row",
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.temperature, "Temperature by station"),
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.humidity, "Humidity by station"),
          0.5,
        ),
        split(
          "row",
          demoLeaf(builder, "pipeline", WELCOME_DOC_IDS.temperature, "Climate pipeline"),
          demoLeaf(builder, "table", WELCOME_DOC_IDS.temperature, "Climate readings"),
          0.56,
        ),
        0.7,
      ),
    },
    {
      id: DEMO_SPACE_IDS[1],
      name: "6·operations",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        split(
          "col",
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.yieldByLine, "Yield by line · 85% target"),
          demoLeaf(builder, "chart", WELCOME_DOC_IDS.massYield, "Mass versus yield"),
          0.5,
        ),
        split(
          "col",
          demoLeaf(builder, "encode", WELCOME_DOC_IDS.yieldByLine, "Yield encoding"),
          demoLeaf(builder, "table", WELCOME_DOC_IDS.massYield, "Production batches"),
          0.45,
        ),
        0.72,
      ),
    },
    {
      id: DEMO_SPACE_IDS[2],
      name: "7·compare",
      stageId: WELCOME_STAGE_ID,
      pinned: true,
      tree: split(
        "col",
        split(
          "row",
          singleton("sources"),
          split(
            "row",
            demoLeaf(
              builder,
              "chart",
              WELCOME_DOC_IDS.populationScatter,
              "Population and land area",
            ),
            demoLeaf(builder, "chart", WELCOME_DOC_IDS.populationBars, "Population by region"),
            0.5,
          ),
          0.23,
        ),
        split(
          "row",
          singleton("inspector"),
          demoLeaf(builder, "table", WELCOME_DOC_IDS.populationScatter, "Regional census"),
          0.46,
        ),
        0.7,
      ),
    },
    {
      id: ACCOUNT_SPACE_ID,
      name: "profile",
      stageId: ACCOUNT_STAGE_ID,
      pinned: true,
      tree: split(
        "row",
        singleton("profile"),
        split("col", singleton("tokens"), singleton("upload"), 0.55),
        0.38,
      ),
    },
    {
      id: TEMPLATES_SPACE_ID,
      name: "templates",
      stageId: ACCOUNT_STAGE_ID,
      pinned: true,
      // One tile. The library is a table with a detail pane and wants the
      // width; a second tile beside it would be furniture.
      tree: singleton("templates"),
    },
  ];

  return { stages, spaces, views: builder.views, viewOrder: builder.viewOrder };
}

/**
 * May this stage be seen by a caller in this authentication state? (DR-94)
 *
 * The one definition of the rule. Both the gate in `Workbench` and the switcher
 * in `StageBar` call it, which is the point: two copies of "which stages exist
 * for whom" is how you get a switcher offering a stage the gate immediately
 * moves you off, flickering once per load.
 *
 * A pure function over a stage and a boolean, so it is testable with literals
 * and has no opinion about where `authed` came from.
 */
export function stageIsVisible(stage: Stage, authed: boolean): boolean {
  switch (stage.audience) {
    case "anonymous":
      return !authed;
    case "authenticated":
      return authed;
    default:
      // Including `undefined`: a stage a user made says nothing and is visible
      // throughout. See the field's comment for why absent must mean "any".
      return true;
  }
}

/**
 * Where to land when the current stage is not one you may see.
 *
 * Signed in: the cockpit. Signed out: `welcome`, and **not** `sign in`.
 *
 * That second choice is the one worth stating. The obvious destination for an
 * anonymous visitor is the sign-in screen, and it is wrong twice over: a
 * stranger who has just arrived has not refused to sign in, they have not been
 * asked, and DATADROP-14 exists so that they can see the product work before
 * being asked. And on the way *out* — signing out moves you off `work`, which
 * is no longer visible — dumping someone on a sign-in wall the moment they
 * chose to leave is the product arguing with them.
 */
export function landingStageFor(authed: boolean): StageId {
  return authed ? WORK_STAGE_ID : WELCOME_STAGE_ID;
}

const PINNED_STAGE_IDS: ReadonlySet<string> = new Set([
  SIGNIN_STAGE_ID,
  WELCOME_STAGE_ID,
  ACCOUNT_STAGE_ID,
  WORK_STAGE_ID,
]);

/** Was this workspace id defined in code by *this* build? */
export function isPinnedSpaceId(id: string): boolean {
  return pinnedStages().spaces.some((space) => space.id === id);
}

/**
 * Code-defined stages and spaces win; user-created ones survive.
 *
 * The successor to `mergePinned`, with the same asymmetry and one addition: a
 * restored stage supplies the code-defined stage's `currentSpaceId`, because
 * that field is a memory rather than a definition (DR-60).
 *
 * Also repairs, because a restored payload is not trusted to be coherent:
 *  - a workspace naming a stage that no longer exists joins `work`;
 *  - a stage whose remembered workspace is gone falls back to its first;
 *  - a stage left with no workspaces at all gets one.
 */
export function mergeStages(
  restoredStages: Stage[],
  restoredSpaces: Workspace[],
  restoredViews: Record<string, AppView> = {},
  restoredViewOrder: string[] = [],
): {
  stages: Stage[];
  spaces: Workspace[];
  views: Record<string, AppView>;
  viewOrder: string[];
} {
  const pinned = pinnedStages();
  const repair = createLayoutBuilder();
  const pinnedSpaceIds = new Set(pinned.spaces.map((s) => s.id));
  const referencedViews = (tree: Node): ViewId[] =>
    tree.type === "leaf" ? [tree.viewId] : [...referencedViews(tree.a), ...referencedViews(tree.b)];
  const userReferencedViewIds = new Set(
    restoredSpaces
      .filter((space) => !pinnedSpaceIds.has(space.id))
      .flatMap((space) => referencedViews(space.tree)),
  );
  const pinnedOnlyViewIds = new Set(
    restoredSpaces
      .filter((space) => pinnedSpaceIds.has(space.id))
      .flatMap((space) => referencedViews(space.tree))
      .filter((id) => !userReferencedViewIds.has(id)),
  );
  const retainedViews = Object.fromEntries(
    Object.entries(restoredViews).filter(([id]) => !pinnedOnlyViewIds.has(id)),
  );

  const stages: Stage[] = [
    ...pinned.stages.map((stage) => {
      const stored = restoredStages.find((s) => s.id === stage.id);
      return stored ? { ...stage, currentSpaceId: stored.currentSpaceId } : stage;
    }),
    ...restoredStages.filter((stage) => !PINNED_STAGE_IDS.has(stage.id)),
  ];

  const known = new Set(stages.map((s) => s.id));
  const spaces: Workspace[] = [
    ...pinned.spaces,
    ...restoredSpaces
      .filter((space) => !pinnedSpaceIds.has(space.id))
      // A workspace whose stage is gone is not discarded: an orphan is still a
      // layout the user built, and dropping it silently is the failure mode
      // DR-73 rejects one level up.
      .map((space) => (known.has(space.stageId) ? space : { ...space, stageId: WORK_STAGE_ID })),
  ];

  for (const stage of stages) {
    let own = spaces.filter((s) => s.stageId === stage.id);
    if (own.length === 0) {
      const space: Workspace = {
        id: newId(),
        name: "build",
        tree: repair.leaf("launcher"),
        stageId: stage.id,
      };
      spaces.push(space);
      own = [space];
    }
    if (!own.some((s) => s.id === stage.currentSpaceId)) {
      stage.currentSpaceId = (own[0] as Workspace).id;
    }
  }

  const views = { ...retainedViews, ...pinned.views, ...repair.views };
  const viewOrder = [
    ...pinned.viewOrder,
    ...restoredViewOrder.filter((id) => !!retainedViews[id] && !pinned.views[id]),
    ...repair.viewOrder,
  ];

  return { stages, spaces, views, viewOrder };
}

/**
 * One workspace on one freshly-minted stage.
 *
 * What every embedded instance and every story that seeds a layout wants. The
 * stage is minted rather than reusing a pinned id, because six tour panels
 * sharing one stage id would be harmless today and confusing the moment a stage
 * verb names one.
 *
 * `stageBar: false` because a workbench with one stage offers no choice, and a
 * switcher that cannot switch is furniture that reads as a control. `masthead:
 * false` because the embedding page has its own; an instance that wants one
 * says so, and `??` in the shell lets it win.
 */
export function singleStageLayout(
  name: string,
  build: (builder: LayoutBuilder) => Node,
  apps: AppId[] | null = null,
): LayoutState {
  const builder = createLayoutBuilder();
  const tree = build(builder);
  const spaceId = newId();
  const stageId = newId();
  return {
    stages: [
      {
        id: stageId,
        name,
        apps,
        chrome: { masthead: false, workspaces: true, stageBar: false },
        currentSpaceId: spaceId,
      },
    ],
    currentStageId: stageId,
    spaces: [{ id: spaceId, name, tree, stageId }],
    currentSpaceId: spaceId,
    views: builder.views,
    viewOrder: builder.viewOrder,
  };
}

/**
 * The default layout: the four pinned stages, their workspaces, and the work
 * stage's four user-owned ones.
 *
 * `build` is the daily cockpit and is deliberately the same arrangement the
 * deleted App.tsx had — pipeline and encoding on the left, chart and table on
 * the right — assembled out of tiles rather than out of a fixed grid.
 *
 * The four work-stage workspaces are NOT pinned. They are a starting point the
 * user owns: renameable, deletable, and not re-created behind their back.
 */
export function defaultLayout(): LayoutState {
  const builder = createLayoutBuilder();
  const pinned = pinnedStages(builder);
  const leaf = builder.leaf.bind(builder);
  const singleton = builder.singleton.bind(builder);
  const work = (name: string, tree: Workspace["tree"]): Workspace => ({
    id: newId(),
    name,
    tree,
    stageId: WORK_STAGE_ID,
  });

  const spaces: Workspace[] = [
    ...pinned.spaces,
    work(
      "build",
      split(
        "row",
        split("col", leaf("pipeline"), leaf("encode"), 0.55),
        split("col", leaf("chart"), leaf("table"), 0.6),
        0.4,
      ),
    ),
    work(
      "explore",
      split(
        "row",
        singleton("sources"),
        split("col", leaf("chart"), singleton("inspector"), 0.6),
        0.34,
      ),
    ),
    work(
      "gallery",
      split(
        "row",
        singleton("charts"),
        split("col", singleton("gallery"), singleton("compare"), 0.5),
        0.4,
      ),
    ),
    work(
      "help",
      split(
        "row",
        singleton("about"),
        split("col", singleton("watch"), singleton("trace"), 0.45),
        0.55,
      ),
    ),
  ];

  // `work` on `build`: a signed-in user lands in the cockpit. The signed-out
  // gate in `Workbench` switches to the sign-in STAGE when there is nobody to
  // show it to, which is the layer that decision belongs at (DR-59).
  const build = spaces.find((space) => space.stageId === WORK_STAGE_ID) as Workspace;
  for (const stage of pinned.stages) {
    if (stage.id === WORK_STAGE_ID) stage.currentSpaceId = build.id;
  }
  return {
    stages: pinned.stages,
    currentStageId: WORK_STAGE_ID,
    spaces,
    currentSpaceId: build.id,
    views: builder.views,
    viewOrder: builder.viewOrder,
  };
}

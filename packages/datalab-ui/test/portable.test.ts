import { Direction, type AppView, type Node } from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { sequentialIds } from "@hyperslop-systems/workbench-core";
import { describe, expect, test } from "vitest";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { draft, graphicFixture } from "../src/fixtures";
import type { GraphicFixtureOptions } from "../src/fixtures/charts";
import { documentLimit } from "../src/model/graphicAuthoring";
import {
  BUNDLE_VERSION,
  FORMAT,
  LIMITS,
  REASONS,
  describeBundle,
  measureBundle,
  parseBundle,
  unknownApps,
  type Bundle,
  type PortableNode,
  type StagePayload,
  type TilePayload,
  type WorkspacePayload,
} from "../src/model/portable";
import {
  applyStageBundle,
  applyTileBundle,
  applyWorkspaceBundle,
  bundleForStage,
  bundleForTile,
  bundleForWorkspace,
  idsNeeded,
  type BundleState,
} from "../src/store/bundles";
import type { StageDefinition } from "../src/store/navigation";
import { compileSeed, split, tile, type WorkspaceSeed } from "../src/store/seed";
import { initialWorld, type Doc, type WorldState } from "../src/store/world";

/**
 * The portable format, and the two conversions either side of it.
 *
 * The most important file in the ticket, and the two assertions that carry the
 * most weight are the least obvious ones:
 *
 *  - **no id travels** (DR-64). `JSON.stringify(bundle)` must contain none of
 *    the exporting store's node ids or document ids. The obvious implementation
 *    — stringify the node — compiles, runs, produces a plausible bundle, and
 *    gives you two nodes with one id the moment anyone pastes a tile back into
 *    the workspace they copied it from.
 *  - **sharing survives**. A chart and a table on one document must import as
 *    two tiles on ONE document. Inline the document at each leaf instead and
 *    nothing throws, no other test fails, and changing a filter in the pipeline
 *    silently stops moving the chart.
 *
 * Everything is a pure function of plain data, so there is no store, no DOM and
 * no clock: `at` is a parameter and so are the ids to mint. The state a bundle
 * is built from is the seed compiler's output — a protocol workbench document
 * plus navigation metadata — which is exactly what the runtime holds.
 */

const AT = "2026-07-26T18:04:11.512Z";

function spec(drop = "sensors", value = "20"): GraphicFixtureOptions {
  const filter = draft.filter("data.temp_c", ">", value);
  filter.id = "s1";
  return {
    source: { kind: "stream", drop, stream: "readings" },
    transforms: [filter],
    geom: "point",
    mapping: { x: "time", y: "data.temp_c", color: "data.station", size: null, facet: null },
    yScale: "linear",
  };
}

function doc(id: string, name: string, options = spec()): Doc {
  return graphicFixture(options, id, name);
}

function worldWith(...docs: Doc[]): WorldState {
  return {
    ...initialWorld,
    docs: Object.fromEntries(docs.map((d) => [d.id, d])),
    docOrder: docs.map((d) => d.id),
    activeDocId: docs[0]?.id ?? null,
  };
}

const apps = datalabManifests();
const CHROME = { masthead: true, workspaces: true, stageBar: true };

/** A tile bound to a document, in the seed compiler's vocabulary. */
const bound = (app: string, docId: string, title?: string) =>
  tile(app, { documents: { primary: docId }, ...(title ? { title } : {}) });

/**
 * One stage holding the given workspaces, compiled the way the product
 * compiles its own seeds: through the protocol, with deterministic ids.
 */
function stateWith(
  world: WorldState,
  workspaces: WorkspaceSeed[],
  stage: Partial<StageDefinition> = {},
): BundleState {
  const seed = compileSeed({
    stages: [{ id: "stage-1", name: "work", apps: null, chrome: CHROME, ...stage }],
    workspaces,
    apps,
    ids: sequentialIds(),
  });
  return { world, document: seed.document, navigation: seed.navigation };
}

const treeOf = (state: BundleState, workspaceId: string): Node =>
  state.document.workspaces.find((space) => space.id === workspaceId)?.tree as Node;
const viewIdOf = (node: Node | undefined): string =>
  node?.body.case === "leaf" ? node.body.value.viewId : "";
const splitOf = (node: Node | undefined) =>
  node?.body.case === "split" ? node.body.value : undefined;
/** Every node id in a tree, leaves and splits alike. */
const nodeIds = (node: Node | undefined): string[] => {
  if (!node) return [];
  const body = splitOf(node);
  return body ? [node.id, ...nodeIds(body.a), ...nodeIds(body.b)] : [node.id];
};
const viewById = (views: readonly AppView[], id: string) => views.find((view) => view.id === id);

/** The §7.4 worked example: a source browser beside a chart above an inspector. */
function exploreState(): { state: BundleState; nodes: string[]; docId: string } {
  const alpha = doc("8f2c0f9e", "α");
  const state = stateWith(worldWith(alpha), [
    {
      id: "ws-1",
      name: "explore",
      stageId: "stage-1",
      spec: split(
        "row",
        0.34,
        tile("sources"),
        split("col", 0.6, bound("chart", alpha.id), tile("inspector")),
      ),
    },
  ]);
  const tree = treeOf(state, "ws-1");
  // The three tiles in reading order — sources, chart, inspector — then the splits.
  const tiles = leaves(tree).map((leaf) => leaf.id);
  return {
    state,
    nodes: [...tiles, ...nodeIds(tree).filter((id) => !tiles.includes(id))],
    docId: alpha.id,
  };
}

/** A chart and a table on ONE document — the sharing case. */
function sharedState(): { state: BundleState; docId: string } {
  const alpha = doc("aaaa-1111", "α");
  const state = stateWith(worldWith(alpha), [
    {
      id: "ws-shared",
      name: "two views",
      stageId: "stage-1",
      spec: split("row", 0.5, bound("chart", alpha.id), bound("table", alpha.id)),
    },
  ]);
  return { state, docId: alpha.id };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `new-${i}`);

/* -------------------------------------------------------- the envelope -- */

describe("the envelope", () => {
  test("a workspace bundle matches the worked example, field for field", () => {
    const { state } = exploreState();
    const bundle = bundleForWorkspace(state, "ws-1", AT);

    expect(bundle.format).toBe(FORMAT);
    expect(bundle.version).toBe(BUNDLE_VERSION);
    expect(bundle.kind).toBe("workspace");
    expect(bundle.exportedAt).toBe(AT);
    expect(bundle.name).toBe("explore");

    expect(bundle.payload.tree).toEqual({
      split: {
        dir: "row",
        ratio: 0.34,
        a: { leaf: { view: 0 } },
        b: {
          split: {
            dir: "col",
            ratio: 0.6,
            a: { leaf: { view: 1 } },
            b: { leaf: { view: 2 } },
          },
        },
      },
    });
    expect(bundle.payload.views).toEqual([
      { app: "sources", documents: {} },
      { app: "chart", documents: { primary: 0 } },
      { app: "inspector", documents: {} },
    ]);
    // `sources` and `inspector` are not document-bound, so their view records
    // carry an empty document map.
    expect(bundle.payload.docs).toHaveLength(1);
    expect(bundle.payload.docs[0]?.name).toBe("α");
    expect(bundle.payload.docs[0]?.graphic.format).toBe("datadrop.gog.document");
  });

  test("a step id survives, because it never leaves the spec it lives in", () => {
    const { state } = exploreState();
    const bundle = bundleForWorkspace(state, "ws-1", AT);
    expect(bundle.payload.docs[0]?.graphic.transforms.s1?.id).toBe("s1");
  });

  test("a ratio outside the drawable range is clamped, not refused", () => {
    const state = stateWith(worldWith(), [
      {
        id: "ws",
        name: "x",
        stageId: "stage-1",
        spec: split("row", 0.001, tile("chart"), tile("table")),
      },
    ]);
    const bundle = bundleForWorkspace(state, "ws", AT);
    expect((bundle.payload.tree as { split: { ratio: number } }).split.ratio).toBe(0.05);
  });

  test("a tile bundle carries its view and document without runtime ids", () => {
    const { state, nodes } = exploreState();
    const chartNode = nodes[1] as string;
    const bundle = bundleForTile(state, chartNode, AT);
    expect(bundle.payload.docs[0]?.name).toBe("α");
    expect(bundle.payload.view).toMatchObject({
      app: "chart",
      documents: { primary: 0 },
    });
  });

  test("a stage bundle hoists documents above its workspaces", () => {
    const alpha = doc("d-1", "α");
    const state = stateWith(worldWith(alpha), [
      { id: "ws-a", name: "a", stageId: "stage-1", spec: bound("chart", alpha.id) },
      { id: "ws-b", name: "b", stageId: "stage-1", spec: bound("table", alpha.id) },
    ]);
    const bundle = bundleForStage(state, "stage-1", AT);

    // One document at the stage, index 0 from BOTH workspaces: two workspaces
    // in one stage sharing a document is the same argument as DR-64 one level
    // up, and a per-workspace docs array would break it exactly the same way.
    expect(bundle.payload.docs).toHaveLength(1);
    expect(bundle.payload.spaces).toHaveLength(2);
    expect(bundle.payload.spaces[0]?.docs).toEqual([]);
    expect(bundle.payload.views).toHaveLength(2);
    expect(bundle.payload.spaces[0]?.tree).toEqual({ leaf: { view: 0 } });
    expect(bundle.payload.spaces[1]?.tree).toEqual({ leaf: { view: 1 } });
  });
});

/* ------------------------------------------------------ ids do not travel -- */

describe("ids do not travel (DR-64)", () => {
  test("a workspace bundle contains no node id and no document id", () => {
    const { state, nodes, docId } = exploreState();
    const text = JSON.stringify(bundleForWorkspace(state, "ws-1", AT));
    for (const id of nodes) expect(text).not.toContain(id);
    expect(text).not.toContain(docId);
    expect(text).not.toContain("ws-1");
  });

  test("a tile bundle contains no node id and no document id", () => {
    const { state, nodes, docId } = exploreState();
    const text = JSON.stringify(bundleForTile(state, nodes[1] as string, AT));
    for (const id of nodes) expect(text).not.toContain(id);
    expect(text).not.toContain(docId);
  });

  test("a stage bundle contains no stage id and no workspace id", () => {
    const { state } = exploreState();
    const text = JSON.stringify(bundleForStage(state, "stage-1", AT));
    expect(text).not.toContain("stage-1");
    expect(text).not.toContain("ws-1");
  });

  test("importing into the tree it came from produces entirely fresh ids", () => {
    // "Duplicate by copy and paste" is exactly this, and a portable node that
    // kept `id` would give the workspace two nodes with one id — so `findLeaf`
    // returns the first and dragging one moves the other.
    const { state, nodes } = exploreState();
    const bundle = bundleForWorkspace(state, "ws-1", AT);
    const imported = applyWorkspaceBundle(bundle, "stage-1", ids(idsNeeded(bundle)));

    const fresh = nodeIds(imported.workspace.tree);
    for (const id of nodes) expect(fresh).not.toContain(id);
    expect(new Set(fresh).size).toBe(fresh.length);
  });
});

/* --------------------------------------------------------- sharing -- */

describe("sharing survives a round trip", () => {
  // `inspector` is a singleton, so the seed compiler places the ONE logical
  // view twice rather than minting a second — the same document a user gets
  // from "create linked duplicate", built without a runtime.
  test("linked placements stay linked instead of hydrating independent views", () => {
    const state = stateWith(worldWith(), [
      {
        id: "linked",
        name: "linked",
        stageId: "stage-1",
        spec: split("row", 0.5, tile("inspector"), tile("inspector")),
      },
    ]);
    const seeded = splitOf(treeOf(state, "linked"));
    expect(viewIdOf(seeded?.a)).toBe(viewIdOf(seeded?.b));

    const bundle = bundleForWorkspace(state, "linked", AT);
    expect(bundle.payload.views).toHaveLength(1);
    expect(bundle.payload.tree).toMatchObject({
      split: { a: { leaf: { view: 0 } }, b: { leaf: { view: 0 } } },
    });

    const imported = applyWorkspaceBundle(bundle, "stage-1", ids(idsNeeded(bundle)));
    const back = splitOf(imported.workspace.tree);
    expect(viewIdOf(back?.a)).toBe(viewIdOf(back?.b));
    expect(imported.views).toHaveLength(1);
  });

  test("one linked view remains shared across workspaces in a stage bundle", () => {
    const state = stateWith(worldWith(), [
      { id: "a", name: "a", stageId: "stage-1", spec: tile("inspector") },
      { id: "b", name: "b", stageId: "stage-1", spec: tile("inspector") },
    ]);
    expect(viewIdOf(treeOf(state, "a"))).toBe(viewIdOf(treeOf(state, "b")));

    const imported = applyStageBundle(
      bundleForStage(state, "stage-1", AT),
      ids(idsNeeded(bundleForStage(state, "stage-1", AT))),
    );
    expect(viewIdOf(imported.workspaces[0]?.tree)).toBe(viewIdOf(imported.workspaces[1]?.tree));
    expect(imported.views).toHaveLength(1);
  });

  test("two leaves on one document import to two leaves on ONE document", () => {
    const { state } = sharedState();
    const bundle = bundleForWorkspace(state, "ws-shared", AT);
    expect(bundle.payload.docs).toHaveLength(1);

    const imported = applyWorkspaceBundle(bundle, "stage-1", ids(idsNeeded(bundle)));
    const tree = splitOf(imported.workspace.tree);

    // Identity, not equality. Two leaves pointing at two structurally identical
    // documents is precisely the defect: nothing throws, and changing a filter
    // in the pipeline stops moving the chart.
    expect(viewById(imported.views, viewIdOf(tree?.a))?.documents.primary).toBe(
      viewById(imported.views, viewIdOf(tree?.b))?.documents.primary,
    );
    expect(Object.keys(imported.docs)).toHaveLength(1);
  });

  test("two workspaces in one stage import to one document as well", () => {
    const alpha = doc("d-1", "α");
    const state = stateWith(worldWith(alpha), [
      { id: "a", name: "a", stageId: "stage-1", spec: bound("chart", alpha.id) },
      { id: "b", name: "b", stageId: "stage-1", spec: bound("table", alpha.id) },
    ]);
    const bundle = bundleForStage(state, "stage-1", AT);
    const imported = applyStageBundle(bundle, ids(idsNeeded(bundle)));

    expect(Object.keys(imported.docs)).toHaveLength(1);
    const first = viewIdOf(imported.workspaces[0]?.tree);
    const second = viewIdOf(imported.workspaces[1]?.tree);
    expect(viewById(imported.views, first)?.documents.primary).toBe(
      viewById(imported.views, second)?.documents.primary,
    );
  });
});

/* ------------------------------------------------------------ round trip -- */

describe("the round trip preserves what was shared", () => {
  test("applications, ratios, labels, document names, specs and limits", () => {
    const alpha = doc("d-1", "α", spec("sensors", "37"));
    const state = stateWith(worldWith(alpha), [
      {
        id: "ws",
        name: "review",
        stageId: "stage-1",
        apps: ["chart", "table"],
        spec: split(
          "col",
          0.62,
          bound("chart", alpha.id, "the raw feed"),
          bound("table", alpha.id),
        ),
      },
    ]);

    const bundle = bundleForWorkspace(state, "ws", AT);
    const back = applyWorkspaceBundle(bundle, "stage-9", ids(idsNeeded(bundle)));

    expect(back.workspace.name).toBe("review");
    expect(back.stageId).toBe("stage-9");
    expect(back.workspace.apps).toEqual(["chart", "table"]);

    const t = splitOf(back.workspace.tree);
    expect(t?.direction).toBe(Direction.COLUMN);
    expect(t?.ratio).toBe(0.62);
    const a = viewById(back.views, viewIdOf(t?.a));
    expect(a?.appId).toBe("chart");
    expect(a?.title).toBe("the raw feed");

    const minted = Object.values(back.docs)[0];
    expect(minted?.name).toBe("α");
    expect(minted ? documentLimit(minted) : null).toBe(2000);
    expect(minted?.format).toBe("datadrop.gog.document");
    expect(minted?.transforms).toEqual(alpha.transforms);
    // A deep copy, not an alias: editing the imported document must not reach
    // back into the exporting store's.
    expect(minted?.transforms).not.toBe(alpha.transforms);
  });

  test("an unlabelled tile comes back unlabelled rather than with an empty label", () => {
    const { state, nodes } = exploreState();
    const bundle = bundleForTile(state, nodes[0] as string, AT);
    expect(bundle.payload.view).not.toHaveProperty("title");
    const back = applyTileBundle(bundle, ids(idsNeeded(bundle)));
    expect(viewById(back.views, back.viewId)?.title).toBeUndefined();
  });

  test("a stage round trip keeps its allow-list and its chrome", () => {
    const state = stateWith(
      worldWith(),
      [{ id: "ws", name: "x", stageId: "stage-1", spec: tile("about") }],
      {
        name: "sign in",
        apps: ["signin", "about"],
        chrome: { masthead: true, workspaces: false, stageBar: false },
      },
    );
    const bundle = bundleForStage(state, "stage-1", AT);
    const back = applyStageBundle(bundle, ids(idsNeeded(bundle)));
    expect(back.stage.name).toBe("sign in");
    expect(back.stage.apps).toEqual(["signin", "about"]);
    expect(back.stage.chrome).toEqual({ masthead: true, workspaces: false, stageBar: false });
    // An imported stage is the user's, never code-defined: a bundle claiming
    // `pinned` would create a stage that cannot be deleted and that no release
    // will ever re-create.
    expect(back.stage.pinned).toBeUndefined();
  });

  test("a doc index naming nothing becomes a tile with no document", () => {
    // The honest reading of a bundle someone edited by hand: `docId: null` is
    // the tile's "follow the active document" state, which is a real state
    // rather than an error.
    const bundle: Bundle<"workspace"> = {
      format: FORMAT,
      version: BUNDLE_VERSION,
      kind: "workspace",
      exportedAt: AT,
      name: "x",
      payload: {
        name: "x",
        tree: { leaf: { view: 0 } },
        views: [{ app: "chart", documents: { primary: 7 } }],
        docs: [],
      },
    };
    const back = applyWorkspaceBundle(bundle, "stage-1", ids(idsNeeded(bundle) + 4));
    const placed = viewById(back.views, viewIdOf(back.workspace.tree));
    expect(placed?.documents.primary).toBeUndefined();
  });
});

/* ---------------------------------------------------------- every reason -- */

describe("parseBundle refuses with the reason, and the reasons are the specification", () => {
  const good = () => {
    const { state } = exploreState();
    return JSON.stringify(bundleForWorkspace(state, "ws-1", AT));
  };

  test("it accepts a bundle it produced", () => {
    const result = parseBundle(good());
    expect(result.ok).toBe(true);
  });

  test("not JSON at all", () => {
    const result = parseBundle("site,mean_temp,n\nnorth,21.4,18\n");
    expect(result).toEqual({ ok: false, reason: REASONS.notALayout });
  });

  test("JSON, but not a layout", () => {
    expect(parseBundle('{"hello":"world"}')).toEqual({
      ok: false,
      reason: REASONS.notALayout,
    });
  });

  test("a newer version", () => {
    const bundle = JSON.parse(good());
    bundle.version = BUNDLE_VERSION + 1;
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.newer });
  });

  test("an older version", () => {
    const bundle = JSON.parse(good());
    bundle.version = BUNDLE_VERSION - 1;
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.older });
  });

  test("the wrong kind, when a kind was expected", () => {
    const result = parseBundle(good(), "tile");
    expect(result).toEqual({
      ok: false,
      reason: "that is a workspace; this tile can only take a tile",
    });
  });

  test("the right kind passes the same check", () => {
    expect(parseBundle(good(), "workspace").ok).toBe(true);
  });

  test("a damaged tree", () => {
    const bundle = JSON.parse(good());
    bundle.payload.tree = { split: { dir: "sideways", ratio: 0.5, a: {}, b: {} } };
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.damaged });
  });

  test("a damaged document", () => {
    const bundle = JSON.parse(good());
    bundle.payload.docs[0].graphic.format = "wrong";
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.damaged });
  });

  test("a document with no source", () => {
    const bundle = JSON.parse(good());
    bundle.payload.docs[0].graphic.sources = {};
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.damaged });
  });

  test("a document whose root view or relation is missing", () => {
    const bundle = JSON.parse(good());
    bundle.payload.docs[0].graphic.views = {};
    bundle.payload.docs[0].graphic.rootView = "missing";
    expect(parseBundle(JSON.stringify(bundle))).toEqual({ ok: false, reason: REASONS.damaged });
  });

  test("more tiles than the cap", () => {
    // A BALANCED 65-leaf tree, built in the test rather than asserted against a
    // constant. Balanced matters: a right-leaning chain of 65 leaves is also 65
    // deep, so it would be refused for its depth and this test would pass while
    // proving nothing about the leaf cap.
    const balanced = (n: number): PortableNode =>
      n === 1
        ? { leaf: { view: 0 } }
        : {
            split: {
              dir: "row",
              ratio: 0.5,
              a: balanced(Math.ceil(n / 2)),
              b: balanced(Math.floor(n / 2)),
            },
          };
    const bundle = JSON.parse(good());
    bundle.payload.tree = balanced(LIMITS.leaves + 1);
    const result = parseBundle(JSON.stringify(bundle));
    expect(result).toEqual({
      ok: false,
      reason: "that bundle names 65 tiles; the limit is 64",
    });
  });

  test("deeper than the cap", () => {
    let tree: PortableNode = { leaf: { view: 0 } };
    for (let i = 0; i < LIMITS.depth + 2; i++) {
      tree = { split: { dir: "row", ratio: 0.5, a: { leaf: { view: 0 } }, b: tree } };
    }
    const bundle = JSON.parse(good());
    bundle.payload.tree = tree;
    // The depth check lives inside `isPortableNode` so that it BOUNDS the
    // recursion rather than running after it — a validator that overflows the
    // stack before reporting its limit is not a validator. A tree too deep is
    // therefore reported as damaged, which is what it is.
    expect(parseBundle(JSON.stringify(bundle)).ok).toBe(false);
  });

  test("bigger than the cap", () => {
    const big = `{"format":"${FORMAT}",${"x".repeat(LIMITS.bytes + 1)}}`;
    const result = parseBundle(big);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toContain("the limit is 512 kB");
  });

  test("more documents than the cap", () => {
    const bundle = JSON.parse(good());
    const one = bundle.payload.docs[0];
    bundle.payload.docs = Array.from({ length: LIMITS.docs + 1 }, () => structuredClone(one));
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: "that bundle names 65 documents; the limit is 64",
    });
  });

  test("more views than the cap", () => {
    const bundle = JSON.parse(good());
    const one = bundle.payload.views[0];
    bundle.payload.views = Array.from({ length: LIMITS.views + 1 }, () => structuredClone(one));
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: "that bundle names 65 views; the limit is 64",
    });
  });

  test("a tile cannot bypass the document cap", () => {
    const { state, nodes } = exploreState();
    const bundle = JSON.parse(JSON.stringify(bundleForTile(state, nodes[1] as string, AT)));
    const one = bundle.payload.docs[0];
    bundle.payload.docs = Array.from({ length: LIMITS.docs + 1 }, () => structuredClone(one));
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: "that bundle names 65 documents; the limit is 64",
    });
  });

  test("a stage cannot bypass the view cap", () => {
    const state = stateWith(worldWith(), [
      { id: "ws", name: "x", stageId: "stage-1", spec: tile("about") },
    ]);
    const bundle = JSON.parse(JSON.stringify(bundleForStage(state, "stage-1", AT)));
    const one = bundle.payload.views[0];
    bundle.payload.views = Array.from({ length: LIMITS.views + 1 }, () => structuredClone(one));
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: "that bundle names 65 views; the limit is 64",
    });
  });

  test("more workspaces in a stage than the cap", () => {
    const state = stateWith(worldWith(), [
      { id: "ws", name: "x", stageId: "stage-1", spec: tile("about") },
    ]);
    const bundle = JSON.parse(JSON.stringify(bundleForStage(state, "stage-1", AT)));
    bundle.payload.spaces = Array.from({ length: LIMITS.spaces + 1 }, () => ({
      name: "x",
      tree: { leaf: { view: 0 } },
      views: [],
      docs: [],
    }));
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: "that bundle names 33 workspaces; the limit is 32",
    });
  });
});

/* ------------------------------------------------------- the secret guard -- */

describe("the credential guard fires in both directions", () => {
  test("the exporter refuses to produce a bundle carrying a credential", () => {
    // There is no path today by which a token could reach a legacy chart format, and that
    // is not an accident: TokenRef has no secret field and pbui/types.ts says
    // the absence is load-bearing. This is the second net under that one.
    const poisoned = doc("d-1", "α");
    poisoned.metadata = { token: "dd_live_not_a_real_secret" };
    const state = stateWith(worldWith(poisoned), [
      { id: "ws", name: "x", stageId: "stage-1", spec: bound("chart", poisoned.id) },
    ]);

    expect(() => bundleForWorkspace(state, "ws", AT)).toThrow(/credential-shaped/);
    expect(() => bundleForTile(state, treeOf(state, "ws").id, AT)).toThrow(/credential-shaped/);
    expect(() => bundleForStage(state, "stage-1", AT)).toThrow(/credential-shaped/);
  });

  test("the importer refuses a bundle carrying a credential", () => {
    const { state } = exploreState();
    const bundle = JSON.parse(JSON.stringify(bundleForWorkspace(state, "ws-1", AT)));
    bundle.payload.docs[0].graphic.metadata = { authorization: "Bearer nope" };
    expect(parseBundle(JSON.stringify(bundle))).toEqual({
      ok: false,
      reason: REASONS.credential,
    });
  });

  test("every forbidden spelling is caught, anywhere in the payload", () => {
    const { state } = exploreState();
    const base = JSON.parse(JSON.stringify(bundleForWorkspace(state, "ws-1", AT)));
    for (const key of [
      "token",
      "Token",
      "authorization",
      "auth",
      "bearer",
      "secret",
      "password",
      "apikey",
      "api_key",
    ]) {
      const bundle = structuredClone(base);
      bundle.payload.docs[0].graphic.parameters[key] = "x";
      expect(parseBundle(JSON.stringify(bundle)).ok).toBe(false);
    }
  });

  test("a bundle produced from real state carries no credential-shaped key", () => {
    // The positive form of the same claim: what the exporter actually writes is
    // a name, a limit and a legacy chart format — a SourceRef, steps, a geom, a mapping
    // and a scale — and none of those has anywhere to put one.
    const { state } = exploreState();
    const text = JSON.stringify(bundleForWorkspace(state, "ws-1", AT));
    for (const key of ["token", "authorization", "bearer", "secret", "password", "apikey"]) {
      expect(text.toLowerCase()).not.toContain(`"${key}"`);
    }
  });
});

/* -------------------------------------------------- unknown applications -- */

describe("an unknown application warns rather than refusing", () => {
  test("parseBundle accepts a bundle naming an application this build lacks", () => {
    const { state } = exploreState();
    const bundle = JSON.parse(JSON.stringify(bundleForWorkspace(state, "ws-1", AT)));
    bundle.payload.views[0].app = "chartsy";
    const result = parseBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(true);
  });

  test("unknownApps names them, sorted and deduplicated", () => {
    const { state } = exploreState();
    const bundle = JSON.parse(JSON.stringify(bundleForWorkspace(state, "ws-1", AT))) as Bundle;
    const payload = bundle.payload as WorkspacePayload;
    payload.views = [
      { app: "chartsy", documents: {} },
      { app: "chartsy", documents: {} },
      { app: "abacus", documents: {} },
    ];
    payload.tree = {
      split: {
        dir: "row",
        ratio: 0.5,
        a: { leaf: { view: 0 } },
        b: {
          split: {
            dir: "col",
            ratio: 0.5,
            a: { leaf: { view: 1 } },
            b: { leaf: { view: 2 } },
          },
        },
      },
    };
    expect(unknownApps(bundle, new Set(["chart", "table"]))).toEqual(["abacus", "chartsy"]);
  });

  test("a bundle naming only known applications reports none", () => {
    const { state } = exploreState();
    const bundle = bundleForWorkspace(state, "ws-1", AT);
    expect(unknownApps(bundle, new Set(["sources", "chart", "inspector"]))).toEqual([]);
  });

  test("the tile that named it still imports, and can be re-pointed", () => {
    const bundle: Bundle<"tile"> = {
      format: FORMAT,
      version: BUNDLE_VERSION,
      kind: "tile",
      exportedAt: AT,
      name: "x",
      payload: { view: { app: "chartsy", documents: {} }, docs: [] },
    };
    const back = applyTileBundle(bundle, ids(idsNeeded(bundle)));
    expect(viewById(back.views, back.viewId)?.appId).toBe("chartsy");
  });
});

/* ------------------------------------------------------- describe/measure -- */

describe("describeBundle and measureBundle", () => {
  test("a tile reads as a sentence naming its application, document and source", () => {
    const { state, nodes } = exploreState();
    const bundle = bundleForTile(state, nodes[1] as string, AT);
    expect(describeBundle(bundle)).toBe(
      "A tile: chart on a document called α, reading sensors / readings.",
    );
  });

  test("a tile with no document says so by omission, not by saying none", () => {
    const { state, nodes } = exploreState();
    const bundle = bundleForTile(state, nodes[0] as string, AT);
    expect(describeBundle(bundle)).toBe("A tile: sources.");
  });

  test("a workspace counts its tiles and documents, and singulars are singular", () => {
    const { state } = exploreState();
    const bundle = bundleForWorkspace(state, "ws-1", AT);
    expect(describeBundle(bundle)).toBe(
      "A workspace “explore”: 3 tiles, 1 document, reading sensors / readings.",
    );
  });

  test("a stage counts its workspaces too", () => {
    const state = stateWith(worldWith(), [
      { id: "ws", name: "x", stageId: "stage-1", spec: tile("about") },
    ]);
    const bundle = bundleForStage(state, "stage-1", AT);
    expect(describeBundle(bundle)).toBe("A stage “work”: 1 workspace, 1 tile, 0 documents.");
  });

  test("measureBundle counts what the confirmation line reports", () => {
    const { state } = exploreState();
    const measured = measureBundle(bundleForWorkspace(state, "ws-1", AT));
    expect(measured.tiles).toBe(3);
    expect(measured.docs).toBe(1);
    expect(measured.spaces).toBe(1);
    expect(measured.bytes).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------- id pool -- */

describe("ids are minted by the caller, never inside", () => {
  test("idsNeeded is exactly what applying the bundle consumes", () => {
    // A tile mints its view and its documents (the target placement keeps
    // its id); a workspace adds its own id and every node of its tree; a
    // stage adds its own id and one per workspace on top of their nodes.
    const { state, nodes } = exploreState();
    const applyWith = (bundle: Bundle, count: number) =>
      bundle.kind === "tile"
        ? applyTileBundle(bundle as Bundle<"tile">, ids(count))
        : bundle.kind === "workspace"
          ? applyWorkspaceBundle(bundle as Bundle<"workspace">, "s", ids(count))
          : applyStageBundle(bundle as Bundle<"stage">, ids(count));
    for (const bundle of [
      bundleForTile(state, nodes[1] as string, AT) as Bundle,
      bundleForWorkspace(state, "ws-1", AT) as Bundle,
      bundleForStage(state, "stage-1", AT) as Bundle,
    ]) {
      const needed = idsNeeded(bundle);
      expect(() => applyWith(bundle, needed)).not.toThrow();
      // One fewer must fail loudly rather than minting a duplicate or an
      // undefined id, which would surface as a duplicate React key.
      expect(() => applyWith(bundle, needed - 1)).toThrow(/not enough ids/);
    }
    expect(idsNeeded(bundleForTile(state, nodes[1] as string, AT))).toBe(1 + 1);
    // ws-1: three views, one document, five nodes (three leaves, two splits).
    expect(idsNeeded(bundleForWorkspace(state, "ws-1", AT))).toBe(1 + 1 + 3 + 5);
    expect(idsNeeded(bundleForStage(state, "stage-1", AT))).toBe(1 + 1 + 3 + (1 + 5));
  });
});

/* ----------------------------------------------- the shapes are the types -- */

describe("the payload types are what the parser accepts", () => {
  test("a tile payload with a label and no document parses", () => {
    const payload: TilePayload = {
      view: { app: "table", title: "raw feed", documents: {} },
      docs: [],
    };
    const bundle: Bundle<"tile"> = {
      format: FORMAT,
      version: BUNDLE_VERSION,
      kind: "tile",
      exportedAt: AT,
      name: "raw feed",
      payload,
    };
    expect(parseBundle(JSON.stringify(bundle), "tile").ok).toBe(true);
  });

  test("a stage payload with no allow-list parses", () => {
    const payload: StagePayload = {
      name: "work",
      apps: null,
      chrome: { masthead: true, workspaces: true, stageBar: true },
      spaces: [{ name: "build", tree: { leaf: { view: 0 } }, views: [], docs: [] }],
      docs: [],
      views: [{ app: "chart", documents: {} }],
    };
    const bundle: Bundle<"stage"> = {
      format: FORMAT,
      version: BUNDLE_VERSION,
      kind: "stage",
      exportedAt: AT,
      name: "work",
      payload,
    };
    expect(parseBundle(JSON.stringify(bundle), "stage").ok).toBe(true);
  });
});

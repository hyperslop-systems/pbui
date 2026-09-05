import { describe, expect, test } from "vitest";
import { toJson } from "@bufbuild/protobuf";
import { WorkbenchDocumentSchema } from "@hyperslop-systems/workbench-protocol";
import { sequentialIds } from "@hyperslop-systems/workbench-core";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { readings } from "../src/fixtures";
import { fieldRef, orderedTransformIds, rootView } from "../src/model/graphicAuthoring";
import { actionsForVerb, environmentFor } from "../src/store/applyVerb";
import { durableNavigation, navigationActions } from "../src/store/navigation";
import { findSecrets, PERSISTENCE_VERSION, save, validate } from "../src/store/persist";
import { createDatalabRuntime } from "../src/store/runtime";
import { compileSeed, pinnedDefinitions, tile, type DatalabSeed } from "../src/store/seed";
import {
  ACCOUNT_SPACE_ID,
  ACCOUNT_STAGE_ID,
  SIGNIN_SPACE_ID,
  WORK_STAGE_ID,
} from "../src/store/stages";
import { TRACE_CAP, worldActions, worldSlice, type WorldState } from "../src/store/world";

/**
 * The world reducers, the verb seam and durable storage: pure functions and
 * a headless runtime, tested without a DOM.
 *
 * The list is the guide's §16.2, which was written around the failures that are
 * easy to produce and invisible until a snapshot quietly follows the document
 * it was copied from. The spatial half — tiles, split trees, workspaces — is
 * workbench-core's now and is replayed through the controller in
 * `test/controller.test.ts`.
 */

const world = worldSlice.reducer;
const apps = datalabManifests();

function withDoc(): { state: WorldState; docId: string } {
  const state = world(undefined, worldActions.newDoc(readings.source));
  return { state, docId: state.docOrder[0] as string };
}

/* ----------------------------------------------------------------- world -- */

describe("documents", () => {
  test("a new document becomes active and is named in sequence", () => {
    const { state, docId } = withDoc();
    expect(state.activeDocId).toBe(docId);
    expect(state.docs[docId]?.name).toBe("α");

    const next = world(state, worldActions.newDoc(readings.source));
    expect(next.docs[next.activeDocId as string]?.name).toBe("β");
  });

  test("the last document cannot be deleted", () => {
    const { state, docId } = withDoc();
    expect(world(state, worldActions.deleteDoc(docId)).docOrder.length).toBe(1);
  });

  test("deleting the active document reassigns activeDocId", () => {
    // Leaving it dangling makes every ambient verb a silent no-op — the worst
    // possible failure for an interface built on ambient verbs.
    let state = withDoc().state;
    state = world(state, worldActions.newDoc(readings.source));
    const active = state.activeDocId as string;

    const next = world(state, worldActions.deleteDoc(active));
    expect(next.activeDocId).not.toBe(active);
    expect(next.docs[next.activeDocId as string]).toBeDefined();
  });

  test("duplicating a document does not alias its spec", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setMapping({
        docId,
        channel: "y",
        field: fieldRef("source:root", "data.temp_c"),
      }),
    );
    state = world(state, worldActions.duplicateDoc({ docId, id: "copy" }));

    state = world(
      state,
      worldActions.setMapping({
        docId,
        channel: "y",
        field: fieldRef("source:root", "data.humidity"),
      }),
    );
    // A spread would have aliased `mapping`, so editing one would edit both.
    expect(state.docs.copy ? rootView(state.docs.copy).encodings.y?.name : null).toBe(
      "data.temp_c",
    );
  });

  test("changing source resets the pipeline and the encoding", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setMapping({
        docId,
        channel: "y",
        field: fieldRef("source:root", "data.temp_c"),
      }),
    );
    state = world(
      state,
      worldActions.setDocSource({ docId, source: { kind: "stream", drop: "other" } }),
    );
    // Keeping them would name columns the new source may not have, producing a
    // chart that refuses to draw with no obvious cause.
    expect(
      state.docs[docId] ? rootView(state.docs[docId]!).encodings.y : undefined,
    ).toBeUndefined();
    expect(state.docs[docId]?.transforms).toEqual({});
  });
});

describe("plot authoring", () => {
  test("analysis and facet scale actions update the canonical view", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "histogram", bins: 20 },
      }),
    );
    state = world(
      state,
      worldActions.setFacetScales({
        docId,
        scales: "free-y",
      }),
    );

    const view = rootView(state.docs[docId]!);
    expect(view.analysis).toEqual({ kind: "histogram", bins: 20 });
    expect(view.facetScales).toBe("free-y");
    expect(state.trace.at(-2)?.type).toBe("analysis_set");
    expect(state.trace.at(-1)?.type).toBe("facet_scales_set");
  });

  test("snapshots preserve an analysis recipe independently", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "density", points: 128 },
      }),
    );
    state = world(state, worldActions.snapshot(docId, "2026-07-29T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "boxplot" },
      }),
    );

    expect(rootView(state.snapshots[snapshotId]!.document).analysis).toEqual({
      kind: "density",
      points: 128,
    });
  });
});

describe("snapshots", () => {
  test("a snapshot does not follow the document it came from", () => {
    // The single line the whole feature depends on: structuredClone, not a
    // spread. If this fails, every snapshot silently tracks its document.
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setMapping({
        docId,
        channel: "y",
        field: fieldRef("source:root", "data.temp_c"),
      }),
    );
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;

    state = world(
      state,
      worldActions.setMapping({
        docId,
        channel: "y",
        field: fieldRef("source:root", "data.humidity"),
      }),
    );
    const frozen = state.snapshots[snapshotId]?.document;
    expect(frozen ? rootView(frozen).encodings.y?.name : null).toBe("data.temp_c");
  });

  test("restoring does not alias the snapshot's steps", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(state, worldActions.restoreSnapshot({ snapshotId, docId }));

    state = world(
      state,
      worldActions.setMapping({ docId, channel: "x", field: fieldRef("source:root", "time") }),
    );
    const frozen = state.snapshots[snapshotId]?.document;
    expect(frozen ? rootView(frozen).encodings.x : undefined).toBeUndefined();
  });

  test("deleting a pinned snapshot clears the pin", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(state, worldActions.pinSnapshot({ slot: 0, snapshotId }));
    state = world(state, worldActions.deleteSnapshot(snapshotId));
    // A pin naming a snapshot that is gone renders an empty compare slot with
    // no way to tell why.
    expect(state.pins[0]).toBeNull();
  });
});

describe("canonical transforms", () => {
  test("toggling disables without deleting", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.addTransform({
        docId,
        transform: {
          id: "s1",
          kind: "core:limit",
          input: { kind: "source", sourceId: "pending" },
          enabled: true,
          state: "complete",
          count: 10,
        },
      }),
    );
    state = world(state, worldActions.toggleTransform({ docId, transformId: "s1" }));
    expect(orderedTransformIds(state.docs[docId]!)).toEqual(["s1"]);
    expect(state.docs[docId]?.transforms.s1?.enabled).toBe(false);
  });

  test("moving a transform past either end is a no-op", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.addTransform({
        docId,
        transform: {
          id: "s1",
          kind: "core:limit",
          input: { kind: "source", sourceId: "pending" },
          enabled: true,
          state: "complete",
          count: 10,
        },
      }),
    );
    state = world(state, worldActions.moveTransform({ docId, transformId: "s1", by: -1 }));
    expect(orderedTransformIds(state.docs[docId]!)).toEqual(["s1"]);
    expect(JSON.stringify(state.docs[docId])).not.toContain("typeOverrides");
  });
});

describe("the trace ring", () => {
  test("drops from the front at the cap", () => {
    let { state, docId } = withDoc();
    for (let i = 0; i < TRACE_CAP + 25; i++) {
      state = world(state, worldActions.setGeom({ docId, geom: i % 2 ? "line" : "point" }));
    }
    expect(state.trace).toHaveLength(TRACE_CAP);
    // Newest kept, oldest dropped — the opposite would make the tail useless.
    expect(state.trace[state.trace.length - 1]?.seq).toBeGreaterThan(TRACE_CAP);
  });
});

/* ------------------------------------------------------------- verb seam -- */

describe("verbs become actions", () => {
  // Both lookups over the same fixture, so schema and rows agree (DR-40).
  const env = (state: WorldState) =>
    environmentFor(
      state,
      () => readings,
      () =>
        readings.fields.map((field) => ({
          ...field,
          fieldId: fieldRef("source:root", field.name).fieldId,
        })),
    );

  /**
   * `actionsForVerb` takes the world since DATADROP-8 (DR-68), and may return
   * a thunk for a spatial verb. These world-verb cases never do, so the helper
   * narrows the result back to a plain action rather than every call site
   * casting.
   */
  const only = (results: unknown[]) => results[0] as Parameters<typeof world>[1];

  test("a verb naming a document targets that document", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "setMapping", docId, channel: "y", field: "data.temp_c" },
        { world: state },
        env(state),
      ),
    );
    const next = world(state, action);
    expect(rootView(next.docs[docId]!).encodings.y?.name).toBe("data.temp_c");
  });

  test("an ambient verb resolves at application time, not at menu-build time", () => {
    // The active document can change while a menu is open, so a null docId is
    // resolved by the reducer rather than baked into the verb.
    let { state } = withDoc();
    state = world(state, worldActions.newDoc(readings.source));
    const second = state.activeDocId as string;

    const action = only(
      actionsForVerb(
        { kind: "setMapping", docId: null, channel: "y", field: "data.temp_c" },
        { world: state },
        env(state),
      ),
    );
    const next = world(state, action);
    expect(rootView(next.docs[second]!).encodings.y?.name).toBe("data.temp_c");
  });

  test("addFilter mints a step against the schema as of the pipeline's end", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "addFilter", docId, field: "data.station", op: "=", value: "north" },
        { world: state },
        env(state),
      ),
    );
    const next = world(state, action);
    const transform = next.docs[docId]?.transforms[orderedTransformIds(next.docs[docId]!)[0]!];
    expect(transform).toMatchObject({ kind: "core:filter", enabled: true });
    expect(JSON.stringify(transform)).toContain("data.station");
    expect(JSON.stringify(transform)).toContain("north");
  });

  test("addFilter keeps a blank descriptor predicate inactive", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "addFilter", docId, field: "data.temp_c", op: "=", value: "" },
        { world: state },
        env(state),
      ),
    );
    const next = world(state, action);
    const transform = next.docs[docId]?.transforms[orderedTransformIds(next.docs[docId]!)[0]!];
    expect(transform).toMatchObject({ kind: "core:filter", enabled: false });
  });
});

/* ----------------------------------------------------------- persistence -- */

describe("persistence is defensive", () => {
  /** A seed holding the pinned pages plus the workspaces given, all in the work stage unless said otherwise. */
  const seedWith = (
    workspaces: { id: string; name: string; stageId?: string }[],
    current = workspaces[0]?.id,
  ): DatalabSeed =>
    compileSeed({
      stages: pinnedDefinitions().stages,
      workspaces: [
        ...pinnedDefinitions().workspaces,
        ...workspaces.map((space) => ({
          id: space.id,
          name: space.name,
          stageId: space.stageId ?? WORK_STAGE_ID,
          spec: tile("chart"),
        })),
      ],
      apps,
      current,
    });

  /** The version-6 envelope a previous session would have written for a seed. */
  const payloadFor = (seed: DatalabSeed) => ({
    version: PERSISTENCE_VERSION,
    world: { docs: {}, docOrder: [], snapshots: {} },
    workbench: toJson(WorkbenchDocumentSchema, seed.document) as Record<string, unknown>,
    navigation: durableNavigation(seed.navigation),
    workspaceId: seed.workspaceId,
  });

  const workspaceIds = (seed: DatalabSeed) => seed.document.workspaces.map((space) => space.id);

  test("a payload from another version is refused", () => {
    const payload = payloadFor(seedWith([{ id: "mine", name: "mine" }]));
    expect(validate({ ...payload, version: 99 }, apps)).toBeNull();
    expect(validate({ ...payload, version: PERSISTENCE_VERSION + 1 }, apps)).toBeNull();
  });

  test("a well-formed payload is accepted, and lands where the user was", () => {
    const valid = validate(payloadFor(seedWith([{ id: "mine", name: "mine" }])), apps);
    expect(valid).not.toBeNull();
    expect(valid?.seed.workspaceId).toBe("mine");
    expect(valid?.seed.document.workspaces.find((space) => space.id === "mine")?.name).toBe("mine");
    expect(valid?.seed.navigation.workspace.mine).toEqual({
      stageId: WORK_STAGE_ID,
      pinned: false,
      apps: null,
    });
  });

  test("a missing or malformed navigation is refused", () => {
    const payload = payloadFor(seedWith([{ id: "mine", name: "mine" }]));
    const { navigation: _, ...withoutNavigation } = payload;
    expect(validate(withoutNavigation, apps)).toBeNull();
    expect(validate({ ...payload, navigation: null }, apps)).toBeNull();
    expect(validate({ ...payload, navigation: { stages: "nope" } }, apps)).toBeNull();
    expect(
      validate(
        { ...payload, navigation: { ...payload.navigation, workspace: { mine: { stageId: 7 } } } },
        apps,
      ),
    ).toBeNull();
  });

  test("a workbench that is not a document is refused rather than rendered", () => {
    const payload = payloadFor(seedWith([{ id: "mine", name: "mine" }]));
    expect(validate({ ...payload, workbench: 42 }, apps)).toBeNull();
    expect(validate({ ...payload, workbench: { workspaces: "nope" } }, apps)).toBeNull();
  });

  test("a dangling placement view reference fails the structural parse", () => {
    const seed = seedWith([{ id: "mine", name: "mine" }]);
    const payload = payloadFor(seed);
    const views = payload.workbench.views as Record<string, unknown>;
    const mine = seed.document.workspaces.find((space) => space.id === "mine")!;
    const viewId = mine.tree?.body.case === "leaf" ? mine.tree.body.value.viewId : "";
    expect(views[viewId]).toBeDefined();
    delete views[viewId];
    payload.workbench.viewOrder = (payload.workbench.viewOrder as string[]).filter(
      (id) => id !== viewId,
    );
    expect(validate(payload, apps)).toBeNull();
  });

  test("a view naming an application this build lacks is refused", () => {
    // The structural parse lets it through — a retired application on a
    // PINNED page is replaced from code at the merge — but one the user's own
    // workspace still shows has nothing to render, and the catalog says so.
    const seed = seedWith([{ id: "mine", name: "mine" }]);
    const payload = payloadFor(seed);
    const mine = seed.document.workspaces.find((space) => space.id === "mine")!;
    const viewId = mine.tree?.body.case === "leaf" ? mine.tree.body.value.viewId : "";
    const views = payload.workbench.views as Record<string, { appId: string }>;
    views[viewId]!.appId = "retired-application";
    expect(validate(payload, apps)).toBeNull();
  });

  test("a workspaceId naming a missing workspace falls back to the work stage, never the sign-in page", () => {
    const seed = seedWith([{ id: "mine", name: "mine" }]);
    const valid = validate({ ...payloadFor(seed), workspaceId: "gone" }, apps);
    expect(valid).not.toBeNull();
    expect(workspaceIds(valid!.seed)).toContain(valid!.seed.workspaceId);
    // The first workspace in document order is the sign-in page; a restored
    // layout must not land there. The work stage's own workspace is where the
    // signed-in product starts, and the gate moves a visitor on from it.
    expect(valid!.seed.navigation.workspace[valid!.seed.workspaceId]?.stageId).toBe(WORK_STAGE_ID);
  });

  test("the hardwired workspaces are restored from code, not from storage", () => {
    // DR-29. A user who deleted the account workspace in a previous release
    // must get it back, and a stored tree under a pinned id must not win.
    const seed = compileSeed({
      stages: pinnedDefinitions().stages,
      workspaces: [
        ...pinnedDefinitions().workspaces.filter((space) => space.id !== ACCOUNT_SPACE_ID),
        {
          id: ACCOUNT_SPACE_ID,
          name: "renamed by a user",
          stageId: ACCOUNT_STAGE_ID,
          spec: tile("chart"),
        },
      ],
      apps,
      current: ACCOUNT_SPACE_ID,
    });
    const valid = validate(payloadFor(seed), apps);

    const ids = valid ? workspaceIds(valid.seed) : [];
    expect(ids).toContain(SIGNIN_SPACE_ID);
    expect(ids).toContain(ACCOUNT_SPACE_ID);
    // Exactly once: merging must not duplicate a pinned workspace that was stored.
    expect(ids.filter((id) => id === ACCOUNT_SPACE_ID)).toHaveLength(1);

    const account = valid?.seed.document.workspaces.find((space) => space.id === ACCOUNT_SPACE_ID);
    expect(account?.name).toBe("profile");
    expect(account?.tree?.body.case).toBe("split");
    expect(valid?.seed.navigation.workspace[ACCOUNT_SPACE_ID]?.pinned).toBe(true);
  });

  test("credential-shaped keys are detected anywhere in the payload", () => {
    // A snapshot is designed to be shared. One carrying a bearer token is a
    // credential-exfiltration feature, so `save` refuses rather than truncates.
    expect(findSecrets({ a: { b: { token: "x" } } })).toEqual(["a.b.token"]);
    expect(findSecrets({ spec: { source: { drop: "lab" } } })).toEqual([]);
  });

  test("findSecrets survives a cycle", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(findSecrets(cyclic)).toEqual([]);
  });

  /**
   * Transient navigation state is excluded from what `save` writes.
   *
   * `save()` writes the durable subset by name rather than passing the slice
   * whole, which is what makes a new transient field safe *by default* — but
   * only until someone reaches for a spread. This asserts the property rather
   * than the convention (DATALAB-VIEW-001 design-doc/02 §14): the failure it
   * catches produces no error and no visible symptom until the next reload
   * opens a modal over a tile that may no longer exist (DR-69).
   */
  test("no transient navigation field reaches storage, and what does reach it loads", () => {
    const written: Record<string, string> = {};
    const previous = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: (key: string, value: string) => {
        written[key] = value;
      },
      getItem: (key: string) => written[key] ?? null,
      removeItem: (key: string) => {
        delete written[key];
      },
    };

    try {
      const ids = sequentialIds();
      const seed = seedWith([{ id: "mine", name: "mine" }]);
      const rt = createDatalabRuntime({ seed, apps, ids, ownership: "trust" });
      rt.store.dispatch(navigationActions.openLauncher({ kind: "replace", placementId: "n" }));
      rt.store.dispatch(navigationActions.beginRename("n"));
      rt.store.dispatch(
        navigationActions.openImport({
          target: { kind: "stage" },
          prefill: "secret-ish",
          from: "clipboard",
        }),
      );
      rt.store.dispatch(navigationActions.showNotice({ ok: true, title: "Copied", body: "…" }));
      rt.store.dispatch(navigationActions.setJustSignedUp(true));

      const core = rt.core.getState();
      save(
        "test-key",
        rt.store.getState().world,
        { document: core.document, workspaceId: core.session.workspaceId },
        rt.store.getState().navigation,
      );

      const stored = written["test-key"];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored as string) as {
        version: number;
        navigation: Record<string, unknown>;
      };
      expect(parsed.version).toBe(PERSISTENCE_VERSION);
      expect(Object.keys(parsed).sort()).toEqual([
        "navigation",
        "version",
        "workbench",
        "workspaceId",
        "world",
      ]);
      expect(Object.keys(parsed.navigation).sort()).toEqual([
        "rememberedWorkspaceByStage",
        "stages",
        "workspace",
      ]);
      expect(stored).not.toContain("secret-ish");
      // And the round trip: what the runtime wrote is what a runtime can be built from.
      expect(validate(parsed, apps)?.seed.workspaceId).toBe("mine");
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = previous;
    }
  });
});

import { describe, expect, test } from "vitest";
import {
  currentStageId,
  emptyNavigation,
  landingWorkspaceOf,
  navigationSlice,
  reconcileNavigation,
  type NavigationState,
} from "../src/store/navigation";
import { WORK_STAGE_ID } from "../src/store/stageIds";

/**
 * The navigation slice: Datalab's metadata above the workbench document
 * (PBUI-DATALAB-WORKBENCH-1 Phase 1). The stage invariants of design §11.3,
 * stated over the pure reconcile and the reducers, with the document
 * represented by its workspace ids in order.
 */

const reduce = navigationSlice.reducer;
const chrome = { masthead: true, workspaces: true, stageBar: true };

function twoStages(): NavigationState {
  return {
    ...emptyNavigation(),
    stages: [
      { id: WORK_STAGE_ID, name: "work", apps: null, chrome, pinned: true },
      { id: "s2", name: "two", apps: ["chart"], chrome },
    ],
    workspace: {
      "w-a": { stageId: WORK_STAGE_ID, pinned: false, apps: null },
      "w-b": { stageId: WORK_STAGE_ID, pinned: false, apps: null },
      "t-a": { stageId: "s2", pinned: false, apps: null },
      "t-b": { stageId: "s2", pinned: false, apps: ["chart"] },
    },
    rememberedWorkspaceByStage: { [WORK_STAGE_ID]: "w-a", s2: "t-b" },
  };
}

const DOCUMENT = ["w-a", "w-b", "t-a", "t-b"];

describe("the current stage is derived from the selected workspace", () => {
  test("a workspace's stage is the current stage", () => {
    expect(currentStageId(twoStages(), "t-a")).toBe("s2");
    expect(currentStageId(twoStages(), "w-b")).toBe(WORK_STAGE_ID);
  });

  test("an unknown workspace reads as the work stage", () => {
    expect(currentStageId(twoStages(), "nope")).toBe(WORK_STAGE_ID);
  });

  test("selecting a stage lands on its remembered workspace, else its first", () => {
    expect(landingWorkspaceOf(twoStages(), DOCUMENT, "s2")).toBe("t-b");
    const forgotten = { ...twoStages(), rememberedWorkspaceByStage: {} };
    expect(landingWorkspaceOf(forgotten, DOCUMENT, "s2")).toBe("t-a");
    expect(landingWorkspaceOf(twoStages(), ["w-a", "w-b"], "s2")).toBeNull();
  });
});

describe("reconcileNavigation", () => {
  test("returns the same object when nothing needs repair", () => {
    const state = twoStages();
    expect(reconcileNavigation(state, DOCUMENT)).toBe(state);
  });

  test("a workspace the document holds but the metadata lacks joins the work stage", () => {
    const next = reconcileNavigation(twoStages(), [...DOCUMENT, "fresh"]);
    expect(next.workspace.fresh).toEqual({ stageId: WORK_STAGE_ID, pinned: false, apps: null });
  });

  test("metadata for a workspace the document lacks is dropped, and its memory with it", () => {
    const next = reconcileNavigation(twoStages(), ["w-b", "t-a", "t-b"]);
    expect(next.workspace["w-a"]).toBeUndefined();
    expect(next.rememberedWorkspaceByStage[WORK_STAGE_ID]).toBe("w-b");
  });

  test("a workspace naming a stage that is gone joins work rather than vanishing", () => {
    const state = twoStages();
    state.stages = state.stages.filter((stage) => stage.id !== "s2");
    const next = reconcileNavigation(state, DOCUMENT);
    expect(next.workspace["t-a"]?.stageId).toBe(WORK_STAGE_ID);
    expect(next.rememberedWorkspaceByStage.s2).toBeUndefined();
  });

  test("a remembered workspace that moved stages is replaced by the stage's first", () => {
    const state = twoStages();
    state.workspace["t-b"] = { stageId: WORK_STAGE_ID, pinned: false, apps: null };
    const next = reconcileNavigation(state, DOCUMENT);
    expect(next.rememberedWorkspaceByStage.s2).toBe("t-a");
  });
});

describe("the reducers", () => {
  test("forgetting a workspace clears any stage that remembered it", () => {
    const next = reduce(twoStages(), navigationSlice.actions.forgetWorkspace("t-b"));
    expect(next.workspace["t-b"]).toBeUndefined();
    expect(next.rememberedWorkspaceByStage.s2).toBeUndefined();
  });

  test("moving a workspace changes its stage and drops the old stage's memory of it", () => {
    const next = reduce(
      twoStages(),
      navigationSlice.actions.moveWorkspace({ id: "w-a", stageId: "s2" }),
    );
    expect(next.workspace["w-a"]?.stageId).toBe("s2");
    expect(next.rememberedWorkspaceByStage[WORK_STAGE_ID]).toBeUndefined();
  });

  test("moving to a stage that does not exist is a no-op", () => {
    const state = twoStages();
    expect(
      reduce(state, navigationSlice.actions.moveWorkspace({ id: "w-a", stageId: "gone" })),
    ).toEqual(state);
  });

  test("a pinned stage refuses removal and rename; the last stage refuses removal", () => {
    const state = twoStages();
    expect(reduce(state, navigationSlice.actions.removeStage(WORK_STAGE_ID)).stages).toHaveLength(
      2,
    );
    expect(
      reduce(state, navigationSlice.actions.renameStage({ stageId: WORK_STAGE_ID, name: "mine" }))
        .stages[0]?.name,
    ).toBe("work");
    const one = reduce(state, navigationSlice.actions.removeStage("s2"));
    expect(one.stages).toHaveLength(1);
    expect(reduce(one, navigationSlice.actions.removeStage(WORK_STAGE_ID)).stages).toHaveLength(1);
  });

  test("a user stage can be added, renamed and removed", () => {
    let state = reduce(
      twoStages(),
      navigationSlice.actions.addStage({ id: "s3", name: "client demo", apps: null, chrome }),
    );
    expect(state.stages.map((stage) => stage.id)).toEqual([WORK_STAGE_ID, "s2", "s3"]);
    state = reduce(state, navigationSlice.actions.renameStage({ stageId: "s3", name: "demo" }));
    expect(state.stages[2]?.name).toBe("demo");
    state = reduce(state, navigationSlice.actions.removeStage("s3"));
    expect(state.stages).toHaveLength(2);
  });

  test("replacing the durable part clears the transient targets", () => {
    let state = reduce(
      twoStages(),
      navigationSlice.actions.openLauncher({ kind: "replace", placementId: "n" }),
    );
    state = reduce(state, navigationSlice.actions.beginRename("n"));
    state = reduce(state, navigationSlice.actions.replaceNavigation(twoStages()));
    expect(state.launcher).toBeNull();
    expect(state.renamingId).toBeNull();
  });
});

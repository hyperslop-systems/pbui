import { describe, expect, test } from "vitest";
import { parseWorkbenchListJSON, parseWorkbenchResourceJSON } from "../src/api/workbenchProtocol";

describe("workbench protocol cache projections", () => {
  test("keeps uint64 revisions exact without placing bigint in Redux", () => {
    const resource = parseWorkbenchResourceJSON({
      workbench: {
        format: "pbui.workbench",
        schemaVersion: 1,
        id: "bench",
        name: "Bench",
        workspaces: [],
        views: {},
        viewOrder: [],
        documents: {},
      },
      revision: "9007199254740993",
      createdAt: "2026-07-30T12:00:00Z",
      updatedAt: "2026-07-30T12:01:00Z",
    });

    expect(resource.revision).toBe("9007199254740993");
    expect(resource.createdAt).toBe("2026-07-30T12:00:00Z");
    expect(JSON.stringify(resource)).toContain('"revision":"9007199254740993"');
  });

  test("projects list summary revisions and timestamps to strings", () => {
    const list = parseWorkbenchListJSON({
      workbenches: [
        {
          id: "bench",
          name: "Bench",
          revision: "18446744073709551615",
          updatedAt: "2026-07-30T12:01:00Z",
        },
      ],
    });

    expect(list.workbenches).toEqual([
      {
        id: "bench",
        name: "Bench",
        revision: "18446744073709551615",
        updatedAt: "2026-07-30T12:01:00Z",
      },
    ]);
    expect(() => JSON.stringify(list)).not.toThrow();
  });
});

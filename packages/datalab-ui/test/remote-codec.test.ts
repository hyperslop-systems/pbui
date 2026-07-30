import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  decodeRemoteWorkbench,
  encodeRemoteWorkbench,
  parseRemoteWorkbenchJSON,
  workbenchDocumentJSON,
} from "../src/remote/codec";

const fixture = (kind: "valid" | "invalid", name: string): unknown =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../../../contracts/workbench/v1", kind, name),
      "utf8",
    ),
  );

describe("remote workbench codec", () => {
  test("round-trips one linked view across two workspace placements", () => {
    const source = fixture("valid", "linked-view.json");
    const decoded = decodeRemoteWorkbench(parseRemoteWorkbenchJSON(source));
    expect(decoded.workspaces.map((workspace) => workspace.tree)).toEqual([
      expect.objectContaining({ id: "placement-overview", viewId: "view-chart" }),
      expect.objectContaining({ id: "placement-detail", viewId: "view-chart" }),
    ]);
    expect(workbenchDocumentJSON(encodeRemoteWorkbench(decoded))).toEqual(source);
  });

  test("rejects a view map key that disagrees with its embedded ID", () => {
    expect(() =>
      decodeRemoteWorkbench(parseRemoteWorkbenchJSON(fixture("invalid", "view-key-mismatch.json"))),
    ).toThrow("inconsistent identity");
  });
});

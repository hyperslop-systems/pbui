import { readFileSync } from "node:fs";
import { fromJson, toJson, type JsonObject } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { WorkbenchDocumentSchema } from "./index";

// The same cross-language fixture pkg/workbench asserts in TestSharedFixtures:
// a document whose two workspaces both place the one linked view. Vitest runs
// with the package directory as cwd, so the repo root is two levels up; the
// relative path resolves against cwd.
const fixturePath = "../../contracts/workbench/v1/valid/linked-view.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as JsonObject;

describe("workbench protocol schemas", () => {
  it("parses the shared linked-view fixture", () => {
    const document = fromJson(WorkbenchDocumentSchema, fixture, {
      ignoreUnknownFields: false,
    });
    expect(document.format).toBe("pbui.workbench");
    expect(document.schemaVersion).toBe(1);
    expect(document.workspaces).toHaveLength(2);
    for (const workspace of document.workspaces) {
      const body = workspace.tree?.body;
      expect(body?.case).toBe("leaf");
      if (body?.case === "leaf") {
        expect(body.value.viewId).toBe("view-chart");
      }
    }
    expect(Object.keys(document.views)).toContain("view-chart");
  });

  it("round-trips the fixture through toJson", () => {
    const document = fromJson(WorkbenchDocumentSchema, fixture, {
      ignoreUnknownFields: false,
    });
    expect(toJson(WorkbenchDocumentSchema, document)).toEqual(fixture);
  });

  it("rejects unknown fields, mirroring workbenchapi.Unmarshal", () => {
    expect(() =>
      fromJson(
        WorkbenchDocumentSchema,
        { ...fixture, unexpected: true },
        { ignoreUnknownFields: false },
      ),
    ).toThrow();
  });
});

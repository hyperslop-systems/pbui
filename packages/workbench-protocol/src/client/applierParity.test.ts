import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fromJson, toJson, type JsonObject, type JsonValue } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { MutationSchema, WorkbenchDocumentSchema } from "../index.js";
import { applyMutation, MutationError } from "./index.js";

/**
 * The TS half of the cross-language applier parity suite (design DR-U5,
 * section 5.3): every fixture in fixtures/mutations is applied here AND by
 * pkg/workbench/parity_fixtures_test.go, against the same expected document.
 *
 * Vitest runs with the package directory as cwd; the relative path resolves
 * against cwd (this package's vitest setup breaks on new URL(import.meta.url),
 * so never use it here).
 */
const fixtureDir = "fixtures/mutations";

interface Fixture {
  name: string;
  document: JsonObject;
  mutation: JsonObject;
  expected?: JsonObject;
  error?: boolean;
  errorCode?: string;
}

const files = readdirSync(fixtureDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("applier parity fixtures", () => {
  it("has a meaningful corpus", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(fixtureDir, file), "utf8")) as Fixture;

    it(fixture.name, () => {
      const document = fromJson(WorkbenchDocumentSchema, fixture.document as JsonValue, {
        ignoreUnknownFields: false,
      });
      const mutation = fromJson(MutationSchema, fixture.mutation as JsonValue, {
        ignoreUnknownFields: false,
      });

      if (fixture.error) {
        let caught: unknown = null;
        try {
          applyMutation(document, mutation);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(MutationError);
        expect((caught as MutationError).code).toBe(fixture.errorCode);
        return;
      }

      const applied = applyMutation(document, mutation);
      expect(toJson(WorkbenchDocumentSchema, applied)).toEqual(fixture.expected);
      // The applier must never mutate its input.
      expect(toJson(WorkbenchDocumentSchema, document)).toEqual(fixture.document);
    });
  }
});

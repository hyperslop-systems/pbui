import { describe, expect, test } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  DocumentPayloadSchema,
  MutationSchema,
} from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import {
  documentSourceMutations,
  emptyDocument,
  sequentialIds,
} from "@hyperslop-systems/workbench-core";
import {
  GRAPHIC_DOCUMENT_FORMAT,
  GRAPHIC_SOURCE_ID,
  graphicDocumentSource,
  graphicStub,
  graphicStubMutation,
  isGraphicStub,
} from "../src/store/graphicSource";

/**
 * The world as a workbench document source (PBUI-DATALAB-WORKBENCH-1 Phase 1,
 * design §6.3): identity stubs only, owned by the source, never a copy of
 * the graphic — and a bound stub survives whether or not the world has the
 * document yet.
 */

const world = (...ids: string[]) => ({ docOrder: ids });

describe("graphic document stubs", () => {
  test("a stub carries identity, format, schema version and the owner mark, and nothing analytical", () => {
    const stub = graphicStub("d1");
    expect(stub.id).toBe("d1");
    expect(stub.format).toBe(GRAPHIC_DOCUMENT_FORMAT);
    expect(stub.schemaVersion).toBe(2);
    expect(stub.body).toEqual({ $source: GRAPHIC_SOURCE_ID });
    expect(isGraphicStub(stub)).toBe(true);
  });

  test("a full graphic payload is not a stub", () => {
    const full = create(DocumentPayloadSchema, {
      id: "d1",
      format: GRAPHIC_DOCUMENT_FORMAT,
      schemaVersion: 2,
      body: { name: "α", sources: {}, transforms: {}, views: {}, rootView: "v", parameters: {} },
    });
    expect(isGraphicStub(full)).toBe(false);
  });
});

describe("the source over the world", () => {
  test("lists every world document by id, and only ids", () => {
    const source = graphicDocumentSource(() => world("a", "b"));
    expect(source.list()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(source.update).toBe("identity-only");
  });

  test("a new world document gets a stub; an existing stub is left alone", () => {
    const source = graphicDocumentSource(() => world("a", "b"));
    const doc = applyMutations(emptyDocument({ ids: sequentialIds() }), [graphicStubMutation("a")]);
    const { mutations, collisions } = documentSourceMutations(doc, source);
    expect(collisions).toEqual([]);
    expect(mutations.map((m) => m.body.case)).toEqual(["documentPut"]);
    expect(mutations[0]?.body.case === "documentPut" && mutations[0].body.value.document?.id).toBe(
      "b",
    );
  });

  test("a stub the world no longer holds is deleted when unbound and kept while bound", () => {
    const source = graphicDocumentSource(() => world("a"));
    const ids = sequentialIds();
    const view = create(AppViewSchema, {
      id: "v1",
      appId: "chart",
      documents: { primary: "gone-but-bound" },
    });
    const doc = applyMutations(emptyDocument({ ids }), [
      graphicStubMutation("a"),
      graphicStubMutation("gone-but-bound"),
      graphicStubMutation("gone-and-free"),
      create(MutationSchema, { body: { case: "viewCreate", value: { view } } }),
    ]);
    const { mutations } = documentSourceMutations(doc, source);
    expect(
      mutations.map((m) =>
        m.body.case === "documentDelete" ? m.body.value.documentId : m.body.case,
      ),
    ).toEqual(["gone-and-free"]);
  });

  test("a stub of another format under a listed id is a collision, never overwritten", () => {
    const source = graphicDocumentSource(() => world("a"));
    const foreign = create(DocumentPayloadSchema, {
      id: "a",
      format: "other.format",
      schemaVersion: 1,
      body: {},
    });
    const doc = applyMutations(emptyDocument({ ids: sequentialIds() }), [
      create(MutationSchema, { body: { case: "documentPut", value: { document: foreign } } }),
    ]);
    const { mutations, collisions } = documentSourceMutations(doc, source);
    expect(mutations).toEqual([]);
    expect(collisions).toEqual([{ id: "a", format: "other.format" }]);
  });
});

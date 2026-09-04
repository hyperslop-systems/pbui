import { describe, expect, expectTypeOf, test } from "vitest";
import {
  localRevision,
  newOperationId,
  nextLocalRevision,
  operationId,
  serverRevision,
  type LocalRevision,
  type OperationId,
  type ServerRevision,
} from "./identity";

describe("Workbench identity types", () => {
  test("keep local, server, and operation identity distinct at compile time", () => {
    expectTypeOf<LocalRevision>().not.toEqualTypeOf<ServerRevision>();
    expectTypeOf<LocalRevision>().not.toEqualTypeOf<OperationId>();
    expectTypeOf<ServerRevision>().not.toEqualTypeOf<OperationId>();
  });

  test("constructs non-negative safe local revisions", () => {
    expect(localRevision(0)).toBe(0);
    expect(localRevision(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => localRevision(-1)).toThrow("local revision must be a non-negative safe integer");
    expect(() => localRevision(1.5)).toThrow("local revision must be a non-negative safe integer");
    expect(() => localRevision(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "local revision must be a non-negative safe integer",
    );
  });

  test("advances local revisions without permitting unsafe overflow", () => {
    expect(nextLocalRevision(localRevision(7))).toBe(8);
    expect(() => nextLocalRevision(localRevision(Number.MAX_SAFE_INTEGER))).toThrow(
      "local revision must be a non-negative safe integer",
    );
  });

  test("keeps server revisions opaque while rejecting the absent token", () => {
    expect(serverRevision("00042")).toBe("00042");
    expect(serverRevision(" opaque ")).toBe(" opaque ");
    expect(() => serverRevision("")).toThrow("server revision must not be empty");
  });

  test("constructs and mints operation IDs", () => {
    expect(operationId("workbench-operation")).toBe("workbench-operation");
    expect(() => operationId("")).toThrow("operation id must not be empty");
    expect(newOperationId(() => "123e4567-e89b-12d3-a456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(() => newOperationId(() => "")).toThrow("operation id must not be empty");
  });
});

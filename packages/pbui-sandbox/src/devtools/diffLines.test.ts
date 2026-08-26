import { describe, expect, test } from "vitest";
import { diffLines, trimContext } from "./diffLines";

const ops = (before: string, after: string) => diffLines(before, after).rows.map((r) => `${r.op[0]}${r.text}`);

describe("diffLines", () => {
  test("identical, empty, insert, delete, replace", () => {
    expect(ops("a\nb\n", "a\nb\n")).toEqual(["ca", "cb"]);
    expect(diffLines("", "")).toEqual({ rows: [], added: 0, removed: 0, beforeStart: 1, afterStart: 1 });
    expect(ops("", "x\n")).toEqual(["ax"]);
    expect(ops("a\nb\nc\n", "a\nb\nX\nc\n")).toEqual(["ca", "cb", "aX", "cc"]);
    expect(ops("a\nb\nc\n", "a\nc\n")).toEqual(["ca", "rb", "cc"]);
    const replaced = diffLines("a\nb\nc\n", "a\nB\nc\n");
    expect(replaced.rows.map((r) => r.op)).toEqual(["context", "remove", "add", "context"]);
    expect(replaced).toMatchObject({ added: 1, removed: 1 });
  });

  test("numbers lines on each side", () => {
    const hunk = diffLines("a\nb\n", "b\nc\n");
    expect(hunk.rows).toEqual([
      { op: "remove", text: "a", before: 1, after: null },
      { op: "context", text: "b", before: 2, after: 1 },
      { op: "add", text: "c", before: null, after: 2 },
    ]);
  });

  test("trimContext keeps changes and their neighbours", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
    const after = before.replace("l10", "L10");
    const trimmed = trimContext(diffLines(before, after), 2);
    expect(trimmed.rows.map((r) => r.text)).toEqual(["l8", "l9", "l10", "L10", "l11", "l12"]);
    expect(trimmed.added).toBe(1);
  });
});

import { describe, expect, test } from "vitest";
import { formatMention, scanMentions, splitMentions, stripMentions, uniqueMentions } from "./mentions";

describe("mention tokenizer", () => {
  test("scans [[type:id|label]] with offsets", () => {
    const text = "why is [[field:t3.qty|qty]] skewed for [[product:2049]]?";
    expect(scanMentions(text)).toEqual([
      { type: "field", id: "t3.qty", label: "qty", start: 7, end: 27 },
      { type: "product", id: "2049", label: "", start: 39, end: 55 },
    ]);
  });

  test("trims ids and labels, skips empty ids, rejects bad types", () => {
    expect(scanMentions("[[order: 88213 | order 88213 ]]")).toEqual([
      { type: "order", id: "88213", label: "order 88213", start: 0, end: 31 },
    ]);
    expect(scanMentions("[[order:   ]]")).toEqual([]);
    expect(scanMentions("[[9bad:1|x]]")).toEqual([]);
    expect(scanMentions("[[source:E2|multi\nline]]")).toEqual([]);
  });

  test("allows dots, dashes and underscores in the type and any non-bracket id", () => {
    const [m] = scanMentions("[[my.type_v2-x:a/b#3|L]]");
    expect(m).toMatchObject({ type: "my.type_v2-x", id: "a/b#3", label: "L" });
  });

  test("uniqueMentions keeps the first occurrence of each key", () => {
    const mentions = scanMentions("[[product:1|a]] [[product:2|b]] [[product:1|c]]");
    expect(uniqueMentions(mentions).map((m) => m.label)).toEqual(["a", "b"]);
  });

  test("stripMentions replaces with label or id", () => {
    expect(stripMentions("see [[product:2049|Gold Eagle]] and [[metal:gold]]")).toBe("see Gold Eagle and gold");
  });

  test("formatMention round-trips through scanMentions", () => {
    const text = formatMention({ type: "product", id: "2049" }, "1oz Eagle ] 2024");
    expect(text).toBe("[[product:2049|1oz Eagle   2024]]");
    expect(scanMentions(text)[0]).toMatchObject({ type: "product", id: "2049" });
    expect(formatMention({ type: "metal", id: "gold" })).toBe("[[metal:gold]]");
  });

  test("splitMentions preserves surrounding text", () => {
    expect(splitMentions("a [[x:1|one]] b")).toEqual([
      { kind: "text", text: "a " },
      { kind: "mention", mention: { type: "x", id: "1", label: "one", start: 2, end: 13 } },
      { kind: "text", text: " b" },
    ]);
  });
});

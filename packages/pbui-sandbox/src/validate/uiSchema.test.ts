import { describe, expect, test } from "vitest";
import { withLimits } from "../limits";
import { assertUINode, countNodes, validateUINode } from "./uiSchema";

describe("assertUINode", () => {
  test("accepts every kind", () => {
    const tree = {
      kind: "column",
      children: [
        { kind: "panel", props: { title: "t" }, children: [{ kind: "text", text: "hi", props: { size: "tiny" } }] },
        { kind: "row", children: [{ kind: "badge", text: "b" }] },
        { kind: "button", props: { label: "go", onClick: { handler: "go", args: 1 }, variant: "framed" } },
        { kind: "input", props: { value: "", placeholder: "p", onChange: { handler: "c" } } },
        { kind: "select", props: { value: "a", options: [{ value: "a", label: "A" }], onChange: { handler: "s" } } },
        { kind: "table", props: { headers: ["a"], rows: [[1], ["x"]] } },
        { kind: "meter", props: { fraction: 0.5, label: "m" } },
        { kind: "sparkline", props: { points: [1, 2, 3] } },
        { kind: "callout", props: { variant: "warning", text: "careful" } },
        { kind: "ref", props: { reference: { type: "product", id: "2049" }, label: "gold" } },
      ],
    };
    expect(validateUINode(tree)).toBe(tree);
    expect(countNodes(validateUINode(tree))).toBe(13);
  });

  test("names the path and the known kinds for an unsupported kind", () => {
    expect(() => assertUINode({ kind: "column", children: [{ kind: "text", text: "a" }, { kind: "image" }] })).toThrow(
      /root\.children\[1\]\.kind 'image' is not supported; kinds: panel, row/,
    );
  });

  test("rejects a handler ref without a handler name", () => {
    expect(() => assertUINode({ kind: "button", props: { label: "x", onClick: { handler: "" } } })).toThrow(
      "root.props.onClick.handler must be a non-empty string",
    );
  });

  test("rejects a ref without type and id", () => {
    expect(() => assertUINode({ kind: "ref", props: { reference: { type: "product" } } })).toThrow(
      "root.props.reference.id must be a non-empty string",
    );
  });

  test("rejects a meter whose fraction is not finite", () => {
    expect(() => assertUINode({ kind: "meter", props: { fraction: Number.NaN } })).toThrow("root.props.fraction must be a finite number");
  });

  test("enforces the node, depth, text and row limits", () => {
    const limits = withLimits({ treeNodes: 3, treeDepth: 2, textChars: 3, tableRows: 1 });
    expect(() =>
      assertUINode({ kind: "row", children: [{ kind: "text", text: "a" }, { kind: "text", text: "b" }, { kind: "text", text: "c" }] }, limits),
    ).toThrow("the tree has more than 3 nodes");
    expect(() => assertUINode({ kind: "row", children: [{ kind: "row", children: [{ kind: "text", text: "a" }] }] }, limits)).toThrow(
      "root.children[0].children[0] nests deeper than 2 levels",
    );
    expect(() => assertUINode({ kind: "text", text: "toolong" }, limits)).toThrow("root.text is 7 characters, the limit is 3");
    expect(() => assertUINode({ kind: "table", props: { headers: [], rows: [[1], [2]] } }, limits)).toThrow(
      "root.props.rows has 2 rows, the limit is 1",
    );
  });
});

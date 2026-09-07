import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { languageExtension } from "./extensions";

it("parses MySQL with the shared editor language compartment", () => {
  const state = EditorState.create({ doc: "SELECT `order_id`, refund_amount FROM orders_v1 WHERE order_id = ? LIMIT 50", extensions: [languageExtension("sql")] });
  const tree = syntaxTree(state).toString();
  expect(tree).toContain("Keyword");
  expect(tree).toContain("Number");
  expect(tree).not.toContain("⚠");
});

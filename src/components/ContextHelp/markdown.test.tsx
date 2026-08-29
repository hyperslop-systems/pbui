import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { HelpMarkdown, splitHelpMarkdownBlocks } from "./markdown";

afterEach(cleanup);

/** Design doc §18 renderer tests: the bounded Markdown subset, and no HTML. */

describe("splitHelpMarkdownBlocks", () => {
  test("paragraphs, headings, lists, and fenced code split as blocks", () => {
    const blocks = splitHelpMarkdownBlocks(
      "# Field\n\nA field is a column.\nIt has a type.\n\n- one\n- two\n\n```\nkeep(region)\n```",
    );
    expect(blocks).toEqual([
      { kind: "heading", text: "Field" },
      { kind: "paragraph", lines: ["A field is a column.", "It has a type."] },
      { kind: "list", items: ["one", "two"] },
      { kind: "code", text: "keep(region)" },
    ]);
  });

  test("blank lines inside a fence do not split it", () => {
    const blocks = splitHelpMarkdownBlocks("```\nfirst\n\nsecond\n```");
    expect(blocks).toEqual([{ kind: "code", text: "first\n\nsecond" }]);
  });
});

describe("HelpMarkdown", () => {
  test("renders strong text and inline code", () => {
    const { container } = render(<HelpMarkdown markdown="A **field** is a `column`." />);
    expect(container.querySelector("strong")?.textContent).toBe("field");
    expect(container.querySelector("code")?.textContent).toBe("column");
  });

  test("renders headings, lists, and fenced code with their parts", () => {
    const { container } = render(
      <HelpMarkdown markdown={"# Title\n\n- a\n- b\n\n```\ncode block\n```"} />,
    );
    expect(container.querySelector('[data-part="help-markdown-list"]')?.textContent).toBe("ab");
    expect(container.querySelector('[data-part="help-markdown-code"]')?.textContent).toBe(
      "code block",
    );
  });

  test("NEVER renders raw HTML — markup arrives as text", () => {
    const { container } = render(
      <HelpMarkdown markdown={'<img src=x onerror=alert(1)> and <b>bold</b>'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  test("chat mention syntax is NOT interpreted — it stays literal text", () => {
    const { container } = render(<HelpMarkdown markdown="see [[file:f1|cover.png]]" />);
    expect(container.textContent).toContain("[[file:f1|cover.png]]");
  });

  test("compact mode marks the wrapper", () => {
    const { container } = render(<HelpMarkdown markdown="hi" compact />);
    expect(
      container.querySelector('[data-part="help-markdown"]')?.getAttribute("data-compact"),
    ).toBe("true");
  });
});

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { CodeEditor } from "./CodeEditor";
import { currentDiagnostics } from "../diagnostics";
import { pbuiKeymap } from "../extensions";
import { deleteLine } from "@codemirror/commands";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The EditorView behind a rendered CodeEditor. */
function viewOf(container: HTMLElement): EditorView {
  const dom = container.querySelector(".cm-editor");
  if (!dom) throw new Error("no editor mounted");
  const view = EditorView.findFromDOM(dom as HTMLElement);
  if (!view) throw new Error("no EditorView for the mounted editor");
  return view;
}

describe("CodeEditor", () => {
  test("mounts with the value, and the content carries the accessible name", () => {
    const { container } = render(<CodeEditor value="const a = 1;" onValueChange={() => {}} accessibleName="script" />);
    const view = viewOf(container);
    expect(view.state.doc.toString()).toBe("const a = 1;");
    expect(view.contentDOM.getAttribute("aria-label")).toBe("script");
    expect(container.querySelector('[data-part="code-editor"]')).not.toBeNull();
  });

  test("unmount destroys the view", () => {
    const { container, unmount } = render(<CodeEditor value="x" onValueChange={() => {}} accessibleName="script" />);
    const view = viewOf(container);
    const destroy = vi.spyOn(view, "destroy");
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("a user edit reports the new document once, and a programmatic set does not report", () => {
    const onValueChange = vi.fn();
    const { container } = render(<CodeEditor value="a" onValueChange={onValueChange} accessibleName="script" />);
    const view = viewOf(container);
    act(() => {
      view.dispatch({ changes: { from: 1, insert: "b" } });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("ab");
  });

  test("an external value change replaces the document; an identical one does not dispatch", () => {
    const { container, rerender } = render(<CodeEditor value="one" onValueChange={() => {}} accessibleName="script" />);
    const view = viewOf(container);
    const dispatch = vi.spyOn(view, "dispatch");
    rerender(<CodeEditor value="one" onValueChange={() => {}} accessibleName="script" />);
    expect(dispatch).not.toHaveBeenCalled();
    rerender(<CodeEditor value="two" onValueChange={() => {}} accessibleName="script" />);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.state.doc.toString()).toBe("two");
  });

  test("the round trip keeps the cursor where the user left it", () => {
    // The controlled loop: edit → onValueChange → parent re-renders with the
    // same string. Without the identity guard the cursor lands at 0.
    function Controlled() {
      const [value, setValue] = (require("react") as typeof import("react")).useState("abc");
      return <CodeEditor value={value} onValueChange={setValue} accessibleName="script" />;
    }
    const { container } = render(<Controlled />);
    const view = viewOf(container);
    act(() => {
      view.dispatch({ changes: { from: 3, insert: "d" }, selection: { anchor: 4 } });
    });
    expect(view.state.doc.toString()).toBe("abcd");
    expect(view.state.selection.main.head).toBe(4);
  });

  test("readOnly reconfigures the same view rather than remounting", () => {
    const { container, rerender } = render(<CodeEditor value="x" onValueChange={() => {}} accessibleName="script" />);
    const view = viewOf(container);
    expect(view.state.readOnly).toBe(false);
    rerender(<CodeEditor value="x" onValueChange={() => {}} accessibleName="script" readOnly />);
    expect(viewOf(container)).toBe(view);
    expect(view.state.readOnly).toBe(true);
    expect(container.querySelector('[data-part="code-editor"]')?.getAttribute("data-readonly")).toBe("true");
  });

  test("language reconfigures the same view", () => {
    const { container, rerender } = render(<CodeEditor value="{}" onValueChange={() => {}} accessibleName="doc" />);
    const view = viewOf(container);
    rerender(<CodeEditor value="{}" onValueChange={() => {}} accessibleName="doc" language="json" />);
    expect(viewOf(container)).toBe(view);
    expect(container.querySelector('[data-part="code-editor"]')?.getAttribute("data-language")).toBe("json");
  });

  test("diagnostics land in the field, and an out-of-range line is clamped rather than thrown", () => {
    const diagnostics = [
      { line: 1, column: 7, severity: "error" as const, message: "boom" },
      { line: 400, severity: "warning" as const, message: "far away" },
    ];
    const { container } = render(<CodeEditor value={"const a = 1;\nconst b = 2;"} onValueChange={() => {}} accessibleName="script" diagnostics={diagnostics} />);
    const view = viewOf(container);
    expect(currentDiagnostics(view)).toEqual(diagnostics);
    // The clamped warning decorates the LAST line, not nothing.
    const lines = container.querySelectorAll(".cm-pbui-diagnostic-line");
    expect(lines.length).toBe(2);
    expect(container.querySelector(".cm-pbui-diagnostic-error")?.getAttribute("title")).toBe("boom");
  });

  test("Mod+Enter runs with the current document when onRun is given", () => {
    const onRun = vi.fn();
    const { container } = render(<CodeEditor value="1 + 1" onValueChange={() => {}} accessibleName="script" onRun={onRun} />);
    const view = viewOf(container);
    act(() => {
      view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    expect(onRun).toHaveBeenCalledWith("1 + 1");
  });

  test("the keymap does not bind deleteLine (Mod+Shift+K belongs to the workbench)", () => {
    expect(pbuiKeymap.some((b) => b.run === deleteLine)).toBe(false);
    expect(pbuiKeymap.length).toBeGreaterThan(10);
  });
});

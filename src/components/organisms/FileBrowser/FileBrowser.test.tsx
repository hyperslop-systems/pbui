import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FileBrowser, type FileNode, type RootState } from "./FileBrowser";
import {
  createActionRegistry,
  createPresentationTypeGraph,
} from "../../../presentation/actions";
import { createPbui } from "../../../presentation/createPbui";
import { createPresentationRegistry } from "../../../presentation/registry";

afterEach(cleanup);

const TREE: FileNode = {
  id: "project:",
  name: "project",
  kind: "directory",
  children: [
    {
      id: "project:Mini",
      name: "Mini",
      kind: "directory",
      children: [
        { id: "project:Mini/Basic.lean", name: "Basic.lean", kind: "file", size: 120 },
        { id: "project:Mini/UsesBasic.lean", name: "UsesBasic.lean", kind: "file", size: 90 },
      ],
    },
    { id: "project:lakefile.lean", name: "lakefile.lean", kind: "file", size: 153 },
  ],
};

function verbs() {
  return {
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };
}

/** A controlled harness: expansion and selection live in state, as the
 *  product would hold them. */
function Harness({
  verbs: v,
  initialExpanded = new Set<string>(["project:"]),
  trees = { project: { status: "ready", tree: TREE } as RootState },
  roots = [{ name: "project" }],
  pageSize,
}: {
  verbs: ReturnType<typeof verbs>;
  initialExpanded?: Set<string>;
  trees?: Record<string, RootState | undefined>;
  roots?: { name: string; label?: string }[];
  pageSize?: number;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(initialExpanded);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <FileBrowser
      roots={roots}
      trees={trees}
      expanded={expanded}
      onToggle={(id) => {
        v.onToggle(id);
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }}
      selectedId={selectedId}
      onSelect={(node) => {
        v.onSelect(node);
        setSelectedId(node.id);
      }}
      onOpen={v.onOpen}
      onRename={v.onRename}
      onDelete={v.onDelete}
      pageSize={pageSize}
    />
  );
}

describe("FileBrowser", () => {
  test("no roots renders the DR-30 empty state", () => {
    const v = verbs();
    render(
      <FileBrowser
        roots={[]}
        trees={{}}
        expanded={new Set()}
        onToggle={v.onToggle}
        selectedId={null}
        onSelect={v.onSelect}
        onOpen={v.onOpen}
        onRename={v.onRename}
        onDelete={v.onDelete}
      />,
    );
    expect(screen.getByText(/no file roots/)).toBeTruthy();
  });

  test("a failed root reports why, instead of loading forever", () => {
    const v = verbs();
    render(
      <FileBrowser
        roots={[{ name: "project" }, { name: "vendor" }]}
        trees={{
          project: { status: "ready", tree: TREE },
          vendor: { status: "failed", reason: "vendor: permission denied" },
        }}
        expanded={new Set(["project:"])}
        onToggle={v.onToggle}
        selectedId={null}
        onSelect={v.onSelect}
        onOpen={v.onOpen}
        onRename={v.onRename}
        onDelete={v.onDelete}
      />,
    );
    expect(screen.getByText("vendor: permission denied")).toBeTruthy();
    // The distinction that did not exist before: this root is NOT loading.
    expect(screen.queryByText("loading…")).toBeNull();
  });

  test("a root with no entry yet is still loading", () => {
    const v = verbs();
    render(
      <FileBrowser
        roots={[{ name: "project" }]}
        trees={{}}
        expanded={new Set()}
        onToggle={v.onToggle}
        selectedId={null}
        onSelect={v.onSelect}
        onOpen={v.onOpen}
        onRename={v.onRename}
        onDelete={v.onDelete}
      />,
    );
    expect(screen.getByText("loading…")).toBeTruthy();
  });

  test("collapsed children never mount; expanding mounts them", () => {
    const v = verbs();
    render(<Harness verbs={v} />);
    // project: expanded; Mini collapsed → its children are NOT in the DOM.
    expect(screen.queryByText("Basic.lean")).toBeNull();
    expect(screen.getByText("Mini")).toBeTruthy();
    fireEvent.click(screen.getByText("Mini"));
    expect(v.onToggle).toHaveBeenCalledWith("project:Mini");
    // The harness applied the toggle; now the children mount.
    expect(screen.getByText("Basic.lean")).toBeTruthy();
  });

  test("click selects; double-click opens a file and never performs", () => {
    const v = verbs();
    render(<Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />);
    fireEvent.click(screen.getByText("Basic.lean"));
    expect(v.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project:Mini/Basic.lean" }),
    );
    expect(v.onOpen).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText("Basic.lean"));
    expect(v.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project:Mini/Basic.lean", kind: "file" }),
    );
  });

  test("keyboard: arrows move the focus row, Enter opens", () => {
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // project: -> Mini
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // Mini -> Basic.lean
    const focused = container.querySelector("[data-focused=true]");
    expect(focused?.textContent).toContain("Basic.lean");
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(v.onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: "Basic.lean" }));
  });

  test("ArrowRight expands a collapsed directory; ArrowLeft collapses", () => {
    const v = verbs();
    const { container } = render(<Harness verbs={v} />);
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus Mini
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    expect(v.onToggle).toHaveBeenCalledWith("project:Mini");
    // harness applied it; now collapse again
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(v.onToggle).toHaveBeenCalledTimes(2);
  });

  test("F2 renames in place; Enter commits, Escape discards", () => {
    const v = verbs();
    const { container, rerender } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // Basic.lean
    fireEvent.keyDown(tree, { key: "F2" });
    const input = screen.getByLabelText("rename Basic.lean") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(v.onRename).not.toHaveBeenCalled();

    fireEvent.keyDown(tree, { key: "F2" });
    const input2 = screen.getByLabelText("rename Basic.lean") as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "Renamed.lean" } });
    fireEvent.keyDown(input2, { key: "Enter" });
    expect(v.onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project:Mini/Basic.lean" }),
      "Renamed.lean",
    );
    rerender(<Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />);
  });

  test("keys typed into the rename field are not tree commands", () => {
    /*
     * The tree's key handler is on the tree, so every keystroke inside
     * InlineRename bubbles into it. Before the guard, pressing DELETE while
     * renaming called onDelete on the file being renamed — the product deleted
     * the file the user was in the middle of naming.
     */
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // Basic.lean
    fireEvent.keyDown(tree, { key: "F2" });

    const input = screen.getByLabelText("rename Basic.lean") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Delete" });
    expect(v.onDelete).not.toHaveBeenCalled();

    // Enter must commit the rename and NOT also open or toggle the row.
    fireEvent.change(input, { target: { value: "Renamed.lean" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(v.onRename).toHaveBeenCalled();
    expect(v.onOpen).not.toHaveBeenCalled();
  });

  test("ArrowLeft climbs to the parent when there is nothing to collapse", () => {
    // The component documents "Left collapses or climbs" and only collapsed:
    // on a file, or an already-closed directory, it did nothing, so a keyboard
    // user could descend and not get back out.
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // Mini
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // Basic.lean, a FILE at depth 2

    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(container.querySelector("[data-focused=true]")?.textContent).toContain("Mini");
    // And nothing was collapsed on the way.
    expect(v.onToggle).not.toHaveBeenCalled();
  });

  test("names the active row to assistive technology", () => {
    /*
     * Every treeitem is tabIndex={-1} and DOM focus stays on the tree, which is
     * the right shape for a composite widget — but without
     * aria-activedescendant a screen reader is never told which row Enter, F2
     * or Delete will act on. The roving highlight was a data attribute and a
     * CSS rule: visible to a sighted user and to nobody else.
     */
    const v = verbs();
    const { container } = render(<Harness verbs={v} />);
    const tree = container.querySelector("[role=tree]") as HTMLElement;

    fireEvent.keyDown(tree, { key: "ArrowDown" });
    const active = tree.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();

    // getElementById rather than a #id selector: jsdom has no CSS.escape, and
    // the ids contain characters a selector would need escaped anyway.
    const row = container.ownerDocument.getElementById(active!);
    expect(row?.getAttribute("data-focused")).toBe("true");
    expect(row?.textContent).toContain("Mini");
  });

  test("Delete asks the product to delete the focused row", () => {
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    const tree = container.querySelector("[role=tree]") as HTMLElement;
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "Delete" });
    expect(v.onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: "Basic.lean" }));
  });

  /*
   * An explicit timeout, because this test legitimately needs one.
   *
   * The second assertion mounts 5001 rows in jsdom, which lands either side of
   * vitest's 5000ms default depending on what else is running in parallel —
   * measured at 3 failures in 5 full-suite runs, and 0 in 6 runs of this file
   * alone. A test that fails half the time under load is worse than no test,
   * because the habit it teaches is re-running rather than reading.
   *
   * Raising the limit rather than shrinking the fixture: 5000 siblings is the
   * point. `pageSize` exists so that "a 50,000-node .lake/ directory costs
   * what a 50-node one costs", and a fixture small enough to be fast would not
   * exercise the claim.
   */
  test("windowing: 5000 siblings mount only a page, sentinel reveals the rest", { timeout: 20_000 }, () => {
    const many: FileNode = {
      id: "project:",
      name: "project",
      kind: "directory",
      children: Array.from({ length: 5000 }, (_, i) => ({
        id: `project:f${i}.lean`,
        name: `f${i}.lean`,
        kind: "file" as const,
      })),
    };
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} trees={{ project: { status: "ready", tree: many } }} pageSize={200} />,
    );
    const mountedRows = container.querySelectorAll("[data-part=file-row]");
    // 1 root row + 200 children; NOT 5001.
    expect(mountedRows.length).toBe(201);
    const more = screen.getByText(/show 4800 more/);
    fireEvent.click(more);
    expect(container.querySelectorAll("[data-part=file-row]").length).toBe(5001);
  });

  test("aria: tree roles, levels, and expansion state", () => {
    const v = verbs();
    const { container } = render(
      <Harness verbs={v} initialExpanded={new Set(["project:", "project:Mini"])} />,
    );
    expect(container.querySelector("[role=tree]")).toBeTruthy();
    const mini = screen.getByText("Mini").closest("[role=treeitem]") as HTMLElement;
    expect(mini.getAttribute("aria-expanded")).toBe("true");
    expect(mini.getAttribute("aria-level")).toBe("2");
    const basic = screen.getByText("Basic.lean").closest("[role=treeitem]") as HTMLElement;
    expect(basic.getAttribute("aria-expanded")).toBeNull();
    expect(basic.getAttribute("aria-level")).toBe("3");
  });
});

describe("FileBrowser presentation seam", () => {
  test("renderRow wraps each row's content (the product's Presentation hook)", () => {
    const v = verbs();
    render(
      <FileBrowser
        roots={[{ name: "project" }]}
        trees={{ project: { status: "ready", tree: TREE } }}
        expanded={new Set(["project:", "project:Mini"])}
        onToggle={v.onToggle}
        selectedId={null}
        onSelect={v.onSelect}
        onOpen={v.onOpen}
        onRename={v.onRename}
        onDelete={v.onDelete}
        renderRow={(node, children) => <span data-testid={`wrap-${node.id}`}>{children}</span>}
      />,
    );
    expect(screen.getByTestId("wrap-project:Mini/Basic.lean").textContent).toContain("Basic.lean");
    expect(screen.getByTestId("wrap-project:lakefile.lean")).toBeTruthy();
  });

  test("controlled rename: the product drives the field F2 drives", () => {
    const v = verbs();
    function Controlled() {
      const [renamingId, setRenamingId] = useState<string | null>(null);
      return (
        <>
          <button onClick={() => setRenamingId("project:lakefile.lean")}>menu-rename</button>
          <FileBrowser
            roots={[{ name: "project" }]}
            trees={{ project: { status: "ready", tree: TREE } }}
            expanded={new Set(["project:"])}
            onToggle={v.onToggle}
            selectedId={null}
            onSelect={v.onSelect}
            onOpen={v.onOpen}
            onRename={v.onRename}
            onDelete={v.onDelete}
            rename={{ id: renamingId, onChange: setRenamingId }}
          />
        </>
      );
    }
    render(<Controlled />);
    // A menu verb (here: the button) opens the same InlineRename field.
    fireEvent.click(screen.getByText("menu-rename"));
    const input = screen.getByLabelText("rename lakefile.lean") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "lakefile.toml" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(v.onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project:lakefile.lean" }),
      "lakefile.toml",
    );
    // Commit cleared the controlled state back through rename.onChange.
    expect(screen.queryByLabelText("rename lakefile.lean")).toBeNull();
  });

  /**
   * A row wrapped in a Presentation keeps the row's own gesture.
   *
   * `renderRow` wraps a row's CONTENT, so the Presentation sits inside the row
   * element. Until PBUI-HARDEN-1 P4.1 the Presentation stopped every click, so
   * a click on the label never reached the row's handler and the tree lost all
   * three of its effects: selection, directory toggling, and the roving focus
   * that arrow keys navigate from.
   *
   * The first two a product could restore by hand through the activate
   * handler, duplicating logic the organism already had. `setFocusedKey` it
   * could not — that is `useState` in here with no prop and no handle — so
   * ArrowDown kept moving from whatever row was last focused some OTHER way.
   * That is the assertion below that would not have been fixable from outside
   * this file, and it is why the fix belonged in pbui rather than in a product.
   */
  const filePbui = createPbui<{ "file.entry": string }, object, { kind: "noop" }, object>({
    registry: createPresentationRegistry<{ "file.entry": string }, object>({
      "file.entry": { label: (id) => id },
    }),
    defaultEnvironment: {},
    actions: createActionRegistry<{ "file.entry": string }, object, { kind: "noop" }>({
      graph: createPresentationTypeGraph([{ id: "file.entry" }]),
      scopes: ["global"],
      contributions: [],
    }),
    snapshotFor: () => ({
      revision: 0,
      scopes: ["global"],
      modes: new Set<string>(),
      capabilities: new Set<string>(),
      product: {},
    }),
  });

  describe("a row wrapped in a Presentation keeps the row's own gesture", () => {
    function PresentedHarness({ verbs: v }: { verbs: ReturnType<typeof verbs> }) {
      const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["project:"]));
      const [selectedId, setSelectedId] = useState<string | null>(null);
      return (
        <filePbui.Provider onPerform={() => {}}>
        <FileBrowser
          roots={[{ name: "project" }]}
          trees={{ project: { status: "ready", tree: TREE } }}
          expanded={expanded}
          onToggle={(id) => {
            v.onToggle(id);
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          selectedId={selectedId}
          onSelect={(node) => {
            v.onSelect(node);
            setSelectedId(node.id);
          }}
          onOpen={v.onOpen}
          onRename={v.onRename}
          onDelete={v.onDelete}
          // A REAL Presentation, because a plain wrapper proves nothing: the
          // defect was pbui's own click handler stopping propagation, so a
          // stand-in that stops nothing passes whether or not the bug exists.
          renderRow={(node, children) => (
            <filePbui.Presentation
              reference={{ type: "file.entry", value: node.id }}
              activate={{ doc: "select" }}
            >
              {children}
            </filePbui.Presentation>
          )}
        />
        </filePbui.Provider>
      );
    }

    test("clicking a wrapped directory label toggles it", () => {
      const v = verbs();
      render(<PresentedHarness verbs={v} />);
      fireEvent.click(screen.getByText("Mini"));
      expect(v.onToggle).toHaveBeenCalledWith("project:Mini");
      expect(v.onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Mini" }));
    });

    test("clicking a wrapped label moves the roving focus to THAT row", () => {
      const v = verbs();
      const { container } = render(<PresentedHarness verbs={v} />);
      const tree = container.querySelector("[role=tree]") as HTMLElement;

      // Focus starts at the top. Click the third row's label, then press Down:
      // if the click did not move the roving focus, this lands on row 2.
      fireEvent.click(screen.getByText("lakefile.lean"));
      fireEvent.keyDown(tree, { key: "ArrowDown" });

      // lakefile.lean is the last row, so ArrowDown clamps and stays on it.
      expect(container.querySelector("[data-focused=true]")?.textContent).toContain(
        "lakefile.lean",
      );
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FileBrowser, type FileNode } from "./FileBrowser";

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
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };
}

/** A controlled harness: expansion and selection live in state, as the
 *  product would hold them. */
function Harness({
  verbs: v,
  initialExpanded = new Set<string>(["project:"]),
  trees = { project: TREE },
  roots = [{ name: "project" }],
  pageSize,
}: {
  verbs: ReturnType<typeof verbs>;
  initialExpanded?: Set<string>;
  trees?: Record<string, FileNode | undefined>;
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
      onCreate={v.onCreate}
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

  test("windowing: 5000 siblings mount only a page, sentinel reveals the rest", () => {
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
      <Harness verbs={v} trees={{ project: many }} pageSize={200} />,
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
        trees={{ project: TREE }}
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
            trees={{ project: TREE }}
            expanded={new Set(["project:"])}
            onToggle={v.onToggle}
            selectedId={null}
            onSelect={v.onSelect}
            onOpen={v.onOpen}
            onRename={v.onRename}
            onDelete={v.onDelete}
            renamingId={renamingId}
            onRenameStateChange={setRenamingId}
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
    // Commit cleared the controlled state back through onRenameStateChange.
    expect(screen.queryByLabelText("rename lakefile.lean")).toBeNull();
  });
});

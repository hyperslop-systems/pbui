import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileBrowser, type FileNode } from "./FileBrowser";

/**
 * A presentational file tree: tree data, expansion, and selection arrive as
 * props; every intention leaves as a callback. These stories drive it from
 * fixtures — no server anywhere, which is the point of the organism living in
 * pbui (TURBOPROOF-5, decision DR-1).
 */
const meta = {
  title: "Component Library/Organisms/FileBrowser",
  component: FileBrowser,
  parameters: { layout: "padded" },
  args: {
    roots: [],
    trees: {},
    expanded: new Set<string>(),
    onToggle: () => {},
    selectedId: null,
    onSelect: () => {},
    onOpen: () => {},
    onRename: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof FileBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

const PROJECT: FileNode = {
  id: "project:",
  name: "project",
  kind: "directory",
  children: [
    {
      id: "project:Mini",
      name: "Mini",
      kind: "directory",
      children: [
        { id: "project:Mini/Basic.lean", name: "Basic.lean", kind: "file", size: 431 },
        { id: "project:Mini/UsesBasic.lean", name: "UsesBasic.lean", kind: "file", size: 268 },
        {
          id: "project:Mini/Notes",
          name: "Notes",
          kind: "directory",
          children: [
            { id: "project:Mini/Notes/Scratch.lean", name: "Scratch.lean", kind: "file", size: 74 },
          ],
        },
      ],
    },
    {
      id: "project:.lake",
      name: ".lake",
      kind: "directory",
      children: Array.from({ length: 5000 }, (_, i) => ({
        id: `project:.lake/dep-${i}.olean`,
        name: `dep-${i}.olean`,
        kind: "file" as const,
      })),
    },
    { id: "project:lakefile.lean", name: "lakefile.lean", kind: "file", size: 153 },
    { id: "project:lean-toolchain", name: "lean-toolchain", kind: "file", size: 25 },
    { id: "project:Café.lean", name: "Café.lean", kind: "file", size: 41 },
  ],
};

function log(name: string) {
  // eslint-disable-next-line no-console
  return (...args: unknown[]) => console.log(`[FileBrowser] ${name}`, ...args);
}

function Live({
  roots = [{ name: "project", label: "mini (fixture project)" }],
  trees = { project: PROJECT },
  dirty = new Set<string>(["project:Mini/Basic.lean"]),
}: {
  roots?: { name: string; label?: string }[];
  trees?: Record<string, FileNode | undefined>;
  dirty?: Set<string>;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["project:"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div style={{ width: 340, height: 420, display: "flex", border: "1px solid #cbd5e1" }}>
      <FileBrowser
        roots={roots}
        trees={trees}
        expanded={expanded}
        onToggle={(id) => {
          log("toggle")(id);
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        selectedId={selectedId}
        onSelect={(node) => {
          log("select")(node.id);
          setSelectedId(node.id);
        }}
        onOpen={log("open")}
        onCreate={log("create")}
        onRename={log("rename")}
        onDelete={log("delete")}
        renderBadge={(node) =>
          dirty.has(node.id) ? <span title="unsaved changes">●</span> : null
        }
      />
    </div>
  );
}

/** A typical lake project: two modules, a nested dir, and a collapsed,
 *  windowed .lake/ with 5000 build artifacts. Verbs log to the console. */
export const TypicalProject: Story = {
  render: () => <Live />,
};

/** The DR-30 surface: the server exposes no roots (mock / scratch mode). */
export const NoRoots: Story = {
  render: () => <Live roots={[]} trees={{}} />,
};

/** A root whose tree has not arrived yet renders its loading row. */
export const Loading: Story = {
  render: () => <Live trees={{}} />,
};

/** Unicode filenames, including the NFC/NFD pair macOS and Linux disagree on. */
export const UnicodeNames: Story = {
  render: () => (
    <Live
      trees={{
        project: {
          id: "project:",
          name: "project",
          kind: "directory",
          children: [
            { id: "u1", name: "Café.lean", kind: "file" }, // NFC
            { id: "u2", name: "Café.lean", kind: "file" }, // NFD — same glyphs, different bytes
            { id: "u3", name: "定理.lean", kind: "file" },
            { id: "u4", name: "δοκιμή.lean", kind: "file" },
          ],
        },
      }}
    />
  ),
};

/** Deep nesting: expansion and indentation stay legible at depth 12. */
export const DeepNesting: Story = {
  render: () => {
    let node: FileNode = { id: "d12", name: "Bottom.lean", kind: "file" };
    for (let depth = 11; depth >= 0; depth--) {
      node = {
        id: `d${depth}`,
        name: `level-${depth}`,
        kind: "directory",
        children: [node],
      };
    }
    return <Live trees={{ project: { id: "project:", name: "project", kind: "directory", children: [node] } }} />;
  },
};

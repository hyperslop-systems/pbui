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

/* ------------------------------------------------------------------ */
/* The presentation-protocol seam: file rows as PRESENTATIONS.        */
/* ------------------------------------------------------------------ */
import { createPbui } from "../../../presentation/createPbui";
import { createPresentationRegistry } from "../../../presentation/registry";
import type { PresentationAction } from "../../../presentation/types";

interface FileEntryValues {
  "file.entry": FileNode;
}
type FileVerb =
  | { type: "open"; id: string }
  | { type: "rename"; id: string }
  | { type: "delete"; id: string }
  | { type: "create"; parentId: string; kind: "file" | "directory" };

const fileEntryRegistry = createPresentationRegistry<FileEntryValues, Record<string, never>, FileVerb>({
  "file.entry": {
    label: (node) => node.name,
    describe: (node) => ({ id: node.id, kind: node.kind }),
    tone: "neutral",
    actions: (node): readonly PresentationAction<FileVerb>[] => [
      ...(node.kind === "file"
        ? [{ id: "open", label: "Open", verb: { type: "open", id: node.id } as FileVerb, group: "file" }]
        : [
            { id: "new-file", label: "New file here", verb: { type: "create", parentId: node.id, kind: "file" } as FileVerb, group: "file" },
            { id: "new-folder", label: "New folder here", verb: { type: "create", parentId: node.id, kind: "directory" } as FileVerb, group: "file" },
          ]),
      { id: "rename", label: "Rename…", verb: { type: "rename", id: node.id }, group: "edit" },
      { id: "delete", label: "Delete", verb: { type: "delete", id: node.id }, group: "edit", danger: true },
    ],
  },
});

const filePbui = createPbui({ registry: fileEntryRegistry, defaultEnvironment: {} });

/**
 * Files have ACTIONS: right-click any row for its object menu (open, new
 * file/folder here, rename…, delete). The menu's "Rename…" verb drives the
 * same inline field F2 drives, through the controlled rename props. Every
 * verb lands in the log below — the organism never performs.
 */
export const WithPresentation: Story = {
  render: function Render() {
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["project:", "project:Mini"]));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [lastVerb, setLastVerb] = useState<string>("(none yet — right-click a row)");
    const perform = (verb: FileVerb) => {
      setLastVerb(JSON.stringify(verb));
      if (verb.type === "rename") setRenamingId(verb.id);
    };
    return (
      <filePbui.Provider onPerform={perform}>
        <div style={{ width: 360, display: "grid", gap: 8 }}>
          <div style={{ height: 380, display: "flex", border: "1px solid #cbd5e1" }}>
            <FileBrowser
              roots={[{ name: "project" }]}
              trees={{ project: PROJECT }}
              expanded={expanded}
              onToggle={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              selectedId={selectedId}
              onSelect={(node) => setSelectedId(node.id)}
              onOpen={(node) => perform({ type: "open", id: node.id })}
              onCreate={(parentId, kind) => perform({ type: "create", parentId, kind })}
              onRename={(node, next) => perform({ type: "rename", id: `${node.id} → ${next}` })}
              onDelete={(node) => perform({ type: "delete", id: node.id })}
              rename={{ id: renamingId, onChange: setRenamingId }}
              renderRow={(node, children) => (
                <filePbui.Presentation
                  reference={{ type: "file.entry", value: node }}
                  activate={{ run: () => setSelectedId(node.id), doc: "select" }}
                  doc={`${node.kind} ${node.id}`}
                >
                  {children}
                </filePbui.Presentation>
              )}
            />
          </div>
          <code style={{ fontSize: 12 }}>last verb: {lastVerb}</code>
        </div>
        <filePbui.ObjectMenu />
      </filePbui.Provider>
    );
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileBrowser, type FileNode, type RootState } from "./FileBrowser";

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
  trees = { project: { status: "ready", tree: PROJECT } as RootState },
  dirty = new Set<string>(["project:Mini/Basic.lean"]),
}: {
  roots?: { name: string; label?: string }[];
  trees?: Record<string, RootState | undefined>;
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

/**
 * A root that failed to load says so.
 *
 * Before `RootState`, `trees` was `Record<string, FileNode | undefined>` and
 * `undefined` meant "still loading" — so a root whose fetch rejected was
 * indistinguishable from one still in flight and displayed "loading…"
 * forever. The user was never told, and the product had no way to tell them.
 */
export const AFailedRoot: Story = {
  render: () => (
    <Live
      roots={[
        { name: "project", label: "mini (fixture project)" },
        { name: "vendor", label: "vendor" },
      ]}
      trees={{
        project: { status: "ready", tree: PROJECT },
        vendor: { status: "failed", reason: "vendor: permission denied" },
      }}
    />
  ),
};

/** Unicode filenames, including the NFC/NFD pair macOS and Linux disagree on. */
export const UnicodeNames: Story = {
  render: () => (
    <Live
      trees={{
        project: {
          status: "ready",
          tree: {
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
    return (
      <Live
        trees={{
          project: {
            status: "ready",
            tree: { id: "project:", name: "project", kind: "directory", children: [node] },
          },
        }}
      />
    );
  },
};

/* ------------------------------------------------------------------ */
/* The presentation-protocol seam: file rows as PRESENTATIONS.        */
/* ------------------------------------------------------------------ */
import type { ActionFamilyInstance } from "../../../presentation/actions";
import { createPbui } from "../../../presentation/createPbui";
import { definePresentation } from "../../../presentation/model";

interface FileEntryValues {
  "file.entry": FileNode;
}
type FileVerb =
  | { type: "open"; id: string }
  | { type: "rename"; id: string }
  | { type: "delete"; id: string }
  | { type: "create"; parentId: string; kind: "file" | "directory" };

/* One bounded family: the row set differs per node kind, which is exactly the
 * dynamic-membership case families exist for. */
const fileEntryPresentation = definePresentation<FileEntryValues, Record<string, never>, Record<string, never>, FileVerb>().create({
  id: "story.file-entry",
  types: [{ id: "file.entry" }],
  knownScopes: ["global"],
  defaultActiveScopes: ["global"],
  revision: () => 0,
  descriptors: {
    "file.entry": {
      label: (node) => node.name,
      describe: (node) => ({ id: node.id, kind: node.kind }),
      tone: "neutral",
    },
  },
  actions: [
    {
      kind: "family",
      id: "story.file-entry.menu",
      subject: "file.entry",
      match: "exact",
      scopes: ["global"],
      expand: ({ subject }) => {
        const node = subject.value as FileNode;
        type Row = ActionFamilyInstance<FileEntryValues, Record<string, never>, FileVerb>;
        const rows: Row[] = [];
        if (node.kind === "file") {
          rows.push({
            key: "open",
            action: "file.open",
            metadata: { label: "Open", group: "file", order: 0 },
            bind: () => ({ type: "open", id: node.id }),
          });
        } else {
          rows.push(
            {
              key: "new-file",
              action: "file.create-file",
              metadata: { label: "New file here", group: "file", order: 0 },
              bind: () => ({ type: "create", parentId: node.id, kind: "file" }),
            },
            {
              key: "new-folder",
              action: "file.create-folder",
              metadata: { label: "New folder here", group: "file", order: 1 },
              bind: () => ({ type: "create", parentId: node.id, kind: "directory" }),
            },
          );
        }
        rows.push(
          {
            key: "rename",
            action: "file.rename",
            metadata: { label: "Rename…", group: "edit", order: 2 },
            bind: () => ({ type: "rename", id: node.id }),
          },
          {
            key: "delete",
            action: "file.delete",
            metadata: { label: "Delete", group: "edit", order: 3, danger: true },
            bind: () => ({ type: "delete", id: node.id }),
          },
        );
        return rows;
      },
    },
  ],
});

const filePbui = createPbui({
  presentation: fileEntryPresentation,
  defaultEnvironment: {},
  contextFor: () => ({ facts: {} }),
});

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
      <filePbui.Provider onPerform={perform} onRefuse={(refusal) => console.warn("refused", refusal)}>
        <div style={{ width: 360, display: "grid", gap: 8 }}>
          <div style={{ height: 380, display: "flex", border: "1px solid #cbd5e1" }}>
            <FileBrowser
              roots={[{ name: "project" }]}
              trees={{ project: { status: "ready", tree: PROJECT } }}
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
              onRename={(node, next) => perform({ type: "rename", id: `${node.id} → ${next}` })}
              onDelete={(node) => perform({ type: "delete", id: node.id })}
              rename={{ id: renamingId, onChange: setRenamingId }}
              renderRow={(node, children) => (
                <filePbui.Presentation
                  reference={{ type: "file.entry", value: node }}
                  /*
                   * No `run`. THIS STORY USED TO DEMONSTRATE THE BUG: it wired
                   * `onActivate={() => setSelectedId(node.id)}` — selection
                   * only — so clicking a directory's LABEL selected it and did
                   * not expand it, while clicking two pixels left on the indent
                   * did. The Presentation swallowed the row's click and the
                   * story restored half of what was lost.
                   *
                   * Since P4.1 the click reaches the row, which selects AND
                   * toggles AND moves the roving focus, so there is nothing for
                   * the product to restore. `activate` stays, without `run`,
                   * because a left click still does something other than open
                   * the menu and the mouse doc should say what.
                   */
                  activate={{ doc: "select · directories expand" }}
                  // The row is a `treeitem` in a `tree`, which owns the tab
                  // stop; without this the presentation adds a second one.
                  inComposite
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

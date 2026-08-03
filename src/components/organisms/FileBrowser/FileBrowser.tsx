import { useId, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { EmptyState } from "../../molecules/EmptyState";
import { InlineRename } from "../../molecules/InlineRename";
import { Text } from "../../foundation";
import { isEditableTarget } from "../../../chrome/shortcutRouting";
import styles from "./FileBrowser.module.css";

/**
 * One row in the tree, built by the PRODUCT's model layer.
 *
 * The organism never fetches and never sorts beyond what it is given (the
 * family layering rule: organisms do no data fetching). `children` undefined
 * means "not loaded yet" — the product lazy-loads in onToggle and re-renders
 * with the children filled in. `children: []` is a loaded, empty directory.
 */
export interface FileNode {
  /**
   * Stable identity within the tree — conventionally the root-relative path.
   * Must be unique across ALL roots shown in one browser, because expansion
   * and selection are keyed by it; prefixing with the root name
   * ("project:Mini/Basic.lean") is the easy way.
   */
  id: string;
  name: string;
  kind: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

/**
 * What is known about one root right now.
 *
 * A discriminated union rather than a nullable tree, so that "still loading"
 * and "failed to load" are different values instead of the same absence.
 */
export type RootState =
  | { status: "loading" }
  | { status: "failed"; reason: string }
  | { status: "ready"; tree: FileNode };

export interface FileBrowserProps {
  roots: { name: string; label?: string }[];
  /**
   * The load state of each root, keyed by root name.
   *
   * This was `Record<string, FileNode | undefined>` with `undefined` meaning
   * "still loading", which left FAILURE inexpressible: a root whose fetch
   * rejected was indistinguishable from one still in flight, so it displayed
   * "loading…" forever and the user was never told. `emptyState`'s own doc
   * comment named "load failure" as one of three surfaces it covered, and the
   * code consulted it only when there were no roots at all.
   *
   * An absent key still means loading, deliberately: products build this map
   * incrementally and requiring an explicit `{ status: "loading" }` for every
   * root before the first response is friction with no safety in return.
   */
  trees: Record<string, RootState | undefined>;
  /** Which rows are expanded — CONTROLLED, so the product can persist it. */
  expanded: ReadonlySet<string>;
  onToggle(nodeId: string): void;
  /** Selection is the product's state too. */
  selectedId: string | null;
  onSelect(node: FileNode): void;
  /**
   * Verbs. The keyboard (Enter, F2, Delete), double-click, and any product
   * menu all produce these; the organism NEVER performs them itself.
   */
  onOpen(node: FileNode): void;
  /*
   * `onCreate` used to be declared here and was called by nothing.
   *
   * The comment explaining that — "the organism itself has no built-in create
   * gesture, so it never CALLS this" — made the contract deliberate, and left
   * the failure mode exactly as it was: a doc comment is invisible at the call
   * site. turboproof wired it end to end (API call, tree reload, error
   * handling) and shipped a feature with no way to reach it, caught only by
   * asking "which gesture invokes this?" of every declared verb.
   *
   * A sweep of every props interface in src/ found this was the only instance
   * in the library, so it gets a fix rather than a lint. No consumer passes it
   * today, so the prop is simply gone. If the organism ever grows a real
   * create affordance — a `+` on a directory row's hover state, say — the prop
   * comes back WITH the gesture that calls it.
   */
  onRename(node: FileNode, nextName: string): void;
  onDelete(node: FileNode): void;
  /** Product-rendered affordances per row, e.g. a dirty dot. */
  renderBadge?(node: FileNode): ReactNode;
  /**
   * The presentation-protocol seam: wrap a row's rendered content in the
   * PRODUCT's bound Presentation so file rows carry object menus and verbs
   * (open, rename, delete, …) like every other object in the workbench.
   * Default: children as-is. The organism stays product-agnostic; the
   * product brings its own createPbui instance.
   */
  renderRow?(node: FileNode, children: ReactNode): ReactNode;
  /**
   * Controlled inline-rename. Present ⇔ the product owns which row is being
   * renamed; absent ⇔ the organism keeps that state itself.
   *
   *     rename={{ id: renamingId, onChange: setRenamingId }}
   *
   * When present, F2 and commit/cancel report through `onChange` instead of
   * internal state, so an object-menu "rename" VERB drives the same field the
   * keyboard drives.
   *
   * # Why this is one prop
   *
   * It was `renamingId?: string | null` plus `onRenameStateChange?(...)`, and
   * the doc comment ended with the sentence "Provide both or neither" — a
   * prose invariant the type did not carry, which is the reliable tell. A
   * controlled `renamingId` with no callback silently swallowed every F2.
   *
   * It also retired an overload. `renamingId` meant three things:
   *
   *     undefined   uncontrolled — the organism keeps internal state
   *     null        controlled, nothing being renamed
   *     "abc"       controlled, "abc" being renamed
   *
   * Presence of the object is now the mode, so `undefined` and `null` stop
   * competing for the same job and `id: null` means exactly one thing.
   */
  rename?: {
    /** The row being renamed, or `null` for none. */
    id: string | null;
    onChange(nodeId: string | null): void;
  };

  /**
   * TOMBSTONES — merged into `rename` in 0.4.0.
   *
   * @deprecated use `rename={{ id, onChange }}`
   */
  renamingId?: never;
  /** @deprecated use `rename={{ id, onChange }}` */
  onRenameStateChange?: never;
  /** DR-30 surfaces: no roots, load failure, empty directory. */
  emptyState?: ReactNode;
  /**
   * How many children of one directory mount before a "show N more" sentinel
   * takes over. Windowing, honestly: a 50,000-node .lake/ directory must
   * cost what a 50-node one costs.
   */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 200;

interface VisibleRow {
  key: string;
  node?: FileNode;
  depth: number;
  /** Set on the "show N more" sentinel: its parent directory's id + count. */
  moreParentId?: string;
  moreCount?: number;
  /** Set on a root whose load failed: why, in the product's words. */
  failedReason?: string;
}

/**
 * flattenVisible computes the rows actually on screen: roots, then
 * depth-first through EXPANDED directories only, capping each directory at
 * pageSize mounted children followed by one sentinel row. Children of
 * collapsed directories never mount — that is the tree's windowing.
 */
function flattenVisible(
  roots: { name: string; label?: string }[],
  trees: Record<string, RootState | undefined>,
  expanded: ReadonlySet<string>,
  pageSize: number,
  uncapped: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (nodes: FileNode[], depth: number): void => {
    for (const node of nodes) {
      rows.push({ key: node.id, node, depth });
      if (node.kind === "directory" && expanded.has(node.id) && node.children) {
        const cap = uncapped.has(node.id) ? node.children.length : pageSize;
        const shown = node.children.slice(0, cap);
        walk(shown, depth + 1);
        const hidden = node.children.length - shown.length;
        if (hidden > 0) {
          rows.push({
            key: `more:${node.id}`,
            depth: depth + 1,
            moreParentId: node.id,
            moreCount: hidden,
          });
        }
      }
    }
  };
  for (const root of roots) {
    const state = trees[root.name];
    if (!state || state.status === "loading") {
      rows.push({ key: `loading:${root.name}`, depth: 0 });
      continue;
    }
    if (state.status === "failed") {
      rows.push({ key: `failed:${root.name}`, depth: 0, failedReason: state.reason });
      continue;
    }
    const tree = state.tree;
    // The root row itself is the tree's head node, labeled by the root, and
    // paged like every other directory.
    const head: FileNode = { ...tree, name: root.label ?? root.name };
    walk([head], 0);
  }
  return rows;
}

/**
 * A file tree, presentational end to end.
 *
 * Props in, pixels out: tree data, expansion, and selection arrive as props;
 * every user intention leaves as a callback. Nothing here knows what a
 * filesystem is — the same component renders a lake project, a blob store,
 * or a storybook fixture, which is the whole reason it lives in pbui rather
 * than in a product (TURBOPROOF-5, decision DR-1).
 *
 * Keyboard, on a roving focus row (one tab stop for the whole tree):
 * Up/Down move, Right expands or descends, Left collapses or climbs,
 * Enter opens a file or toggles a directory, F2 renames in place
 * (commit on Enter, discard on Escape — InlineRename's contract),
 * Delete asks the product to delete the focused row.
 */
export function FileBrowser({
  roots,
  trees,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  renderBadge,
  renderRow,
  rename,
  emptyState,
  pageSize = DEFAULT_PAGE_SIZE,
}: FileBrowserProps) {
  const treeId = useId();
  // The focus row for keyboard navigation; starts on the selection.
  const [focusedKey, setFocusedKey] = useState<string | null>(selectedId);
  // Inline rename: internal by default, controlled when the product drives
  // it (so a menu verb and the F2 key share one code path).
  const [internalRenaming, setInternalRenaming] = useState<string | null>(null);
  // Presence of `rename` IS the mode. The old shape asked `renamingId !==
  // undefined`, which is why `undefined` and `null` had to mean different
  // things — the pair could not distinguish "uncontrolled" from "controlled,
  // nothing renaming" any other way.
  const renamingKey = rename ? rename.id : internalRenaming;
  const setRenamingKey = (key: string | null): void => {
    if (rename) rename.onChange(key);
    else setInternalRenaming(key);
  };
  // Directories whose child cap the user lifted via "show N more".
  const [uncapped, setUncapped] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(
    () => flattenVisible(roots, trees, expanded, pageSize, uncapped),
    [roots, trees, expanded, pageSize, uncapped],
  );

  if (roots.length === 0) {
    return (
      <div data-pbui-component="file-browser" data-part="file-browser" className={styles.browser}>
        {emptyState ?? (
          <EmptyState
            message="no file roots on this server"
            hint="start with --lean-project or --files-root name=dir to browse a project"
          />
        )}
      </div>
    );
  }

  const rowIndex = (key: string | null): number => rows.findIndex((row) => row.key === key);
  const focusRow = (index: number): void => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    const row = rows[clamped];
    if (row) setFocusedKey(row.key);
  };

  const activateRow = (row: VisibleRow): void => {
    if (row.moreParentId !== undefined) {
      setUncapped((prev) => new Set(prev).add(row.moreParentId as string));
      return;
    }
    const node = row.node;
    if (!node) return;
    onSelect(node);
    if (node.kind === "directory") onToggle(node.id);
    else onOpen(node);
  };

  /*
   * The DOM id of a row, so the tree can name the active one to assistive
   * technology.
   *
   * Every treeitem carries `tabIndex={-1}` and DOM focus stays on the tree
   * element, which is the correct shape for a composite widget — but without
   * `aria-activedescendant` a screen reader is never told WHICH item Enter,
   * F2 or Delete will act on. The roving highlight was visible only as a
   * `data-focused` attribute and a CSS rule: a sighted user could see it and
   * nobody else could.
   *
   * `useId` rather than the row key alone, because two FileBrowsers on one
   * page would otherwise mint the same ids.
   */
  const rowDomId = (key: string): string => `${treeId}-${key.replace(/[^\w-]/g, "_")}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    /*
     * A key pressed inside the rename field is not a tree command.
     *
     * This handler is on the tree, so every keystroke in `InlineRename`
     * bubbles into it. Before this guard, renaming a file and pressing DELETE
     * to edit the name called `onDelete` on the file being renamed — the
     * product deleted it. Enter committed the rename and then also opened or
     * toggled the row, and the horizontal arrows moved the tree's focus
     * instead of the caret.
     *
     * Ignoring editable targets rather than stopping propagation inside
     * `InlineRename`: the rename field is one of several things a product may
     * render into a row through `renderRow`, and the tree should decline
     * anything typed into a control rather than require each control to know
     * about the tree.
     */
    if (isEditableTarget(event.target as HTMLElement)) return;

    const index = rowIndex(focusedKey);
    const row = index >= 0 ? rows[index] : rows[0];
    if (!row) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow((index >= 0 ? index : 0) + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusRow((index >= 0 ? index : 0) - 1);
        return;
      case "ArrowRight": {
        event.preventDefault();
        const node = row.node;
        if (node?.kind === "directory" && !expanded.has(node.id)) onToggle(node.id);
        else focusRow(index + 1);
        return;
      }
      case "ArrowLeft": {
        event.preventDefault();
        const node = row.node;
        if (node?.kind === "directory" && expanded.has(node.id)) {
          onToggle(node.id);
          return;
        }
        /*
         * ...OR CLIMBS. The component's own documentation says "Left collapses
         * or climbs" and it only collapsed: on a file, or on an already-closed
         * directory, ArrowLeft did nothing at all, so a keyboard user could
         * descend into a tree and not get back out without ArrowUp-ing past
         * every sibling.
         *
         * A doc comment describing behaviour the code does not have is the
         * defect this whole ticket is named for, and it turned up inside the
         * component while fixing the others.
         *
         * The parent is the nearest PRECEDING row one level shallower, which
         * is what depth-first order guarantees.
         */
        for (let i = index - 1; i >= 0; i--) {
          const candidate = rows[i];
          if (candidate && candidate.depth === row.depth - 1) {
            focusRow(i);
            return;
          }
        }
        return;
      }
      case "Enter":
        event.preventDefault();
        activateRow(row);
        return;
      case "F2":
        if (row.node) {
          event.preventDefault();
          setRenamingKey(row.key);
        }
        return;
      case "Delete":
        if (row.node) {
          event.preventDefault();
          onDelete(row.node);
        }
        return;
      default:
    }
  };

  return (
    // role=tree + roving tabindex: one tab stop, arrows move within.
    <div
      data-pbui-component="file-browser"
      data-part="file-browser"
      className={styles.browser}
      role="tree"
      aria-label="files"
      tabIndex={0}
      aria-activedescendant={focusedKey ? rowDomId(focusedKey) : undefined}
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => {
        if (row.moreParentId !== undefined) {
          return (
            <div
              key={row.key}
              data-part="file-browser-more"
              className={styles.more}
              data-depth={row.depth}
              id={rowDomId(row.key)}
              role="treeitem"
              aria-selected={false}
              aria-level={row.depth + 1}
              tabIndex={-1}
              onClick={() => activateRow(row)}
            >
              <Text size="tiny" tone="faint">
                … show {row.moreCount} more
              </Text>
            </div>
          );
        }
        const node = row.node;
        if (!node) {
          // A failed root says so, in the product's words. Before this it
          // rendered "loading…" and kept rendering it.
          const failed = row.failedReason;
          return (
            <div
              key={row.key}
              data-part="file-row"
              data-state={failed === undefined ? "loading" : "failed"}
              id={rowDomId(row.key)}
              role="treeitem"
              aria-selected={false}
              aria-level={1}
            >
              <Text size="tiny" tone={failed === undefined ? "faint" : "danger"}>
                {failed ?? "loading…"}
              </Text>
            </div>
          );
        }
        const isDirectory = node.kind === "directory";
        const isExpanded = expanded.has(node.id);
        const isSelected = selectedId === node.id;
        const isFocused = focusedKey === node.id;
        const label =
          renamingKey === row.key ? (
            <InlineRename
              initial={node.name}
              accessibleName={`rename ${node.name}`}
              fallback={node.name}
              onCommit={(next) => {
                setRenamingKey(null);
                if (next !== node.name) onRename(node, next);
              }}
              onCancel={() => setRenamingKey(null)}
            />
          ) : (
            <span
              data-part="file-row-label"
              className={isDirectory ? `${styles.label} ${styles.labelDirectory}` : styles.label}
            >
              {node.name}
            </span>
          );
        // The presentation seam: the product may wrap the row's CONTENT
        // (label + badge, not the chevron/indent geometry) in its bound
        // Presentation, so right-clicking a file opens its object menu.
        const content = (
          <>
            {label}
            {renderBadge ? (
              <span data-part="file-row-badge" className={styles.badge}>
                {renderBadge(node)}
              </span>
            ) : null}
          </>
        );
        const rowClass = [
          styles.row,
          isSelected ? styles.rowSelected : "",
          isFocused ? styles.rowFocused : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={row.key}
            data-part="file-row"
            className={rowClass}
            data-kind={node.kind}
            data-depth={row.depth}
            data-selected={isSelected || undefined}
            data-focused={isFocused || undefined}
            id={rowDomId(row.key)}
            role="treeitem"
            aria-selected={isSelected}
            aria-level={row.depth + 1}
            aria-expanded={isDirectory ? isExpanded : undefined}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              setFocusedKey(row.key);
              onSelect(node);
              // The VS Code gesture: one click on a directory toggles it.
              // Files open on double-click (or Enter), not on first click.
              if (isDirectory) onToggle(node.id);
            }}
            onDoubleClick={() => {
              // Directories already toggled on the two single clicks that a
              // double-click is made of; only files need a double-click verb.
              if (!isDirectory) onOpen(node);
            }}
          >
            <span
              data-part="file-tree-indent"
              className={styles.indent}
              style={{ width: `${row.depth * 0.875}rem` }}
            />
            <span
              data-part="file-row-chevron"
              className={styles.chevron}
              data-expanded={isExpanded || undefined}
              onClick={(event) => {
                if (!isDirectory) return;
                event.stopPropagation();
                onToggle(node.id);
              }}
            >
              {isDirectory ? (isExpanded ? "▾" : "▸") : ""}
            </span>
            {renderRow ? renderRow(node, content) : content}
          </div>
        );
      })}
    </div>
  );
}

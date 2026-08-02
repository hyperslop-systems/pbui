import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { EmptyState } from "../../molecules/EmptyState";
import { InlineRename } from "../../molecules/InlineRename";
import { Text } from "../../foundation";

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

export interface FileBrowserProps {
  roots: { name: string; label?: string }[];
  /** Loaded trees, keyed by root name. An absent root renders a loading row. */
  trees: Record<string, FileNode | undefined>;
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
  /**
   * Part of the verb contract so every consumer wires the same signature.
   * The organism itself has no built-in create gesture (inventing
   * keybindings is worse than leaving it to the product's toolbar/menu),
   * so it never CALLS this — the product's own chrome does.
   */
  onCreate?(parentId: string, kind: "file" | "directory"): void;
  onRename(node: FileNode, nextName: string): void;
  onDelete(node: FileNode): void;
  /** Product-rendered affordances per row, e.g. a dirty dot. */
  renderBadge?(node: FileNode): ReactNode;
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
}

/**
 * flattenVisible computes the rows actually on screen: roots, then
 * depth-first through EXPANDED directories only, capping each directory at
 * pageSize mounted children followed by one sentinel row. Children of
 * collapsed directories never mount — that is the tree's windowing.
 */
function flattenVisible(
  roots: { name: string; label?: string }[],
  trees: Record<string, FileNode | undefined>,
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
    const tree = trees[root.name];
    if (!tree) {
      rows.push({ key: `loading:${root.name}`, depth: 0 });
      continue;
    }
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
  emptyState,
  pageSize = DEFAULT_PAGE_SIZE,
}: FileBrowserProps) {
  // The focus row for keyboard navigation; starts on the selection.
  const [focusedKey, setFocusedKey] = useState<string | null>(selectedId);
  // Which row is being renamed in place, if any.
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  // Directories whose child cap the user lifted via "show N more".
  const [uncapped, setUncapped] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(
    () => flattenVisible(roots, trees, expanded, pageSize, uncapped),
    [roots, trees, expanded, pageSize, uncapped],
  );

  if (roots.length === 0) {
    return (
      <div data-pbui-component="file-browser" data-part="file-browser">
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
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
        if (node?.kind === "directory" && expanded.has(node.id)) onToggle(node.id);
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
      role="tree"
      aria-label="files"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => {
        if (row.moreParentId !== undefined) {
          return (
            <div
              key={row.key}
              data-part="file-browser-more"
              data-depth={row.depth}
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
          return (
            <div key={row.key} data-part="file-row" data-state="loading" role="treeitem" aria-selected={false} aria-level={1}>
              <Text size="tiny" tone="faint">
                loading…
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
              label={`rename ${node.name}`}
              fallback={node.name}
              onCommit={(next) => {
                setRenamingKey(null);
                if (next !== node.name) onRename(node, next);
              }}
              onCancel={() => setRenamingKey(null)}
            />
          ) : (
            <span data-part="file-row-label">{node.name}</span>
          );
        return (
          <div
            key={row.key}
            data-part="file-row"
            data-kind={node.kind}
            data-depth={row.depth}
            data-selected={isSelected || undefined}
            data-focused={isFocused || undefined}
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
            <span data-part="file-tree-indent" style={{ width: `${row.depth * 0.875}rem` }} />
            <span
              data-part="file-row-chevron"
              data-expanded={isExpanded || undefined}
              onClick={(event) => {
                if (!isDirectory) return;
                event.stopPropagation();
                onToggle(node.id);
              }}
            >
              {isDirectory ? (isExpanded ? "▾" : "▸") : ""}
            </span>
            {label}
            {renderBadge ? <span data-part="file-row-badge">{renderBadge(node)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

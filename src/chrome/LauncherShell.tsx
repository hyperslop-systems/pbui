/**
 * The launcher shell (PBUI-UNIFY-001, DR-U6): the modal, the search input,
 * the keyboard loop, and the two placement rules — extracted from
 * datalab-ui's LauncherDialog. The rows MODEL stays in the product (datalab's
 * workspace scoping, stages, and query language; turboproof's flat groups);
 * the shell renders whatever grouped rows it is given and reports the choice.
 *
 * Two invariants live here so the next product reads them instead of
 * rediscovering them:
 *
 *   1. ESCAPE HAS EXACTLY ONE OWNER. The shell registers NO escape surface —
 *      `Dialog` already does, and a second registration lands on top of the
 *      Dialog's own, which then decides it is not topmost and ignores the
 *      key: Escape closes nothing at all. Found in the browser during
 *      DATALAB-VIEW-001; do not re-learn it.
 *   2. A GLOBAL NEW VIEW MUST NEVER DESTROY A WORKING TILE. The helper
 *      `splitDirectionFor` supports the settled policy: split the active
 *      tile along its longer RENDERED axis (the DOM knows pixels; layout
 *      trees only know ratios), and say where the view will land before
 *      Enter commits — the product's status line does the saying.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog, Text, TextInput } from "../components";

export interface LauncherShellRow {
  /** Unique across all groups; also the DOM id for aria-activedescendant. */
  id: string;
  title: string;
  detail?: ReactNode;
  disabled?: boolean;
}

export interface LauncherShellGroup {
  label: string;
  rows: LauncherShellRow[];
}

export interface LauncherShellProps {
  title: string;
  groups: LauncherShellGroup[];
  query: string;
  onQueryChange(query: string): void;
  onChoose(rowId: string): void;
  onClose(): void;
  /** The line naming where a choice will land, shown before Enter commits. */
  status?: ReactNode;
  /** The verb named in the footer hint for the ACTIVE row ("go to", "place"…). */
  enterVerb?(activeRowId: string | null): string;
  searchLabel?: string;
  placeholder?: string;
  emptyText?: ReactNode;
}

/**
 * Split a tile along its longer rendered axis. Exported for the products'
 * choose() handlers; reads the tile by its data-placement-id.
 */
export function splitDirectionFor(placementId: string, root?: HTMLElement | null): "row" | "col" {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(placementId)
      : placementId.replace(/"/g, '\\"');
  const element = (root ?? document).querySelector(`[data-placement-id="${escaped}"]`);
  if (!element) return "row";
  const box = element.getBoundingClientRect();
  return box.width >= box.height ? "row" : "col";
}

export function LauncherShell({
  title,
  groups,
  query,
  onQueryChange,
  onChoose,
  onClose,
  status,
  enterVerb,
  searchLabel = "search views and applications",
  placeholder = "search views and applications…",
  emptyText = "Nothing matches.",
}: LauncherShellProps) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);

  // Keep the highlight on a row that still exists; falling back to the first
  // row means Enter always does something predictable while the user types.
  const active =
    activeId && rows.some((row) => row.id === activeId) ? activeId : (rows[0]?.id ?? null);
  useEffect(() => {
    if (active !== activeId) setActiveId(active);
  }, [active, activeId]);
  useEffect(() => {
    if (!active) return;
    // getElementById rather than a CSS selector: row ids are product-minted
    // and may contain any character, and CSS.escape is absent under jsdom.
    const element = listRef.current?.ownerDocument.getElementById(active);
    if (element && listRef.current?.contains(element)) {
      element.scrollIntoView?.({ block: "nearest" });
    }
  }, [active]);

  const move = (delta: number | "first" | "last") => {
    if (rows.length === 0) return;
    const at = rows.findIndex((row) => row.id === active);
    const next =
      delta === "first"
        ? 0
        : delta === "last"
          ? rows.length - 1
          : // Wrapping: a list this short makes "stuck at the bottom" feel broken.
            (at + delta + rows.length) % rows.length;
    setActiveId(rows[next]?.id ?? null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        move("first");
        break;
      case "End":
        event.preventDefault();
        move("last");
        break;
      case "Enter": {
        event.preventDefault();
        const row = rows.find((candidate) => candidate.id === active);
        if (row && !row.disabled) onChoose(row.id);
        break;
      }
      default:
        break;
    }
  };

  return (
    <Dialog title={title} onClose={onClose} closeLabel="close the launcher">
      <div data-part="launcher">
        <TextInput
          accessibleName={searchLabel}
          placeholder={placeholder}
          value={query}
          onValueChange={onQueryChange}
          onKeyDown={onKeyDown}
          width="fill"
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          {...(active ? { "aria-activedescendant": active } : {})}
        />
        {status && <div data-part="launcher-status">{status}</div>}
        <div data-part="launcher-results" ref={listRef} id={listId} role="listbox">
          {groups.map((group) =>
            group.rows.length === 0 ? null : (
              <div key={group.label} data-part="launcher-group">
                <Text size="micro" tone="faint">
                  {group.label}
                </Text>
                {group.rows.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    id={row.id}
                    role="option"
                    aria-selected={row.id === active}
                    data-part="launcher-row"
                    data-active={row.id === active || undefined}
                    disabled={row.disabled}
                    onMouseEnter={() => setActiveId(row.id)}
                    onClick={() => onChoose(row.id)}
                  >
                    <span data-part="launcher-row-title">{row.title}</span>
                    {row.detail && (
                      <Text size="tiny" tone="faint">
                        {row.detail}
                      </Text>
                    )}
                  </button>
                ))}
              </div>
            ),
          )}
          {rows.length === 0 && (
            <Text size="small" tone="faint">
              {emptyText}
            </Text>
          )}
        </div>
        <Text size="micro" tone="faint">
          ↑↓ choose · Enter {enterVerb?.(active) ?? "choose"} · Esc close
        </Text>
      </div>
    </Dialog>
  );
}

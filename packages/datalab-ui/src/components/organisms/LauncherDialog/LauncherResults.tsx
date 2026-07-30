import { SectionLabel, Text } from "@hyperslop-systems/pbui";
import type { LauncherResults as Results, LauncherResultId, LauncherRow } from "../ViewSwitcher";
import styles from "./LauncherDialog.module.css";

/**
 * The launcher's grouped result list: a listbox owned by the search input.
 *
 * Presentational — rows in, one callback out. Every decision about *which* rows
 * exist was made by `searchLauncherIndex`, which is pure and tested without a
 * DOM; this file only draws them.
 *
 * The combobox pattern (§13) is why these are `role="option"` elements rather
 * than buttons: DOM focus never leaves the input, so arrows can move the active
 * row while the user keeps typing. `aria-activedescendant` on the input names
 * the row, which is what a screen reader announces.
 */

export interface LauncherResultsProps {
  results: Results;
  listId: string;
  activeId: LauncherResultId | null;
  /** In place mode an out-of-scope row is offered disabled, with the reason. */
  mode: "place" | "navigate";
  targetWorkspaceName: string | null;
  onChoose(row: LauncherRow): void;
  onHover(id: LauncherResultId): void;
}

/**
 * What a screen reader reads for one row.
 *
 * Spelled out rather than left to the visual columns, because the row is
 * compact by design: "chart · climate" and a linked-count badge are legible
 * beside each other and meaningless read aloud in sequence.
 */
function optionLabel(row: LauncherRow, workspaceName: string | null): string {
  if (row.kind === "new") return `Create a new ${row.appTitle} view`;
  const where = workspaceName ? `, workspace ${workspaceName}` : ", not shown in any workspace";
  const linked =
    row.kind === "placed" && row.totalPlacementCount > 1
      ? `, shown in ${row.totalPlacementCount} places, linked`
      : "";
  const doc = row.docName ? ` on ${row.docName}` : "";
  return `${row.title}, ${row.appTitle}${doc}${where}${linked}`;
}

function Option({
  row,
  label,
  active,
  disabledBecause,
  meta,
  onChoose,
  onHover,
}: {
  row: LauncherRow;
  label: string;
  active: boolean;
  disabledBecause: string | null;
  meta: string;
  onChoose(row: LauncherRow): void;
  onHover(id: LauncherResultId): void;
}) {
  return (
    /*
     * An option in the aria-activedescendant pattern must NOT be focusable and
     * must NOT carry its own key handler. DOM focus stays on the combobox so
     * the user can keep typing; a tabindex here would put every result in the
     * tab order, and a per-row key handler could never fire because the row
     * never holds focus. The keyboard path is the combobox's own
     * ArrowUp/ArrowDown/Enter in LauncherDialog, acting on the active row.
     */
    // biome-ignore lint/a11y/useFocusableInteractive: see above
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <div
      id={row.id}
      role="option"
      aria-selected={active}
      aria-disabled={disabledBecause !== null || undefined}
      aria-label={disabledBecause ? `${label}. Unavailable: ${disabledBecause}` : label}
      data-active={active || undefined}
      data-disabled={disabledBecause !== null || undefined}
      className={styles.option}
      // Hover moves the active row so pointer and keyboard agree about what
      // Enter would do, but it is never required: every row is also reachable
      // with the arrow keys alone.
      onPointerMove={() => onHover(row.id)}
      onClick={() => {
        if (!disabledBecause) onChoose(row);
      }}
    >
      <span className={styles.optionTitle}>
        <Text size="small" strong>
          {row.kind === "new" ? row.appTitle : row.title}
        </Text>
      </span>
      <span className={styles.optionMeta}>
        <Text size="tiny" tone="faint">
          {disabledBecause ?? meta}
        </Text>
      </span>
    </div>
  );
}

export function LauncherResults({
  results,
  listId,
  activeId,
  mode,
  targetWorkspaceName,
  onChoose,
  onHover,
}: LauncherResultsProps) {
  if (results.missingWorkspace) {
    const { ordinal, available } = results.missingWorkspace;
    return (
      <div className={styles.notice}>
        <Text size="small" prose>
          No workspace <strong>ws{ordinal}</strong> in the current stage.
        </Text>
        <Text size="tiny" tone="faint" prose>
          {available.length > 0 ? `Available: ${available.join(", ")}.` : "This stage has none."}
        </Text>
      </div>
    );
  }

  if (results.rows.length === 0) {
    return (
      <div className={styles.notice}>
        <Text size="small" tone="faint" prose>
          Nothing matches. Type <strong>+</strong> for a new view, or <strong>ws2</strong> to search
          one workspace.
        </Text>
      </div>
    );
  }

  return (
    <div role="listbox" id={listId} aria-label="views and applications" className={styles.list}>
      {results.groups.map((group) => (
        // A <fieldset> is the rule's suggestion, but ARIA requires role="group"
        // for a labelled section of a listbox, and a fieldset inside one is not
        // a valid owning element.
        // biome-ignore lint/a11y/useSemanticElements: see above
        <div role="group" key={group.workspaceId} aria-label={`workspace ${group.name}`}>
          <div className={styles.groupHead}>
            <SectionLabel>
              {group.alias ? `${group.alias} · ${group.name}` : group.name}
            </SectionLabel>
            {group.isCurrent && (
              <span className={styles.groupTag}>
                <Text size="micro" tone="faint">
                  CURRENT
                </Text>
              </span>
            )}
          </div>
          {group.rows.map((row) => {
            // §8.4: a row whose own workspace offers its application is always
            // a navigation destination, but Replace cannot bring it to a target
            // that does not offer it. Greyed with the reason rather than
            // hidden — this is one or two specific rows, not the
            // twenty-two-of-twenty-five list DR-95 stopped greying.
            const blocked =
              mode === "place" && !row.inScope
                ? `${row.appTitle} is not offered${
                    targetWorkspaceName ? ` in ${targetWorkspaceName}` : " here"
                  }`
                : null;
            const linked =
              row.totalPlacementCount > 1
                ? ` · linked · ${row.placementIds.length} here · ${row.totalPlacementCount} total`
                : "";
            return (
              <Option
                key={row.id}
                row={row}
                label={optionLabel(row, group.name)}
                active={activeId === row.id}
                disabledBecause={blocked}
                meta={`${row.appTitle}${row.docName ? ` · ${row.docName}` : ""}${linked}`}
                onChoose={onChoose}
                onHover={onHover}
              />
            );
          })}
        </div>
      ))}

      {results.unplaced.length > 0 && (
        // A <fieldset> is the rule's suggestion, but ARIA requires role="group"
        // for a labelled section of a listbox, and a fieldset inside one is not
        // a valid owning element.
        // biome-ignore lint/a11y/useSemanticElements: see above
        <div role="group" aria-label="views that are not shown">
          <div className={styles.groupHead}>
            <SectionLabel>Not shown</SectionLabel>
          </div>
          {results.unplaced.map((row) => (
            <Option
              key={row.id}
              row={row}
              label={optionLabel(row, null)}
              active={activeId === row.id}
              disabledBecause={null}
              meta={`${row.appTitle}${row.docName ? ` · ${row.docName}` : ""} · not shown`}
              onChoose={onChoose}
              onHover={onHover}
            />
          ))}
        </div>
      )}

      {results.newApplications.length > 0 && (
        // A <fieldset> is the rule's suggestion, but ARIA requires role="group"
        // for a labelled section of a listbox, and a fieldset inside one is not
        // a valid owning element.
        // biome-ignore lint/a11y/useSemanticElements: see above
        <div role="group" aria-label="new views">
          <div className={styles.groupHead}>
            <SectionLabel>New view</SectionLabel>
            <span className={styles.groupTag}>
              <Text size="micro" tone="faint">
                TYPE +
              </Text>
            </span>
          </div>
          {results.newApplications.map((row) => (
            <Option
              key={row.id}
              row={row}
              label={optionLabel(row, null)}
              active={activeId === row.id}
              disabledBecause={null}
              meta={row.docBound ? "uses the active document" : "no document"}
              onChoose={onChoose}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

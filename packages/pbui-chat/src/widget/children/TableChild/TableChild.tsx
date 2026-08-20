import { Button, Chip, Text } from "@hyperslop-systems/pbui";
import { useMemo } from "react";
import { RefPresentation } from "../../../components/RefPresentation";
import { usePbuiChat } from "../../../context";
import { EMPTY_TABLE_STATE, usePbuiChatStore, type TableFilter, type TableState } from "../../../store/chatStore";
import type { Reference } from "../../../types";
import type { TableChild as TableChildDocument } from "../../../vocabulary/schemas";
import styles from "./TableChild.module.css";

export interface TableChildProps {
  child: TableChildDocument;
  /** Used as the table id when the document names none. */
  fallbackDocId: string;
}

/** `{type:"field", id:"<docId>.<name>"}` — what a header cell stands for. */
export function fieldReference(docId: string, column: { name: string; type?: string }): Reference {
  return {
    type: "field",
    id: `${docId}.${column.name}`,
    value: { tableId: docId, name: column.name, ...(column.type ? { type: column.type } : {}) },
  };
}

/** `{type:"row", id:"<docId>#<i>"}` — what a row handle stands for. */
export function rowReference(
  docId: string,
  index: number,
  columns: readonly { name: string }[],
  cells: readonly unknown[],
): Reference {
  return {
    type: "row",
    id: `${docId}#${index}`,
    value: {
      tableId: docId,
      index,
      cells: Object.fromEntries(columns.map((column, i) => [column.name, cells[i] ?? null])),
    },
  };
}

function compare(a: unknown, b: unknown): number {
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function matches(cell: unknown, filter: TableFilter): boolean {
  const numeric = Number.isFinite(Number(cell)) && Number.isFinite(Number(filter.value)) && String(cell).trim() !== "";
  const left = numeric ? Number(cell) : String(cell ?? "");
  const right = numeric ? Number(filter.value) : filter.value;
  switch (filter.op) {
    case "=":
    case "==":
      return left === right || String(cell ?? "") === filter.value;
    case "!=":
      return !(left === right || String(cell ?? "") === filter.value);
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "contains":
      return String(cell ?? "").toLowerCase().includes(filter.value.toLowerCase());
    default:
      return true;
  }
}

/** Apply local filters and sort, keeping each row's original index for its reference. */
export function projectRows(
  columns: readonly { name: string }[],
  rows: readonly (readonly unknown[])[],
  state: TableState,
): { index: number; cells: readonly unknown[] }[] {
  const columnIndex = new Map(columns.map((c, i) => [c.name, i]));
  let out = rows.map((cells, index) => ({ index, cells }));
  for (const filter of state.filters) {
    const i = columnIndex.get(filter.field);
    if (i === undefined) continue;
    out = out.filter((row) => matches(row.cells[i], filter));
  }
  if (state.sort) {
    const i = columnIndex.get(state.sort.field);
    if (i !== undefined) {
      const sign = state.sort.dir === "desc" ? -1 : 1;
      out = [...out].sort((a, b) => sign * compare(a.cells[i], b.cells[i]));
    }
  }
  return out;
}

/**
 * A table child mints references rather than showing data: every header is
 * a `<field>` and every row handle a `<row>`, so the same menu that works on
 * a product chip works on the agent's output. Filters and sorts are local
 * and live in the chat store, keyed by the document's `docId`.
 */
export function TableChild({ child, fallbackDocId }: TableChildProps) {
  const chat = usePbuiChat();
  const docId = child.docId ?? fallbackDocId;
  const state = usePbuiChatStore(chat.store, (s) => s.tables[docId] ?? EMPTY_TABLE_STATE);
  const rows = useMemo(() => projectRows(child.columns, child.rows, state), [child.columns, child.rows, state]);
  const hidden = child.rows.length - rows.length;

  return (
    <div data-part="table" data-doc-id={docId} data-state={child.streaming ? "streaming" : undefined} className={styles.wrap}>
      {(state.filters.length > 0 || state.sort) && (
        <div data-part="table-filters" className={styles.filters}>
          {state.filters.map((filter, i) => (
            <span key={`${filter.field}-${i}`} className={styles.filter}>
              <Chip label={`${filter.field} ${filter.op} ${filter.value}`} tone="var(--pbui-tone-field)" />
              <Button size="tiny" aria-label={`remove filter ${filter.field}`} onClick={() => chat.store.removeFilter(docId, i)}>
                ×
              </Button>
            </span>
          ))}
          {state.sort && <Chip label={`sort ${state.sort.field} ${state.sort.dir}`} tone="var(--pbui-tone-field)" />}
        </div>
      )}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.handle} aria-label="row" />
              {child.columns.map((column) => (
                <th key={column.name} data-type={column.type}>
                  <RefPresentation reference={fieldReference(docId, column)}>
                    <span className={styles.field}>
                      {column.name}
                      {column.type && <span className={styles.type}>{column.type}</span>}
                    </span>
                  </RefPresentation>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ index, cells }) => (
              <tr key={index}>
                <td className={styles.handle}>
                  <RefPresentation reference={rowReference(docId, index, child.columns, cells)}>
                    <span className={styles.rowHandle}>#{index}</span>
                  </RefPresentation>
                </td>
                {child.columns.map((column, i) => (
                  <td key={column.name} data-type={column.type} className={styles.cell}>
                    {formatCell(cells[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <Text size="tiny" tone="faint">
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {hidden > 0 ? ` (${hidden} filtered out)` : ""}
          {child.streaming ? " · streaming┆" : ""}
        </Text>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

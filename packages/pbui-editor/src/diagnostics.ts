import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, GutterMarker, gutter } from "@codemirror/view";

export type EditorDiagnosticSeverity = "error" | "warning" | "info";

/**
 * One thing to mark in the document. Lines and columns are 1-based, as every
 * compiler, engine and stack trace reports them; converting to CodeMirror's
 * 0-based offsets is this module's job, not the caller's.
 */
export interface EditorDiagnostic {
  /** 1-based. */
  line: number;
  /** 1-based; omit to mark the whole line. */
  column?: number;
  severity: EditorDiagnosticSeverity;
  message: string;
}

export const setDiagnostics = StateEffect.define<readonly EditorDiagnostic[]>();

const SEVERITY_RANK: Record<EditorDiagnosticSeverity, number> = { info: 0, warning: 1, error: 2 };

/** A diagnostic's line, clamped into the document rather than thrown on. */
function clampLine(line: number, lineCount: number): number {
  if (!Number.isFinite(line)) return 1;
  return Math.min(Math.max(1, Math.trunc(line)), Math.max(1, lineCount));
}

/**
 * The decorations for a diagnostic list: a line-background mark plus, when a
 * column is given, an underline on the token at that column. A diagnostic
 * beyond the end of the document is clamped to the last line — a reporter
 * that says "line 400" of a 12-line script is wrong, but it is not a reason
 * to crash the tile, and the last line is where the author will look.
 */
function decorate(view: EditorView, diagnostics: readonly EditorDiagnostic[]): DecorationSet {
  const doc = view.state.doc;
  const builder = new RangeSetBuilder<Decoration>();
  // RangeSetBuilder requires ascending, non-overlapping-start order per range
  // kind; sort by (line, column) and tolerate duplicates by skipping equal
  // starts, since two marks at one offset would throw.
  const sorted = [...diagnostics].sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
  let lastLineFrom = -1;
  let lastMarkFrom = -1;
  for (const d of sorted) {
    const line = doc.line(clampLine(d.line, doc.lines));
    if (line.from !== lastLineFrom) {
      builder.add(line.from, line.from, Decoration.line({ class: "cm-pbui-diagnostic-line", attributes: { "data-severity": d.severity } }));
      lastLineFrom = line.from;
    }
    if (d.column !== undefined && line.length > 0) {
      const col = Math.min(Math.max(1, Math.trunc(d.column)), line.length);
      const from = line.from + col - 1;
      if (from === lastMarkFrom) continue;
      // Underline to the end of the word, or one character if the cursor sits
      // on whitespace or punctuation.
      const rest = line.text.slice(col - 1);
      const word = /^[\w$]+/.exec(rest);
      const to = from + Math.max(1, word ? word[0].length : 1);
      builder.add(from, Math.min(to, line.to), Decoration.mark({ class: `cm-pbui-diagnostic-${d.severity}`, attributes: { title: d.message } }));
      lastMarkFrom = from;
    }
  }
  return builder.finish();
}

interface DiagnosticState {
  list: readonly EditorDiagnostic[];
  decorations: DecorationSet;
}

const diagnosticField = StateField.define<DiagnosticState>({
  create: () => ({ list: [], decorations: Decoration.none }),
  update(value, tr) {
    let list = value.list;
    let changed = false;
    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) {
        list = effect.value;
        changed = true;
      }
    }
    if (!changed && !tr.docChanged) return value;
    // Recomputed lazily on the next view update below; the field only holds
    // the list and a mapped copy of the previous decorations.
    return { list, decorations: changed ? Decoration.none : value.decorations.map(tr.changes) };
  },
});

/** The decorations, recomputed from the field's list against the live document. */
const diagnosticDecorations = EditorView.decorations.compute([diagnosticField, "doc"], (state) => {
  const { list } = state.field(diagnosticField);
  if (list.length === 0) return Decoration.none;
  // `compute` gives us the state, not the view; build against a throwaway
  // view-less doc walk. decorate() only reads `state.doc`, so pass a shim.
  return decorate({ state } as EditorView, list);
});

class SeverityMarker extends GutterMarker {
  constructor(
    private readonly severity: EditorDiagnosticSeverity,
    private readonly message: string,
  ) {
    super();
  }
  override eq(other: SeverityMarker): boolean {
    return other.severity === this.severity && other.message === this.message;
  }
  override toDOM(): Node {
    const span = document.createElement("span");
    span.className = "cm-pbui-gutter-marker";
    span.dataset.severity = this.severity;
    span.title = this.message;
    span.textContent = this.severity === "error" ? "×" : this.severity === "warning" ? "!" : "·";
    return span;
  }
}

const diagnosticGutter = gutter({
  class: "cm-pbui-diagnostic-gutter",
  lineMarker(view, line) {
    const { list } = view.state.field(diagnosticField);
    if (list.length === 0) return null;
    const lineNo = view.state.doc.lineAt(line.from).number;
    // The worst diagnostic on this line wins the gutter.
    let worst: EditorDiagnostic | null = null;
    for (const d of list) {
      if (clampLine(d.line, view.state.doc.lines) !== lineNo) continue;
      if (!worst || SEVERITY_RANK[d.severity] > SEVERITY_RANK[worst.severity]) worst = d;
    }
    return worst ? new SeverityMarker(worst.severity, worst.message) : null;
  },
  lineMarkerChange: (update) =>
    update.docChanged || update.transactions.some((tr) => tr.effects.some((e) => e.is(setDiagnostics))),
});

/** The diagnostics extension: the field, its decorations, and the gutter. */
export function diagnostics(): Extension {
  return [diagnosticField, diagnosticDecorations, diagnosticGutter];
}

/** What the field currently holds; for tests and for a consumer's status line. */
export function currentDiagnostics(view: EditorView): readonly EditorDiagnostic[] {
  return view.state.field(diagnosticField).list;
}

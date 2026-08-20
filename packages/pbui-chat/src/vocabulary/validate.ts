import type { VerbFieldType, Vocabulary } from "./schemas";
import { WIDGET_KINDS, WIDGET_LAYOUTS } from "./schemas";

/**
 * These mirror `pkg/pbuichat/vocabulary.go` and `widgetdoc.go` rule for rule
 * and message for message, so a document the server publishes renders and a
 * verb chip the client disables is disabled for the reason the server would
 * give. Every function returns a reason string or null — the `disabledBecause`
 * shape — rather than throwing, because the callers render the reason.
 */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function isIdentifier(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 64 && IDENTIFIER.test(s);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function goType(value: unknown): string {
  if (value === null) return "<nil>";
  if (Array.isArray(value)) return "[]interface {}";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "float64";
    case "boolean":
      return "bool";
    case "object":
      return "map[string]interface {}";
    default:
      return typeof value;
  }
}

/** Go's `ValidateReference`: structurally sound, type may be unknown. */
export function validateReference(ref: unknown): string | null {
  if (!isRecord(ref)) return "reference is empty";
  if (!isIdentifier(ref.type)) return `reference type "${String(ref.type ?? "")}" is not a valid identifier`;
  const id = ref.id;
  if (typeof id === "string") {
    if (id.trim() === "") return "reference id is empty";
    return null;
  }
  if (typeof id === "number") return null;
  return "reference has no id";
}

function checkCoarseType(value: unknown, type: VerbFieldType): string | null {
  switch (type) {
    case "string":
      return typeof value === "string" ? null : `expected string, got ${goType(value)}`;
    case "number":
      return typeof value === "number" ? null : `expected number, got ${goType(value)}`;
    case "boolean":
      return typeof value === "boolean" ? null : `expected boolean, got ${goType(value)}`;
    case "ref":
      if (!isRecord(value)) return `expected reference object, got ${goType(value)}`;
      return validateReference(value);
    case "refs": {
      if (!Array.isArray(value)) return `expected list of references, got ${goType(value)}`;
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!isRecord(item)) return `refs[${i}]: expected reference object, got ${goType(item)}`;
        const problem = validateReference(item);
        if (problem) return `refs[${i}]: ${problem}`;
      }
      return null;
    }
    case "object":
      return isRecord(value) ? null : `expected object, got ${goType(value)}`;
  }
}

/**
 * Go's `Vocabulary.ValidateVerb`. Returns a `disabledBecause`-style string
 * ("unknown verb frobnicate", "verb inspect is missing ref") or null.
 */
export function validateVerb(vocabulary: Vocabulary, verb: unknown): string | null {
  if (!isRecord(verb)) return "verb is empty";
  const kind = typeof verb.kind === "string" ? verb.kind : "";
  if (!kind) return "verb has no kind";
  const spec = vocabulary.verbs[kind];
  if (!spec) return `unknown verb ${kind}`;
  for (const [field, type] of Object.entries(spec.fields)) {
    const optional = field.endsWith("?");
    const name = optional ? field.slice(0, -1) : field;
    const value = verb[name];
    if (value === undefined || value === null) {
      if (optional) continue;
      return `verb ${kind} is missing ${name}`;
    }
    const problem = checkCoarseType(value, type);
    if (problem) return `verb ${kind} field ${name}: ${problem}`;
  }
  return null;
}

export interface WidgetLimits {
  widgetChildren: number;
  widgetDepth: number;
  tableRows: number;
}

export const DEFAULT_WIDGET_LIMITS: WidgetLimits = { widgetChildren: 64, widgetDepth: 3, tableRows: 500 };

export interface WidgetValidationOptions {
  /**
   * `strict` (default) is Go's rule: a verb chip that fails the vocabulary
   * fails the document — what the server applies before publishing.
   * `lenient` is what the CLIENT applies on render: a chip only needs a
   * label and a verb object, and `VerbChips` disables an invalid one with
   * its reason, so one bad chip never blanks an otherwise good widget.
   */
  verbs?: "strict" | "lenient";
}

const KNOWN_KINDS = new Set<string>(WIDGET_KINDS);
const KNOWN_LAYOUTS = new Set<string>(WIDGET_LAYOUTS);

/**
 * Go's `ValidateWidgetDocument`. `vocabulary` may be null, in which case
 * verb chips are only checked for presence (as Go does).
 */
export function validateWidgetDocument(
  vocabulary: Vocabulary | null,
  doc: unknown,
  limits: WidgetLimits = DEFAULT_WIDGET_LIMITS,
  options: WidgetValidationOptions = {},
): string | null {
  if (!isRecord(doc)) return "widget document is empty";
  if (doc.format !== "pbui.widget") return 'format must be "pbui.widget"';
  if (typeof doc.schema_version !== "number" || Math.trunc(doc.schema_version) !== 1) {
    return "schema_version must be 1";
  }
  const counter = { n: 0 };
  return validateBody(doc, options.verbs === "lenient" ? null : vocabulary, limits, 1, counter);
}

function validateBody(
  doc: Record<string, unknown>,
  vocabulary: Vocabulary | null,
  limits: WidgetLimits,
  depth: number,
  counter: { n: number },
): string | null {
  if (limits.widgetDepth > 0 && depth > limits.widgetDepth) {
    return `widget nesting deeper than ${limits.widgetDepth}`;
  }
  if (typeof doc.layout === "string" && doc.layout !== "" && !KNOWN_LAYOUTS.has(doc.layout)) {
    return `unknown layout "${doc.layout}"`;
  }
  const children = Array.isArray(doc.children) ? doc.children : [];
  if (children.length === 0) return "widget has no children";
  for (let i = 0; i < children.length; i++) {
    counter.n++;
    if (limits.widgetChildren > 0 && counter.n > limits.widgetChildren) {
      return `more than ${limits.widgetChildren} children`;
    }
    const child = children[i];
    if (!isRecord(child)) return `children[${i}] is not an object`;
    const kind = typeof child.kind === "string" ? child.kind : "";
    if (!KNOWN_KINDS.has(kind)) return `children[${i}] has unknown kind "${kind}"`;
    const problem = validateChild(kind, child, vocabulary, limits, depth, counter);
    if (problem) return `children[${i}] (${kind}): ${problem}`;
  }
  if (Array.isArray(doc.verbs)) {
    for (let i = 0; i < doc.verbs.length; i++) {
      const chip = doc.verbs[i];
      if (!isRecord(chip)) return `verbs[${i}] is not an object`;
      if (typeof chip.label !== "string" || chip.label === "") return `verbs[${i}] has no label`;
      const verb = isRecord(chip.verb) ? chip.verb : null;
      if (vocabulary) {
        const problem = validateVerb(vocabulary, verb);
        if (problem) return `verbs[${i}]: ${problem}`;
      } else if (!verb) {
        return `verbs[${i}] has no verb`;
      }
    }
  }
  return null;
}

function validateChild(
  kind: string,
  child: Record<string, unknown>,
  vocabulary: Vocabulary | null,
  limits: WidgetLimits,
  depth: number,
  counter: { n: number },
): string | null {
  if (isRecord(child.ref)) {
    const problem = validateReference(child.ref);
    if (problem) return problem;
  }
  switch (kind) {
    case "refs": {
      const refs = Array.isArray(child.refs) ? child.refs : [];
      for (let i = 0; i < refs.length; i++) {
        if (!isRecord(refs[i])) return `refs[${i}] is not an object`;
        const problem = validateReference(refs[i]);
        if (problem) return `refs[${i}]: ${problem}`;
      }
      return null;
    }
    case "table": {
      const columns = Array.isArray(child.columns) ? child.columns : [];
      if (columns.length === 0) return "table has no columns";
      const rows = Array.isArray(child.rows) ? child.rows : [];
      if (limits.tableRows > 0 && rows.length > limits.tableRows) {
        return `table has ${rows.length} rows, limit ${limits.tableRows}`;
      }
      for (let i = 0; i < rows.length; i++) {
        if (!Array.isArray(rows[i])) return `rows[${i}] is not an array`;
      }
      return null;
    }
    case "meter":
      return typeof child.value === "number" ? null : "meter needs a numeric value";
    case "sparkline":
      return Array.isArray(child.values) && child.values.length > 0 ? null : "sparkline needs values";
    case "segmented":
      return Array.isArray(child.parts) && child.parts.length > 0 ? null : "segmented needs parts";
    case "text":
      return typeof child.text === "string" ? null : "text needs text";
    case "callout":
      return typeof child.text === "string" ? null : "callout needs text";
    case "form":
      return Array.isArray(child.fields) && child.fields.length > 0 ? null : "form needs fields";
    case "widget": {
      if (!isRecord(child.document)) return "nested widget needs a document";
      return validateBody(child.document, vocabulary, limits, depth + 1, counter);
    }
    default:
      return null;
  }
}

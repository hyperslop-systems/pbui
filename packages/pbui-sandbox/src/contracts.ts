/**
 * The contracts a program and its host agree on.
 *
 * Ported from vm-system's `frontend/packages/plugin-runtime/src/{contracts,uiTypes}.ts`
 * (commit 37bd440) with the PBUI additions: a `ref` node that becomes a
 * presentation, a few nodes that map to pbui atoms, and a `verb` intent scope
 * that is the program's only way to affect anything outside its own state.
 *
 * Everything here crosses an engine boundary as JSON. No functions, no class
 * instances, no host objects — that rule is what lets the same program run
 * under `eval` today and QuickJS tomorrow.
 */

/** Names a handler by string; the renderer never receives a function. */
export type UIEventRef = { handler: string; args?: unknown };

/** A wire reference, as `@hyperslop-systems/pbui-chat` spells it. */
export interface UIReference {
  type: string;
  id: string;
  value?: Record<string, unknown>;
}

export type UITextSize = "tiny" | "small" | "body" | "title";
export type UIButtonVariant = "primary" | "framed" | "destructive";
export type UICalloutVariant = "neutral" | "warning" | "positive" | "danger";

export type UINode =
  | { kind: "panel" | "row" | "column"; props?: { title?: string; gap?: 1 | 2 | 3 }; children?: UINode[] }
  | { kind: "text"; text: string; props?: { size?: UITextSize; tone?: "faint" | "default"; strong?: boolean } }
  | { kind: "badge"; text: string; props?: { tone?: string } }
  | { kind: "button"; props: { label: string; onClick?: UIEventRef; variant?: UIButtonVariant; disabled?: boolean } }
  | { kind: "input"; props: { value: string; placeholder?: string; type?: "text" | "number"; onChange?: UIEventRef } }
  | { kind: "select"; props: { value: string; options: { value: string; label: string }[]; onChange?: UIEventRef } }
  | { kind: "table"; props: { headers: string[]; rows: unknown[][] } }
  | { kind: "meter"; props: { fraction: number; label?: string; value?: string } }
  | { kind: "sparkline"; props: { points: number[]; label?: string } }
  | { kind: "callout"; props: { variant?: UICalloutVariant; title?: string; text: string } }
  | { kind: "ref"; props: { reference: UIReference; label?: string } };

export type UINodeKind = UINode["kind"];

/** The closed set of node kinds, in the order the prompt lists them. Exported for the vocabulary's `sandbox.kinds`. */
export const SANDBOX_UI_KINDS: readonly UINodeKind[] = [
  "panel",
  "row",
  "column",
  "text",
  "badge",
  "button",
  "input",
  "select",
  "table",
  "meter",
  "sparkline",
  "callout",
  "ref",
];

/** The plugin-scoped action types the host reduces; anything else is recorded as ignored. */
export type PluginActionType = "state/merge" | "state/replace";

/** What a program may ask for. Exported for the vocabulary's `sandbox.intents`. */
export const SANDBOX_INTENTS = ["state/merge", "state/replace", "verb"] as const;

/** A serialisable verb, as the product's router accepts it. */
export type VerbLike = { kind: string } & Record<string, unknown>;

export type DispatchIntent =
  | { scope: "plugin"; actionType: PluginActionType | (string & {}); payload?: unknown; instanceId?: string }
  | { scope: "verb"; verb: VerbLike; instanceId?: string };

/** What `load` returns: the program's own metadata, validated. */
export interface LoadedProgram {
  programId: string;
  instanceId: string;
  declaredId?: string;
  title: string;
  description?: string;
  initialState?: unknown;
  /** Binding keys the program wants resolved into `globalState.shared.documents`. */
  bindings: string[];
  widgets: string[];
}

export type ProgramErrorCode = "RUNTIME_ERROR" | "RUNTIME_TIMEOUT" | "VALIDATION_ERROR" | "UNKNOWN_ERROR";
export type ProgramPhase = "load" | "render" | "event";

export interface ProgramErrorPayload {
  code: ProgramErrorCode;
  message: string;
  phase?: ProgramPhase;
}

/**
 * The second argument of `render` and of every handler. Keeps vm-system's
 * `{ self, shared, system }` shape so its docs stay true; `shared` holds the
 * two read-only domains a program may see.
 */
export interface ProgramGlobalState {
  self: { instanceId: string; programId: string; viewId: string; placementId: string };
  shared: {
    /** The view's bindings, resolved by the product; `null` when it could not resolve one. */
    documents: Record<string, UIReference | null>;
    /** The product's descriptor environment (e.g. `{ canApprove }`). */
    env: Record<string, unknown>;
  };
  system: { engine: "eval" | "quickjs"; version: number };
}

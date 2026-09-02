/**
 * Compile diagnostics of the presentation model (PBUI-KERNEL-1 §15.2).
 *
 * Severity and timing are separate: STRUCTURAL errors throw from
 * `compilePresentation` and never produce a model; ADVISORY findings are
 * returned by `model.diagnostics()` and carry the owning fragment so a
 * product can act on them. Every code here is advisory; the structural
 * errors are the thrown messages of the registries and the compiler.
 */
export type ModelDiagnosticCode =
  | "potential-conflict"
  | "opaque-tester"
  | "family-overlap"
  | "unreachable-private-relation"
  | "empty-fragment"
  | "missing-descriptor";

export interface ModelDiagnostic {
  readonly severity: "error" | "warning";
  readonly code: ModelDiagnosticCode;
  readonly message: string;
  /** The declaration the finding is about (rule, relation, type, ...). */
  readonly ownerId?: string;
  /** The fragment that declared the owner; absent for cross-fragment findings. */
  readonly fragmentId?: string;
  /** A dotted path into the declaration, when one helps (e.g. "actions.shop.open"). */
  readonly path?: string;
}

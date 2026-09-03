/**
 * One finding about a document, in the shape `pkg/workbench` reports its
 * `ValidationError{Code, Path, Detail}` and the protocol applier reports its
 * `MutationError`: a stable code, the offending field path, and a sentence.
 * Codes are shared with Go wherever the same rule exists.
 */
export interface WorkbenchDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly detail: string;
}

export type ValidationResult = { ok: true } | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };

export function diagnostic(code: string, path: string, detail: string): WorkbenchDiagnostic {
  return { code, path, detail };
}

/** Thrown only where a caller passed something the index cannot even represent (a duplicate node id). */
export class WorkbenchDiagnosticError extends Error {
  readonly diagnostic: WorkbenchDiagnostic;

  constructor(finding: WorkbenchDiagnostic) {
    super(finding.path ? `workbench-core: ${finding.code} at ${finding.path}: ${finding.detail}` : `workbench-core: ${finding.code}: ${finding.detail}`);
    this.name = "WorkbenchDiagnosticError";
    this.diagnostic = finding;
  }
}

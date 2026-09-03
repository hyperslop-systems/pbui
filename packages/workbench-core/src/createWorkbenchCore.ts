import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError, newId, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import { createManifestCatalog, isManifestCatalog, type ManifestCatalog, type WorkbenchAppManifest } from "./apps";
import { diagnostic, WorkbenchDiagnosticError, type WorkbenchDiagnostic } from "./diagnostics";
import { parseWorkbenchDocument, serializeDocument } from "./document";
import { buildWorkbenchIndex, type WorkbenchIndex } from "./graph";
import { compilePolicy, type WorkbenchPolicy, type WorkbenchPolicyInput } from "./policy";
import { repairSession, type WorkbenchSession } from "./session";
import { validateWorkbenchDocument } from "./validation";

/**
 * The core's one observable snapshot (guide §16.3): the document, the
 * semantic session, the structural index of exactly that document, and one
 * coarse local revision that bumps on every install. Immutable; a new object
 * per install, one notification per install.
 */
export interface WorkbenchCoreState {
  readonly document: WorkbenchDocument;
  readonly session: WorkbenchSession;
  readonly index: WorkbenchIndex;
  readonly revision: number;
}

/** What a post-commit observer (persistence, a sync outbox) learns about one durable transition. */
export interface CommitReceipt {
  readonly mutations: readonly Mutation[];
  readonly document: WorkbenchDocument;
  readonly revision: number;
}

export interface CreateWorkbenchCoreOptions {
  /** The starting document; validated against the catalog at construction (a broken start is a thrown `WorkbenchDiagnosticError`). */
  initial: WorkbenchDocument;
  apps: readonly WorkbenchAppManifest[] | ManifestCatalog;
  policy?: WorkbenchPolicyInput;
  /** Deterministic ids for tests and replay; default `newId`. */
  ids?: IdGenerator;
  initialSession?: Partial<WorkbenchSession>;
  /**
   * Once per COMMITTED durable batch, after the new state is installed. This
   * is what an outbox or persistence layer subscribes to; a state
   * subscription would also fire for session changes, which never reach a
   * server.
   */
  onCommit?(receipt: CommitReceipt): void;
  /** A batch the applier or essential validation refused. Replaces the default `console.warn`. */
  onRejected?(mutations: readonly Mutation[], diagnostics: readonly WorkbenchDiagnostic[]): void;
  /** A post-commit observer threw after the state was installed; deliberately separate from `onRejected` (retrying would duplicate a visible change). */
  onPostCommitError?(error: unknown, receipt: CommitReceipt): void;
}

/** The small result of a raw batch through the gateway. */
export type ApplyResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: string; because: string; diagnostics: readonly WorkbenchDiagnostic[] };

export type ReplaceResult = { ok: true } | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };

export interface WorkbenchCore {
  readonly apps: ManifestCatalog;
  readonly policy: WorkbenchPolicy;
  readonly ids: IdGenerator;
  getState(): WorkbenchCoreState;
  subscribe(listener: () => void): () => void;
  /**
   * The raw-batch door of the one execution gateway: apply atomically,
   * validate the complete graph, maintain extensions, install once. Either
   * every mutation lands or the state is untouched.
   */
  apply(mutations: readonly Mutation[]): ApplyResult;
  /** Replace the document wholesale through the gateway: validated, indexed, session repaired, one notification. */
  replaceDocument(document: WorkbenchDocument, options?: { session?: Partial<WorkbenchSession> }): ReplaceResult;
  serialize(): string;
  /** Replace from `serialize()` output; the state is untouched when it does not parse or validate. */
  restore(json: string): ReplaceResult;
  /**
   * Back to a starting layout. With no argument, the document the core was
   * CREATED with — which after a reload is the one restored from storage, so
   * a persisted product passes its own factory or "reset" restores the layout
   * the user is trying to escape.
   */
  reset(factory?: () => WorkbenchDocument): ReplaceResult;
}

/**
 * The internals `execute` (Phase 3) and the links collaborator (Phase 4)
 * build on: the install primitive and the mutation pipeline, kept off the
 * public object so no caller can install a document that skipped
 * validation.
 */
export interface WorkbenchCoreInternals {
  install(next: { document: WorkbenchDocument; session?: WorkbenchSession; mutations?: readonly Mutation[] }): void;
  /** Apply + validate without installing; the shared preflight of every durable door. */
  prepare(mutations: readonly Mutation[]): { ok: true; document: WorkbenchDocument } | { ok: false; code: string; because: string; diagnostics: readonly WorkbenchDiagnostic[] };
}

export function createWorkbenchCore(options: CreateWorkbenchCoreOptions): WorkbenchCore {
  const { core } = createWorkbenchCoreWithInternals(options);
  return core;
}

export function createWorkbenchCoreWithInternals(options: CreateWorkbenchCoreOptions): { core: WorkbenchCore; internals: WorkbenchCoreInternals } {
  const apps = isManifestCatalog(options.apps) ? options.apps : createManifestCatalog(options.apps);
  const policy = compilePolicy(options.policy);
  const ids = options.ids ?? newId;
  const initial = options.initial;

  const initialCheck = validateWorkbenchDocument(initial, { apps });
  if (!initialCheck.ok) throw new WorkbenchDiagnosticError(initialCheck.diagnostics[0]!);

  const listeners = new Set<() => void>();
  let state: WorkbenchCoreState = (() => {
    const index = buildWorkbenchIndex(initial);
    const session = repairSession(
      { workspaceId: options.initialSession?.workspaceId ?? initial.workspaces[0]?.id ?? "", activePlacementId: options.initialSession?.activePlacementId ?? null },
      initial,
      index,
    );
    return { document: initial, session, index, revision: 0 };
  })();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const report = (mutations: readonly Mutation[], diagnostics: readonly WorkbenchDiagnostic[]) => {
    if (options.onRejected) options.onRejected(mutations, diagnostics);
    else console.warn(`workbench-core: dropped a mutation batch — ${diagnostics[0]?.code}${diagnostics[0]?.path ? ` at ${diagnostics[0].path}` : ""}: ${diagnostics[0]?.detail}`);
  };

  const prepare: WorkbenchCoreInternals["prepare"] = (mutations) => {
    let next: WorkbenchDocument;
    try {
      next = applyMutations(state.document, [...mutations]);
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;
      const finding = diagnostic(error.code, error.path, error.detail);
      return { ok: false, code: error.code, because: error.detail, diagnostics: [finding] };
    }
    const checked = validateWorkbenchDocument(next, { apps });
    if (!checked.ok) {
      const first = checked.diagnostics[0]!;
      return { ok: false, code: first.code, because: first.detail, diagnostics: checked.diagnostics };
    }
    return { ok: true, document: next };
  };

  const install: WorkbenchCoreInternals["install"] = ({ document: next, session, mutations }) => {
    const index = next === state.document ? state.index : buildWorkbenchIndex(next);
    const repaired = repairSession(session ?? state.session, next, index);
    const revision = state.revision + 1;
    state = { document: next, session: repaired, index, revision };
    notify();
    if (mutations && mutations.length > 0) {
      const receipt: CommitReceipt = { mutations, document: next, revision };
      // A post-commit hook runs after the state is visible. Its failure must
      // never turn a committed batch into a refusal or throw through the
      // caller: an agent would retry and duplicate work that already landed.
      try {
        options.onCommit?.(receipt);
      } catch (error) {
        try {
          if (options.onPostCommitError) options.onPostCommitError(error, receipt);
          else console.error("workbench-core: post-commit hook failed", error);
        } catch (reportingError) {
          console.error("workbench-core: post-commit error handler failed", reportingError);
        }
      }
    }
  };

  const replace = (next: WorkbenchDocument, session?: Partial<WorkbenchSession>): ReplaceResult => {
    const checked = validateWorkbenchDocument(next, { apps });
    if (!checked.ok) return { ok: false, diagnostics: checked.diagnostics };
    install({ document: next, session: { workspaceId: session?.workspaceId ?? state.session.workspaceId, activePlacementId: session?.activePlacementId ?? null } });
    return { ok: true };
  };

  const core: WorkbenchCore = {
    apps,
    policy,
    ids,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    apply(mutations) {
      if (mutations.length === 0) return { ok: true, changed: false };
      const prepared = prepare(mutations);
      if (!prepared.ok) {
        report(mutations, prepared.diagnostics);
        return prepared;
      }
      install({ document: prepared.document, mutations: [...mutations] });
      return { ok: true, changed: true };
    },
    replaceDocument: (next, replaceOptions = {}) => replace(next, replaceOptions.session),
    serialize: () => serializeDocument(state.document),
    restore(json) {
      const parsed = parseWorkbenchDocument(json, { apps });
      if (!parsed.ok) return parsed;
      return replace(parsed.document);
    },
    reset: (factory) => replace(factory ? factory() : initial),
  };

  return { core, internals: { install, prepare } };
}

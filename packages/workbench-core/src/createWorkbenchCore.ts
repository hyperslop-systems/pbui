import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError, newId, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import { createManifestCatalog, isManifestCatalog, type ManifestCatalog, type WorkbenchAppManifest } from "./apps";
import { describeWorkbenchCommand, type WorkbenchCommand } from "./commands";
import { diagnostic, WorkbenchDiagnosticError, type WorkbenchDiagnostic } from "./diagnostics";
import { parseWorkbenchDocument, serializeDocument } from "./document";
import type { GeometrySnapshot } from "./geometry";
import { buildWorkbenchIndex, type WorkbenchIndex } from "./graph";
import type { WorkbenchLinks } from "./links/collaborator";
import { plan, type PlanResult, type PreparedTransition } from "./planner/plan";
import type { Choice, PlanWorld } from "./planner/world";
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
  /** Tile linking: the one explicit collaborator (guide §16.6). Absent ⇒ link commands are refused with `no_links`. */
  links?: WorkbenchLinks;
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
  /** A command the planner refused (not a batch the applier refused). Replaces the default silence; agents read the result instead. */
  onRefused?(command: WorkbenchCommand, code: string, because: string): void;
}

export interface ExecuteOptions {
  /** Geometry measured immediately before this call (S10); absent ⇒ the policy's headless fallbacks. */
  geometry?: GeometrySnapshot;
}

/** The small public result (guide §16.8, S12). */
export type ExecuteResult =
  | {
      ok: true;
      changed: boolean;
      /** The placement the command created or landed on, when there is one. */
      placementId?: string;
      viewId?: string;
      workspaceId?: string;
    }
  | { ok: false; code: string; because: string; choices?: readonly Choice[] };

/** What `preview` returns: advisory, never a commit handle (S2). */
export type PreviewResult =
  | { ok: true; changed: boolean; mutations: readonly Mutation[]; session: WorkbenchSession; explanation: string; placementId?: string; viewId?: string; workspaceId?: string }
  | { ok: false; code: string; because: string; choices?: readonly Choice[] };

/** The small result of a raw batch through the gateway. */
export type ApplyResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: string; because: string; diagnostics: readonly WorkbenchDiagnostic[] };

export type ReplaceResult = { ok: true } | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };

export interface WorkbenchCore {
  readonly apps: ManifestCatalog;
  readonly policy: WorkbenchPolicy;
  readonly ids: IdGenerator;
  /** The links collaborator, when one was given. */
  readonly links: WorkbenchLinks | null;
  getState(): WorkbenchCoreState;
  subscribe(listener: () => void): () => void;
  /**
   * The normal semantic door (guide §16.3): capture the state, plan the
   * command(s) against immutable values, confirm the revision, apply the
   * complete batch, validate, maintain links, install once, then run the
   * planned non-durable effects. Several commands are one transition:
   * every one plans or none lands.
   */
  execute(command: WorkbenchCommand | readonly WorkbenchCommand[], options?: ExecuteOptions): ExecuteResult;
  /** The pure planning half, for a description or a choice; nothing observable changes, no effect runs. Accepting it means calling `execute` again. */
  preview(command: WorkbenchCommand | readonly WorkbenchCommand[], options?: ExecuteOptions): PreviewResult;
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
  const links = options.links ?? null;
  links?.bind(apps);

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

  const worldOf = (geometry: GeometrySnapshot | undefined): PlanWorld => ({
    document: state.document,
    session: state.session,
    index: state.index,
    apps,
    policy,
    geometry: geometry ?? null,
    ids,
    links,
  });

  const planned = (input: WorkbenchCommand | readonly WorkbenchCommand[], geometry: GeometrySnapshot | undefined): { commands: readonly WorkbenchCommand[]; result: PlanResult } => {
    const commands = Array.isArray(input) ? (input as readonly WorkbenchCommand[]) : [input as WorkbenchCommand];
    return { commands, result: plan(worldOf(geometry), commands) };
  };

  const refusal = (result: Exclude<PlanResult, { kind: "prepared" }>): { ok: false; code: string; because: string; choices?: readonly Choice[] } => {
    if (result.kind === "ambiguous") {
      options.onRefused?.(result.command, "ambiguous", result.because);
      return { ok: false, code: "ambiguous", because: result.because, choices: result.choices };
    }
    options.onRefused?.(result.command, result.code, result.because);
    return { ok: false, code: result.code, because: result.because };
  };

  const ids_of = (transition: PreparedTransition) => ({
    ...(transition.placementId ? { placementId: transition.placementId } : {}),
    ...(transition.viewId ? { viewId: transition.viewId } : {}),
    ...(transition.workspaceId ? { workspaceId: transition.workspaceId } : {}),
  });

  const core: WorkbenchCore = {
    apps,
    policy,
    ids,
    links,
    getState: () => state,
    execute(input, executeOptions = {}) {
      const revision = state.revision;
      const { commands, result } = planned(input, executeOptions.geometry);
      if (result.kind !== "prepared") return refusal(result);
      const { transition } = result;
      // Planning is synchronous over a captured snapshot; the check is the
      // coarse-revision precondition of S1, kept explicit so a re-entrant
      // listener can never install over a state it did not plan against.
      if (state.revision !== revision) return { ok: false, code: "stale", because: "the workbench changed while the command was planned" };
      if (!transition.changed) return { ok: true, changed: false, ...ids_of(transition) };
      let next = state.document;
      if (transition.mutations.length > 0) {
        const prepared = prepare(transition.mutations);
        if (!prepared.ok) {
          report(transition.mutations, prepared.diagnostics);
          options.onRefused?.(commands[0]!, prepared.code, prepared.because);
          return { ok: false, code: prepared.code, because: prepared.because };
        }
        next = prepared.document;
      }
      install({ document: next, session: transition.session, ...(transition.mutations.length > 0 ? { mutations: transition.mutations } : {}) });
      links?.afterCommit(transition.effects);
      return { ok: true, changed: true, ...ids_of(transition) };
    },
    preview(input, previewOptions = {}) {
      const { commands, result } = planned(input, previewOptions.geometry);
      if (result.kind !== "prepared") return refusal(result);
      const { transition } = result;
      return { ok: true, changed: transition.changed, mutations: transition.mutations, session: transition.session, explanation: commands.map(describeWorkbenchCommand).join("; "), ...ids_of(transition) };
    },
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

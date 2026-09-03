import { equals } from "@bufbuild/protobuf";
import { WorkbenchDocumentSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError, newId, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import { createManifestCatalog, isManifestCatalog, type ManifestCatalog, type WorkbenchAppManifest } from "./apps";
import { describeWorkbenchCommand, type WorkbenchCommand } from "./commands";
import { diagnostic, WorkbenchDiagnosticError, type WorkbenchDiagnostic } from "./diagnostics";
import { parseWorkbenchDocument, serializeDocument } from "./document";
import type { LocalEffect } from "./effects";
import type { GeometrySnapshot } from "./geometry";
import { buildWorkbenchIndex, type WorkbenchIndex } from "./graph";
import type { WorkbenchLinks } from "./links/collaborator";
import type { LinkRuntimeState } from "./links/runtime";
import { plan, type PlanResult, type PreparedTransition } from "./planner/plan";
import type { Choice, PlanWorld } from "./planner/world";
import { createIdPool } from "./ids";
import { deepFreeze, defaultOwnership, own, readonlyIndex, type OwnershipMode } from "./ownership";
import { compilePolicy, type WorkbenchPolicy, type WorkbenchPolicyInput } from "./policy";
import { attemptAll, reportFailures, type WorkbenchObserverError } from "./publication";
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
  /** Deterministic ids for tests and replay; default `newId`. Plans read it through a lookahead pool, so a preview consumes nothing (§5.5). */
  ids?: IdGenerator;
  /**
   * `"freeze"`: the exposed document, session and index are deep-frozen,
   * so a caller that mutates them fails at the assignment. `"trust"`: no
   * freeze (no per-install cost). Default: freeze unless `NODE_ENV` is
   * `production`. Every ingress document is cloned in both modes.
   */
  ownership?: OwnershipMode;
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
  /**
   * An observer threw during publication — the receipt hook, a link
   * subscriber, a core subscriber, or replacement effects — after the state
   * was installed. Deliberately separate from `onRejected`: the change
   * landed, so retrying would duplicate it. Every observer is still
   * attempted; this is told about each failure after all attempts. Default
   * `console.error`.
   */
  onObserverError?(finding: WorkbenchObserverError): void;
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
  | {
      ok: false;
      code: string;
      because: string;
      choices?: readonly Choice[];
      /** For a batch: which command was refused, and its position. */
      index?: number;
      command?: WorkbenchCommand;
    };

/** What `preview` returns: advisory, never a commit handle (S2). */
export type PreviewResult =
  | { ok: true; changed: boolean; mutations: readonly Mutation[]; session: WorkbenchSession; explanation: string; placementId?: string; viewId?: string; workspaceId?: string }
  | Extract<ExecuteResult, { ok: false }>;

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
  /** A clone of the current document, for an integration that wants to write on one of its own. */
  snapshot(): WorkbenchDocument;
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
  /** Check a document against this core's catalog without installing it (what `replaceDocument` would decide). */
  validateDocument(document: WorkbenchDocument): ReplaceResult;
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
  install(next: { document: WorkbenchDocument; session?: WorkbenchSession; mutations?: readonly Mutation[]; effects?: readonly LocalEffect[]; linkState?: LinkRuntimeState }): void;
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
  const pool = createIdPool(ids);
  const ownership = options.ownership ?? defaultOwnership();
  // Ingress: the core owns its documents (§6.5); a caller's later edits to
  // what it passed in reach nothing.
  const initial = own(WorkbenchDocumentSchema, options.initial);
  const links = options.links ?? null;
  links?.bind(apps);

  const initialCheck = validateWorkbenchDocument(initial, { apps });
  if (!initialCheck.ok) throw new WorkbenchDiagnosticError(initialCheck.diagnostics[0]!);

  const listeners = new Set<() => void>();
  /**
   * Where the core is in a transaction (design doc 04 §6.3). A mutation door
   * called while not `idle` — from a subscriber, a receipt hook, a link
   * observer — is refused with `reentrant_execution` rather than nested:
   * nesting published an inner receipt before the outer one, and queueing
   * would make a synchronous result dishonest. An integration that reacts to
   * a publication schedules its own mutation for after it.
   */
  let phase: "idle" | "preparing" | "publishing" = "idle";
  const REENTRANT = { code: "reentrant_execution", because: "the workbench is publishing a transaction; a mutation from an observer must be scheduled for after it" } as const;
  const owned = (next: WorkbenchCoreState): WorkbenchCoreState => {
    if (ownership !== "freeze") return next;
    deepFreeze(next.document);
    deepFreeze(next.session);
    readonlyIndex(next.index);
    return Object.freeze(next);
  };
  let state: WorkbenchCoreState = (() => {
    const index = buildWorkbenchIndex(initial);
    const session = repairSession(
      { workspaceId: options.initialSession?.workspaceId ?? initial.workspaces[0]?.id ?? "", activePlacementId: options.initialSession?.activePlacementId ?? null },
      initial,
      index,
    );
    return owned({ document: initial, session, index, revision: 0 });
  })();

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

  /**
   * Install, then publish (design doc 04 §6.1–6.2). Past the assignment of
   * `state` nothing may make the operation look uncommitted: the receipt
   * hook, the links effects and every subscriber are attempted under the
   * safe primitive, failures are collected, and the caller gets its
   * success. Publication order: receipt → link observers → core observers.
   */
  const install: WorkbenchCoreInternals["install"] = ({ document: next, session, mutations, effects, linkState }) => {
    const index = next === state.document ? state.index : buildWorkbenchIndex(next);
    const repaired = repairSession(session ?? state.session, next, index);
    const revision = state.revision + 1;
    // Stage the link runtime's next value BEFORE the point of no return
    // (design doc 04 §6.6): a reducer that throws leaves nothing installed.
    const stagedLinks = linkState ?? (effects && effects.length > 0 && links ? links.stage(effects) : null);
    state = owned({ document: next, session: repaired, index, revision });
    if (stagedLinks && links) links.install(stagedLinks);
    phase = "publishing";
    const failures: WorkbenchObserverError[] = [];
    try {
      if (mutations && mutations.length > 0) {
        const receipt: CommitReceipt = { mutations, document: next, revision };
        attemptAll([receipt], (item) => options.onCommit?.(item), "commit-receipt", revision, failures);
      }
      if (stagedLinks && links) links.publish(revision, failures);
      attemptAll(listeners, (listener) => listener(), "core-subscriber", revision, failures);
    } finally {
      phase = "idle";
    }
    reportFailures(failures, options.onObserverError);
  };

  const replace = (incoming: WorkbenchDocument, session?: Partial<WorkbenchSession>): ReplaceResult => {
    let next = incoming;
    if (phase !== "idle") return { ok: false, diagnostics: [diagnostic(REENTRANT.code, "", REENTRANT.because)] };
    const checked = validateWorkbenchDocument(next, { apps });
    if (!checked.ok) return { ok: false, diagnostics: checked.diagnostics };
    next = own(WorkbenchDocumentSchema, next);
    // The runtime holds values keyed by view; a view the new document does
    // not have must not keep emitting into badges from beyond the grave.
    // Staged as a value and installed with the document (same path as a commit).
    const linkState = links?.stageReplace(next) ?? null;
    install({ document: next, session: { workspaceId: session?.workspaceId ?? state.session.workspaceId, activePlacementId: session?.activePlacementId ?? null }, ...(linkState ? { linkState } : {}) });
    return { ok: true };
  };

  /** The forget-values effects a raw batch implies: one per deleted view. */
  const forgetEffects = (mutations: readonly Mutation[]): LocalEffect[] =>
    mutations.flatMap((item) => (item.body.case === "viewDelete" ? [{ kind: "forget-view-values" as const, viewId: item.body.value.viewId }] : []));

  const worldOf = (geometry: GeometrySnapshot | undefined, planIds: IdGenerator): PlanWorld => ({
    document: state.document,
    session: state.session,
    index: state.index,
    apps,
    policy,
    geometry: geometry ?? null,
    ids: planIds,
    links,
  });

  const planned = (input: WorkbenchCommand | readonly WorkbenchCommand[], geometry: GeometrySnapshot | undefined) => {
    const commands = Array.isArray(input) ? (input as readonly WorkbenchCommand[]) : [input as WorkbenchCommand];
    const fork = pool.fork();
    return { commands, result: plan(worldOf(geometry, fork.ids), commands), commitIds: fork.commit };
  };

  /** Nothing to install: the batch reproduces the current document and the session is unchanged (§6.8, no revision or outbox churn). */
  const isNoOp = (next: WorkbenchDocument, session: WorkbenchSession | undefined) =>
    (session === undefined || (session.workspaceId === state.session.workspaceId && session.activePlacementId === state.session.activePlacementId)) && equals(WorkbenchDocumentSchema, next, state.document);

  const refusal = (result: Exclude<PlanResult, { kind: "prepared" }>): { ok: false; code: string; because: string; choices?: readonly Choice[]; index: number; command: WorkbenchCommand } => {
    if (result.kind === "ambiguous") {
      options.onRefused?.(result.command, "ambiguous", result.because);
      return { ok: false, code: "ambiguous", because: result.because, choices: result.choices, index: result.index, command: result.command };
    }
    options.onRefused?.(result.command, result.code, result.because);
    return { ok: false, code: result.code, because: result.because, index: result.index, command: result.command };
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
    snapshot: () => own(WorkbenchDocumentSchema, state.document),
    execute(input, executeOptions = {}) {
      if (phase !== "idle") return { ok: false, ...REENTRANT };
      phase = "preparing";
      try {
        const { commands, result, commitIds } = planned(input, executeOptions.geometry);
        if (result.kind !== "prepared") return refusal(result);
        const { transition } = result;
        if (!transition.changed) return { ok: true, changed: false, ...ids_of(transition) };
        let next = state.document;
        if (transition.mutations.length > 0) {
          const prepared = prepare(transition.mutations);
          if (!prepared.ok) {
            report(transition.mutations, prepared.diagnostics);
            options.onRefused?.(commands[0]!, prepared.code, prepared.because);
            return { ok: false, code: prepared.code, because: prepared.because, index: 0, command: commands[0]! };
          }
          next = prepared.document;
        }
        if (isNoOp(next, transition.session)) return { ok: true, changed: false, ...ids_of(transition) };
        commitIds();
        install({ document: next, session: transition.session, ...(transition.mutations.length > 0 ? { mutations: transition.mutations } : {}), effects: transition.effects });
        return { ok: true, changed: true, ...ids_of(transition) };
      } finally {
        // `install` leaves the phase idle after publishing; a refusal or an
        // unexpected exception before it must not wedge the core.
        if (phase === "preparing") phase = "idle";
      }
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
      if (phase !== "idle") return { ok: false, ...REENTRANT, diagnostics: [] };
      phase = "preparing";
      try {
        // The same gateway as a command (F3): a raw batch that deletes,
        // retargets, or clones a view gets the links maintenance a command
        // would, in the same atomic batch.
        const upkeep = links?.maintenance(state.document, mutations) ?? null;
        const batch = upkeep ? [...mutations, upkeep] : [...mutations];
        const prepared = prepare(batch);
        if (!prepared.ok) {
          report(batch, prepared.diagnostics);
          return prepared;
        }
        if (isNoOp(prepared.document, undefined)) return { ok: true, changed: false };
        install({ document: prepared.document, mutations: batch, effects: forgetEffects(batch) });
        return { ok: true, changed: true };
      } finally {
        if (phase === "preparing") phase = "idle";
      }
    },
    replaceDocument: (next, replaceOptions = {}) => replace(next, replaceOptions.session),
    validateDocument(document) {
      const checked = validateWorkbenchDocument(document, { apps });
      return checked.ok ? { ok: true } : { ok: false, diagnostics: checked.diagnostics };
    },
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

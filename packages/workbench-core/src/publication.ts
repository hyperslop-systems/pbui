/**
 * The safe observer primitive (design doc 04 §6.2, Phase S1).
 *
 * Every store in the core used to notify with `for (const l of listeners) l()`,
 * which stops at the first throw: one failing observer suppressed every
 * observer after it, and the exception escaped through the mutation door
 * AFTER the state had been installed — a caller saw a refusal for a change
 * that had landed. Here observer failures are DATA: every observer is
 * attempted exactly once per publication, failures are collected, and the
 * collection is reported after all attempts through one sink that itself
 * cannot break the publication.
 */

export type ObserverStage = "commit-receipt" | "core-subscriber" | "link-subscriber" | "replacement-effects";

export interface WorkbenchObserverError {
  readonly stage: ObserverStage;
  /** The core revision that was being published (the link runtime's own revision for a runtime-only write). */
  readonly revision: number;
  readonly error: unknown;
}

export type ObserverErrorSink = (finding: WorkbenchObserverError) => void;

/** Call every observer once; a throw is recorded, never propagated. */
export function attemptAll<T>(observers: Iterable<T>, call: (observer: T) => void, stage: ObserverStage, revision: number, failures: WorkbenchObserverError[]): void {
  // A snapshot: an observer that unsubscribes another (or itself) during
  // publication must not change who is attempted this round.
  for (const observer of [...observers]) {
    try {
      call(observer);
    } catch (error) {
      failures.push({ stage, revision, error });
    }
  }
}

/** Hand the collected failures to the sink, one at a time; a throwing sink is logged and the rest are still delivered. */
export function reportFailures(failures: readonly WorkbenchObserverError[], sink: ObserverErrorSink | undefined): void {
  for (const finding of failures) {
    try {
      if (sink) sink(finding);
      else console.error(`workbench-core: ${finding.stage} observer failed at revision ${finding.revision}`, finding.error);
    } catch (reportingError) {
      console.error("workbench-core: observer error handler failed", reportingError);
    }
  }
}

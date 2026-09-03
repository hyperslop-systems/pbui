import { useCallback, useSyncExternalStore } from "react";
import { badgeOf, badgesOfView, evaluatePort, portId, type Badge, type Evaluation, type LinkSnapshot, type SerializableReference } from "@hyperslop-systems/pbui";
import type { LinkRuntimeState } from "@hyperslop-systems/workbench-core";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useWorkbench } from "../context";
import type { WorkbenchShell } from "../types";

/**
 * How an application reads and writes its ports (design §6.7). Applications
 * stay ignorant of terms: a detail tile asks for its `order` input's value
 * and re-renders when it changes; a table emits into its `order` output on
 * click, and as attended on hover. Where a product already owns the value
 * in its own store, its verb router may call `workbench.links.runtime.emit`
 * instead — the hook is a convenience, not the only door.
 */

/** The current link facts, re-read when the document or the runtime changes. */
export function useLinkSnapshot(workbench: WorkbenchShell): LinkSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => {
      const a = workbench.core.subscribe(listener);
      const b = workbench.links.runtime.subscribe(listener);
      return () => {
        a();
        b();
      };
    },
    [workbench],
  );
  return useSyncExternalStore(subscribe, workbench.linkSnapshot, workbench.linkSnapshot);
}

/** The runtime's values, for a product that reads them directly. */
export function useLinkRuntime(workbench: WorkbenchShell): LinkRuntimeState {
  return useSyncExternalStore(workbench.links.runtime.subscribe, workbench.links.runtime.getState, workbench.links.runtime.getState);
}

export interface PortReading<T> {
  /** The value's payload, or null when the port is empty or unresolved. */
  value: T | null;
  reference: SerializableReference | null;
  evaluation: Evaluation;
  badge: Badge;
}

/** The effective value of an INPUT port of this view. */
export function usePort<T = unknown>(view: AppView, name: string): PortReading<T> {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const id = portId(view.id, name);
  const definition = snapshot.ports.get(id);
  const evaluation = evaluatePort(id, snapshot, workbench.links.deps);
  const badge = definition
    ? badgeOf(definition, snapshot, workbench.links.deps)
    : { port: id, name, state: "unresolved" as const, glyph: "⚠", text: name, explanation: `${name} is not a declared port of this application`, binding: evaluation.provenance, evaluation };
  const reference = evaluation.kind === "value" ? evaluation.reference : null;
  return { value: (reference?.value as T | undefined) ?? null, reference, evaluation, badge };
}

export interface EmitPortOptions {
  attended?: boolean;
}

/** Emit into an OUT/INOUT port of this view; drives the contexts the declaration names. */
export function useEmitPort(view: AppView, name: string): (reference: SerializableReference, options?: EmitPortOptions) => void {
  const workbench = useWorkbench();
  return useCallback(
    (reference, options = {}) => {
      const id = portId(view.id, name);
      const declaration = workbench.core.apps.get(view.appId)?.ports?.find((port) => port.name === name);
      const drives = declaration?.drivesContext ? [declaration.drivesContext] : [];
      // A member of an identity class writes the shared cell (Phase 5).
      const classId = workbench.linkSnapshot().aliases.get(id);
      workbench.links.runtime.emit(id, reference, { ...(options.attended ? { attended: true } : {}), drives, ...(classId ? { classId } : {}) });
    },
    [workbench, view.id, view.appId, name],
  );
}

/** The badges of this view's ports, for the tile header. */
export function useBadges(view: AppView): Badge[] {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  return badgesOfView(view.id, snapshot, workbench.links.deps);
}

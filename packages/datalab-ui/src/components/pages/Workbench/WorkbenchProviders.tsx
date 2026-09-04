import { useCallback, useMemo, type ReactNode } from "react";
import { useDispatch, useStore } from "react-redux";
import "../../../apps/all";
import { useFieldsFor, useTableFor } from "../../../apps/useTable";
import { PbuiProvider, type Verb } from "../../../pbui";
import type { RootState } from "../../../store";
import { actionsForVerb, environmentFor } from "../../../store/applyVerb";

/**
 * The presentation environment for one workbench, and the verb sink beneath it.
 *
 * Split out of the shell (DATADROP-7 DR-52/DR-55) for one reason that is not
 * obvious from looking at it: **the lesson rail has to be a sibling of the
 * shell, inside this provider.** A rail step that teaches the accept protocol
 * — "press Watch…, then click a field chip in another tile" — must call
 * `accept()`, which returns a promise and lives in React context rather than in
 * the store. With the provider inside the shell, a rail rendered beside the
 * shell could not reach it, and the choice would be between duplicating the
 * accept protocol and dropping the one lesson that teaches the least familiar
 * idea in the system.
 *
 * So: `<WorkbenchProviders>{rail}<WorkbenchShell /></WorkbenchProviders>`.
 *
 * Everything here was previously inline in `Workbench`. Nothing about it
 * changed except its address.
 */
export function WorkbenchProviders({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const tableFor = useTableFor();
  // The render path's lookup (DR-40): cheap, and what descriptors use to
  // resolve a field for display.
  const fieldsFor = useFieldsFor();

  /**
   * The environment descriptors resolve against.
   *
   * Stable across world changes. Its methods read the current store only when
   * a presentation needs a label, field, table, or ambient document.
   */
  const environment = useMemo(
    () => environmentFor(() => store.getState().world, tableFor, fieldsFor),
    [store, tableFor, fieldsFor],
  );

  /**
   * Where the verbs finally land.
   *
   * This one callback is the entire seam. Descriptors emit serialisable verbs
   * and know nothing about reducers; `actionsForVerb` maps them; nothing in
   * `pbui/` had to change between the phase where verbs were merely displayed
   * and the phase where they were dispatched.
   */
  const perform = useCallback(
    (verb: Verb) => {
      const { world } = store.getState();
      // `actionsForVerb` may return a thunk, and RTK's dispatch takes thunks —
      // so the loop is the same loop. A spatial verb's thunk reaches the
      // workbench controller through the store's extra argument. The cast is
      // because `useDispatch` is untyped here; `AppDispatch` knows about thunks.
      for (const action of actionsForVerb(verb, { world }, environment)) {
        (dispatch as (action: unknown) => unknown)(action);
      }
    },
    [dispatch, environment, store],
  );

  /**
   * A menu row that fails fresh revalidation (PBUI-KERNEL-1 §14.2). Datalab
   * is frozen (C17): telemetry only, no status line — the refusal is at least
   * observable in the console rather than silent.
   */
  const refuse = useCallback((refusal: { code: string; because?: string; action?: string }) => {
    console.warn(
      `datalab: refused ${refusal.action ?? "action"} (${refusal.code})${refusal.because ? ` — ${refusal.because}` : ""}`,
    );
  }, []);

  return (
    <PbuiProvider environment={environment} onPerform={perform} onRefuse={refuse}>
      {children}
    </PbuiProvider>
  );
}

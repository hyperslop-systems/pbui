import { useEffect } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "../store";
import { save } from "../store/persist";
import { useCurrentWorkspaceId, useDatalabWorkbench } from "./DatalabWorkbenchContext";

/**
 * Write the world, the workbench document and the navigation metadata to
 * localStorage, debounced — or don't.
 *
 * Persistence is a property of the *application*, not of the shell
 * (DATADROP-7 DR-47/DR-52): an embedded instance renders the identical shell
 * and must write nothing. `key === null` means memory-only, and the early
 * return happens before the timer is created, so a memory-only instance
 * never schedules anything.
 *
 * Three subscriptions feed one timer: the world and navigation slices
 * through Redux, the workbench document and the selected workspace through
 * the core. 500 ms because a write per keystroke would be wasteful and a
 * write per session would lose work.
 */
export function usePersistence(key: string | null): void {
  const store = useStore<RootState>();
  const workbench = useDatalabWorkbench();
  const world = useSelector((state: RootState) => state.world);
  const navigation = useSelector((state: RootState) => state.navigation);
  const document = workbench.shell.useDocument();
  const workspaceId = useCurrentWorkspaceId();

  useEffect(() => {
    if (key === null) return;
    const timer = setTimeout(() => {
      // Read through the store and the core rather than closing over the
      // values: the timer fires up to 500 ms late, and it should write what
      // is true then rather than what was true when it was scheduled.
      const state = store.getState();
      const core = workbench.core.getState();
      save(
        key,
        state.world,
        { document: core.document, workspaceId: core.session.workspaceId },
        state.navigation,
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [key, world, navigation, document, workspaceId, store, workbench]);
}

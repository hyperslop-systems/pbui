import { useSyncExternalStore } from "react";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { DEFAULT_REBALANCE_CONFIG, normalizeConfig, type RebalanceConfig } from "@hyperslop-systems/workbench-core/rebalance";
import { readRebalanceConfig, rebalanceConfigMutation } from "@hyperslop-systems/workbench-core/rebalance";

/**
 * WHERE the rebalance config lives is the importing product's decision
 * (PBUI-REBALANCE-1): the settings tile and the dialog both read and write
 * through this store contract, and a product swaps the storage by passing its
 * own implementation to `createRebalanceSettingsApp({ store })` and
 * `<wb.Rebalance configStore={store}/>`.
 *
 * The default, `documentRebalanceConfigStore`, keeps the config INSIDE the
 * workbench document as the `pbui.rebalance-config` DocumentPayload — it then
 * serializes, restores, and syncs wherever the document does, with no second
 * persistence mechanism. `createLocalStorageRebalanceConfigStore` is the
 * ready-made alternative for products that want the config per-browser
 * rather than per-document.
 *
 * This is deliberately the ONE React-aware module under `rebalance/`
 * (`useConfig` is a hook, so implementations can make the dialog re-render
 * when the config changes); everything else in the directory stays pure.
 */

/** The slice of a `Workbench` the stores need — every `Workbench` satisfies it. */
export interface RebalanceConfigHost {
  useWorkbenchState<T>(selector: (state: { document: WorkbenchDocument }) => T): T;
  mutate(mutations: Mutation[]): boolean;
}

export interface RebalanceConfigStore {
  /**
   * React hook: the live config. Must re-render its caller when the config
   * changes. Callers keep the store identity STABLE across renders — the
   * hook is called unconditionally, so swapping stores mid-life violates the
   * rules of hooks.
   */
  useConfig(host: RebalanceConfigHost): RebalanceConfig;
  save(host: RebalanceConfigHost, config: RebalanceConfig): void;
}

/** The default: the config rides in the workbench document (documentPut). */
export const documentRebalanceConfigStore: RebalanceConfigStore = {
  useConfig(host) {
    const doc = host.useWorkbenchState((state) => state.document);
    return readRebalanceConfig(doc) ?? DEFAULT_REBALANCE_CONFIG;
  },
  save(host, config) {
    host.mutate([rebalanceConfigMutation(config)]);
  },
};

/**
 * A per-browser store on `localStorage`. Cross-tab changes arrive via the
 * `storage` event; a missing/corrupt/blocked storage degrades to defaults.
 */
export function createLocalStorageRebalanceConfigStore(key = "pbui.rebalance-config"): RebalanceConfigStore {
  const listeners = new Set<() => void>();
  // useSyncExternalStore needs a CACHED snapshot: a fresh object per call
  // loops the render. Cache keyed by the raw string.
  let cachedRaw: string | null | undefined;
  let cached: RebalanceConfig = DEFAULT_REBALANCE_CONFIG;
  const snapshot = (): RebalanceConfig => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cached = raw ? normalizeConfig(JSON.parse(raw)) : DEFAULT_REBALANCE_CONFIG;
      } catch {
        cached = DEFAULT_REBALANCE_CONFIG;
      }
    }
    return cached;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
  return {
    useConfig: () => useSyncExternalStore(subscribe, snapshot, snapshot),
    save(_host, config) {
      try {
        localStorage.setItem(key, JSON.stringify(config));
      } catch {
        // Storage unavailable: the in-memory listeners still see the change
        // on the next snapshot only if storage worked, so surface nothing —
        // the tile simply reads back the old value, which is honest.
      }
      for (const listener of listeners) listener();
    },
  };
}

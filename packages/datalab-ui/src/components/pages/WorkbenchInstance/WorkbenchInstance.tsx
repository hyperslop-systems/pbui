import { useRef, useState, type ReactNode } from "react";
import { AppScope } from "../../../appkit/AppScope";
import { DatalabWorkbenchProvider } from "../../../appkit/DatalabWorkbenchContext";
import { RenderBoundary } from "../../../appkit/RenderBoundary";
import { usePersistence } from "../../../appkit/usePersistence";
import { createDatalabWorkbench, type DatalabWorkbench } from "../../../appkit/workbench";
import type { FixtureData } from "../../../api/fixtures";
import type { DatalabSeed } from "../../../store/seed";
import type { WorldState } from "../../../store/world";
import { WorkbenchProviders } from "../Workbench/WorkbenchProviders";
import { WorkbenchFailure } from "../Workbench/Workbench";
import { WorkbenchShell } from "../Workbench/WorkbenchShell";
import styles from "./WorkbenchInstance.module.css";

/**
 * A whole workbench, sandboxed, embeddable, and as many as you like on a page.
 *
 * This is the unit the landing page composes: five of them down one scrolling
 * page, each with its own documents, its own tile layout and its own accept
 * plumbing, sharing nothing (DATADROP-7 DR-45). The WORKBENCH is the instance
 * boundary — one Redux store for the world and the navigation metadata, one
 * workbench core for the tiles, one shell, one controller — and nothing
 * instance-scoped lives in a module (PBUI-DATALAB-WORKBENCH-1 design §9.3).
 *
 * It renders **the same `WorkbenchShell` the product renders**. That identity
 * is the entire basis of the claim that the tutorial is executable
 * documentation. The differences between the product and a tour panel are all
 * configuration — which applications the launcher offers, whether there is a
 * masthead, where (if anywhere) to persist.
 *
 * ## Reset is remount
 *
 * There is no `reset()`. Give the instance a `key` and change it; React throws
 * the subtree away and the `useRef` null-check below builds a fresh workbench.
 */
export interface InstancePreload {
  /** Documents, snapshots, the active document. */
  world?: Partial<WorldState>;
  /** The starting layout and stage; default: one launcher tile on one stage. */
  seed?: DatalabSeed;
}

export interface InstanceConfig {
  /**
   * The starting state: documents, snapshots, workspaces, split trees.
   *
   * Read once, at construction. Changing it afterwards does nothing — change
   * the `key` instead.
   */
  preloaded?: InstancePreload;
  /** Give a world with no documents one. Default true. */
  seed?: boolean;
  /**
   * Tables answered from memory instead of from the server (DR-48). With this
   * set the instance never reaches the network.
   */
  fixtures?: FixtureData;
  /** Which applications the launcher offers (DR-53). Omit for every registered one. */
  apps?: readonly string[];
  /**
   * Where to persist, or null for memory-only. **Null by default**: an
   * embedded panel that writes to localStorage fights every other panel on
   * the page for one key.
   */
  persistKey?: string | null;
  /** The DATALAB wordmark. Off by default: the page has its own masthead. */
  masthead?: boolean;
  /** The workspace strip. Omit to defer to the seeded stage; `false` overrides it. */
  workspaces?: boolean;
  /** The stage switcher. Off by default: an embedded panel seeds one stage. */
  stageBar?: boolean;
  /** Offer a control that expands the workbench to fill the window. On by default. */
  fullFrame?: boolean;
}

export function WorkbenchInstance({
  config = {},
  children,
  className,
}: {
  config?: InstanceConfig;
  children?: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  /**
   * One workbench, built once.
   *
   * A ref with a null check rather than `useState`'s lazy initialiser:
   * StrictMode double-invokes the initialiser and would construct two
   * workbenches, discarding one after its subscriptions had already started.
   */
  const ref = useRef<DatalabWorkbench | null>(null);
  if (!ref.current) {
    ref.current = createDatalabWorkbench({
      ...(config.preloaded?.seed ? { seed: config.preloaded.seed } : {}),
      ...(config.preloaded?.world ? { world: config.preloaded.world } : {}),
      ...(config.seed !== undefined ? { seedDocuments: config.seed } : {}),
      ...(config.fixtures ? { fixtures: config.fixtures } : {}),
    });
  }

  return (
    <DatalabWorkbenchProvider workbench={ref.current}>
      <RenderBoundary
        resetKey={config.persistKey ?? "embedded"}
        fallback={(error, reset) => <WorkbenchFailure error={error} reset={reset} />}
      >
        <AppScope apps={config.apps}>
          {/*
            `children` sit OUTSIDE the framed box and INSIDE the providers
            (DR-55): a lesson rail has to reach `accept()`, and a rail sharing
            the workbench's border would read as part of the application.
          */}
          <div
            className={[styles.root, expanded ? styles.expanded : "", className ?? ""]
              .filter(Boolean)
              .join(" ")}
          >
            <WorkbenchProviders>
              {children}
              <div className={styles.instance}>
                <WorkbenchShell
                  masthead={config.masthead ?? false}
                  workspaces={config.workspaces}
                  // An embedded panel seeds one stage, so a switcher would have
                  // one entry; the page's own prose says which section this is.
                  stageBar={config.stageBar ?? false}
                  fullFrame={expanded}
                  onToggleFullFrame={
                    config.fullFrame === false ? undefined : () => setExpanded((on) => !on)
                  }
                />
              </div>
            </WorkbenchProviders>
          </div>
          <InstancePersistence persistKey={config.persistKey ?? null} />
        </AppScope>
      </RenderBoundary>
    </DatalabWorkbenchProvider>
  );
}

/**
 * `usePersistence` needs the workbench above it. A one-line component is the
 * cheapest way to be inside the provider; with a null key it never schedules
 * a timer at all.
 */
function InstancePersistence({ persistKey }: { persistKey: string | null }) {
  usePersistence(persistKey);
  return null;
}

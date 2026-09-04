import { StrictMode, useRef } from "react";

import { AnalysisProvider } from "./appkit/AnalysisProvider";
import { DatalabWorkbenchProvider } from "./appkit/DatalabWorkbenchContext";
import { createDatalabWorkbench, type DatalabWorkbench } from "./appkit/workbench";
import { datalabManifests } from "./appkit/workbenchApps";
import { DeviceApprovalPage } from "./components/pages/DeviceApprovalPage";
import { MarketingPage } from "./components/pages/MarketingPage";
import { Workbench } from "./components/pages/Workbench";
import { routeFor } from "./routes";
import { load, WORKBENCH_KEY } from "./store/persist";

export interface DatalabAppProps {
  /**
   * Browser pathname to render. Defaults to the current location in a browser
   * and to `/` during server-side or test rendering.
   */
  pathname?: string;
  /**
   * Keep StrictMode enabled by default for the standalone product. Embedders
   * that already own a StrictMode boundary can turn this off.
   */
  strict?: boolean;
  /**
   * Open one server-backed PBUI workbench. When omitted, the standalone app
   * also accepts `?workbench=<id>`; null explicitly selects local persistence.
   */
  workbenchId?: string | null;
}

/**
 * The complete Datalab product surface without a mounting side effect.
 *
 * Importing the package constructs no store, reads no storage, and touches no
 * DOM. The product store is created lazily only when the selected route is the
 * workbench; marketing and tour routes remain six independent fixture-backed
 * instances.
 */
export function DatalabApp({ pathname, strict = true, workbenchId }: DatalabAppProps) {
  const resolvedPathname =
    pathname ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  const route = routeFor(resolvedPathname);

  const body =
    route.kind === "device" ? (
      <DeviceApprovalPage />
    ) : route.kind === "marketing" || route.kind === "tour" ? (
      <AnalysisProvider principalKey="embedded-fixtures">
        <MarketingPage />
      </AnalysisProvider>
    ) : (
      <Product workbenchId={resolvedWorkbenchId(workbenchId)} />
    );

  return strict ? <StrictMode>{body}</StrictMode> : body;
}

/**
 * The standalone workbench is constructed inside the selected product route,
 * from the FINAL accepted state (design §13.2): the stored layout is read,
 * merged with this build's pinned stages and validated before anything is
 * built, so there is no default rendered and then replaced. Visiting a
 * marketing, tour, or device route cannot restore or mutate workbench
 * persistence as a package-import side effect.
 */
function Product({ workbenchId }: { workbenchId: string | null }) {
  const ref = useRef<DatalabWorkbench | null>(null);
  if (!ref.current) {
    const restored = workbenchId ? null : load(WORKBENCH_KEY, datalabManifests());
    ref.current = createDatalabWorkbench(
      restored ? { world: restored.world, seed: restored.seed } : {},
    );
  }

  return (
    <DatalabWorkbenchProvider workbench={ref.current}>
      <Workbench
        persistence={
          workbenchId ? { kind: "remote", workbenchId } : { kind: "local", key: WORKBENCH_KEY }
        }
      />
    </DatalabWorkbenchProvider>
  );
}

function resolvedWorkbenchId(explicit: string | null | undefined): string | null {
  if (explicit !== undefined) return explicit;
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("workbench")?.trim();
  return value || null;
}

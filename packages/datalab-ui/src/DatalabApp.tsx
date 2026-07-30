import { StrictMode, useRef } from "react";
import { Provider } from "react-redux";

import { AnalysisProvider } from "./appkit/AnalysisProvider";
import { DeviceApprovalPage } from "./components/pages/DeviceApprovalPage";
import { MarketingPage } from "./components/pages/MarketingPage";
import { Workbench } from "./components/pages/Workbench";
import { routeFor } from "./routes";
import { makeStore, type AppStore } from "./store";
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
 * The standalone workbench store is constructed inside the selected product
 * route. Visiting a marketing, tour, or device route cannot restore or mutate
 * workbench persistence as a package-import side effect.
 */
function Product({ workbenchId }: { workbenchId: string | null }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    const restored = workbenchId ? null : load(WORKBENCH_KEY);
    storeRef.current = makeStore({
      preloaded: restored ? { world: restored.world, layout: restored.layout } : undefined,
    });
  }

  return (
    <Provider store={storeRef.current}>
      <Workbench
        persistence={
          workbenchId ? { kind: "remote", workbenchId } : { kind: "local", key: WORKBENCH_KEY }
        }
      />
    </Provider>
  );
}

function resolvedWorkbenchId(explicit: string | null | undefined): string | null {
  if (explicit !== undefined) return explicit;
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("workbench")?.trim();
  return value || null;
}

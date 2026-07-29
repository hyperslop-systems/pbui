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
}

/**
 * The complete Datalab product surface without a mounting side effect.
 *
 * Importing the package constructs no store, reads no storage, and touches no
 * DOM. The product store is created lazily only when the selected route is the
 * workbench; marketing and tour routes remain six independent fixture-backed
 * instances.
 */
export function DatalabApp({ pathname, strict = true }: DatalabAppProps) {
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
      <Product />
    );

  return strict ? <StrictMode>{body}</StrictMode> : body;
}

/**
 * The standalone workbench store is constructed inside the selected product
 * route. Visiting a marketing, tour, or device route cannot restore or mutate
 * workbench persistence as a package-import side effect.
 */
function Product() {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    const restored = load(WORKBENCH_KEY);
    storeRef.current = makeStore({
      preloaded: restored ? { world: restored.world, layout: restored.layout } : undefined,
    });
  }

  return (
    <Provider store={storeRef.current}>
      <Workbench persistKey={WORKBENCH_KEY} />
    </Provider>
  );
}

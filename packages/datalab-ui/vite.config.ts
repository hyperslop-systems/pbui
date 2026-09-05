import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const external = [
  "@duckdb/duckdb-wasm",
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react-redux",
  "@reduxjs/toolkit",
  "@reduxjs/toolkit/query/react",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/pbui/presentation",
  "@hyperslop-systems/pbui/link-kernel",
  "@hyperslop-systems/pbui-workbench",
  "@hyperslop-systems/workbench-core",
  "@hyperslop-systems/workbench-core/persistence",
  "@hyperslop-systems/workbench-protocol",
  "@hyperslop-systems/workbench-protocol/client",
  "@hyperslop-systems/plot",
  "@hyperslop-systems/plot/react",
];

// Stylesheets that must land INSIDE `dist/datalab.css` rather than staying an
// import a consumer would have to resolve. Everything under
// `@hyperslop-systems/pbui/` is externalized by default, so a new stylesheet
// import in `src/styles.ts` is silently dropped from the published bundle
// unless it is listed here — which is how the presentation parts went missing
// once already (PBUI-UNIFY-001). `scripts/consumer-smoke.mjs` asserts the
// `[data-part=presentation]` marker survives packing; keep it in the list.
const bundledPbuiStyles = new Set([
  "@hyperslop-systems/pbui/styles.css",
  "@hyperslop-systems/pbui/components.css",
  "@hyperslop-systems/pbui/presentation-parts.css",
  "@hyperslop-systems/pbui/chrome.css",
  "@hyperslop-systems/plot/styles.css",
]);

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        styles: "src/styles.ts",
      },
      formats: ["es"],
      cssFileName: "datalab",
    },
    copyPublicDir: false,
    rollupOptions: {
      external: (id) =>
        !bundledPbuiStyles.has(id) &&
        (external.includes(id) ||
          id.startsWith("@duckdb/duckdb-wasm/") ||
          id.startsWith("@hyperslop-systems/pbui/")),
    },
    sourcemap: true,
  },
  test: {
    environment: "node",
  },
});

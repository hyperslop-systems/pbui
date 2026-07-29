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
  "@hyperslop-systems/plot",
  "@hyperslop-systems/plot/react",
];

const bundledPbuiStyles = new Set([
  "@hyperslop-systems/pbui/styles.css",
  "@hyperslop-systems/pbui/components.css",
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

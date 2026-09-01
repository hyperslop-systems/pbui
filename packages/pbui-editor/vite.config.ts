import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

/**
 * CodeMirror is bundled INTO this package's dist rather than externalised:
 * the six @codemirror packages must resolve to one copy of @codemirror/state
 * or every extension throws "Unrecognized extension value". Bundling them
 * here guarantees the consumer never has to dedupe them, at the cost of the
 * consumer not being able to share its own CodeMirror instance — which no
 * PBUI product has.
 */
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/pbui-workbench",
];

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  build: {
    lib: {
      entry: { index: "src/index.ts" },
      formats: ["es"],
      cssFileName: "pbui-editor",
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) ||
        id.startsWith("@hyperslop-systems/pbui/") ||
        id.startsWith("@hyperslop-systems/pbui-workbench/"),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
  },
});

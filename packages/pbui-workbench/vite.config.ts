import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@bufbuild/protobuf",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/workbench-core",
  "@hyperslop-systems/workbench-protocol",
  "@hyperslop-systems/workbench-protocol/client",
];

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  build: {
    lib: {
      // A second entry, not a re-export from the root: a product with no
      // server should not pull the sync loop into its bundle, and nothing in
      // it touches React or the DOM.
      entry: { index: "src/index.ts", sync: "src/sync.ts" },
      formats: ["es"],
      cssFileName: "pbui-workbench",
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) ||
        id.startsWith("@bufbuild/protobuf/") ||
        id.startsWith("@hyperslop-systems/pbui/") ||
        id.startsWith("@hyperslop-systems/workbench-core/") ||
        id.startsWith("@hyperslop-systems/workbench-protocol/"),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
  },
});

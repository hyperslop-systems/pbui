import { defineConfig } from "vitest/config";

const external = [
  "@bufbuild/protobuf",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/workbench-protocol",
  "@hyperslop-systems/workbench-protocol/client",
];

export default defineConfig({
  build: {
    lib: {
      entry: { index: "src/index.ts", rebalance: "src/rebalance/index.ts", persistence: "src/persistence/index.ts", sync: "src/sync/index.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) ||
        id.startsWith("@bufbuild/protobuf/") ||
        id.startsWith("@hyperslop-systems/pbui/") ||
        id.startsWith("@hyperslop-systems/workbench-protocol/"),
    },
    sourcemap: true,
  },
  test: {
    // Node, never jsdom: the core is DOM-free by contract, and a test that
    // needed `document` would be a test of the wrong package.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

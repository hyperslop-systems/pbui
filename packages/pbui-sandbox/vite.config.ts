import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/pbui-workbench",
  "@hyperslop-systems/workbench-protocol",
  "@hyperslop-systems/workbench-protocol/client",
  "quickjs-emscripten",
];

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  build: {
    lib: {
      entry: { index: "src/index.ts", quickjs: "src/quickjs.ts" },
      formats: ["es"],
      cssFileName: "pbui-sandbox",
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) ||
        id.startsWith("@hyperslop-systems/pbui/") ||
        id.startsWith("@hyperslop-systems/pbui-workbench/") ||
        id.startsWith("@hyperslop-systems/workbench-protocol/") ||
        id.startsWith("quickjs-emscripten") ||
        id.startsWith("@jitl/quickjs"),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
  },
});

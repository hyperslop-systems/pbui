import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@bufbuild/protobuf",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/pbui-editor",
  "@hyperslop-systems/pbui-sandbox",
  "@hyperslop-systems/pbui-workbench",
  "@hyperslop-systems/plot",
  "@hyperslop-systems/workbench-protocol",
];

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  build: {
    lib: {
      entry: { index: "src/index.ts" },
      formats: ["es"],
      cssFileName: "pbui-plotscript",
    },
    rollupOptions: {
      external: (id) => external.includes(id) || external.some((name) => id.startsWith(`${name}/`)),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
  },
});

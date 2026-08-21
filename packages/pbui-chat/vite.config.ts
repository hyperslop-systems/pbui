import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react-redux",
  "@reduxjs/toolkit",
  "zod",
  "@bufbuild/protobuf",
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/pbui/presentation",
  "@hyperslop-systems/pbui-workbench",
  "@hyperslop-systems/pbui-sandbox",
  "@hyperslop-systems/workbench-protocol",
  "@hyperslop-systems/workbench-protocol/client",
  "@go-go-golems/chat-provider",
];

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  resolve: {
    ...pbuiVite().resolve,
    /*
     * The demo product under ./demo imports this package by name, and the
     * library's own stories and tests borrow the demo product as their
     * fixture. Pointing the name at `src/index.ts` here means those
     * borrowed files resolve to the source being edited rather than to a
     * stale `dist/`. The library build itself never hits this alias: its
     * entry graph is `src/` and nothing under `src/` imports the package
     * by name.
     */
    alias: {
      "@hyperslop-systems/pbui-chat": path.resolve(import.meta.dirname, "src/index.ts"),
    },
  },
  build: {
    lib: {
      entry: { index: "src/index.ts" },
      formats: ["es"],
      cssFileName: "pbui-chat",
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) ||
        id.startsWith("@go-go-golems/chat-provider/") ||
        id.startsWith("@bufbuild/protobuf/") ||
        id.startsWith("@hyperslop-systems/pbui/") ||
        id.startsWith("@hyperslop-systems/workbench-protocol/"),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
  },
});

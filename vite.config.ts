import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      /*
       * Three entries. `index` is the library; `link-kernel` is the pure
       * semantic subset workbench-core depends on (no React in its graph —
       * see src/link-kernel.ts); `vite` is the consumer-side
       * config preset (`@hyperslop-systems/pbui/vite`), which exists so the
       * duplicate-React resolution requirement ships WITH the package rather
       * than living in each product's memory — see src/vite.ts.
       */
      entry: { index: "src/index.ts", "link-kernel": "src/link-kernel.ts", vite: "src/vite.ts" },
      formats: ["es"],
      cssFileName: "pbui",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      /*
       * Two entries. `index` is the library; `vite` is the consumer-side
       * config preset (`@hyperslop-systems/pbui/vite`), which exists so the
       * duplicate-React resolution requirement ships WITH the package rather
       * than living in each product's memory — see src/vite.ts.
       */
      entry: { index: "src/index.ts", vite: "src/vite.ts" },
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

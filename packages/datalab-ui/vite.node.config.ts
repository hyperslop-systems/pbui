import { defineConfig } from "vite";

/**
 * Build the Node-only Vite integration separately from the browser library.
 *
 * The helper intentionally imports `node:url` and resolves package-owned
 * public assets on disk. Processing it as a browser entry externalizes the
 * builtin with a compatibility warning and obscures which runtime owns the
 * API.
 */
export default defineConfig({
  build: {
    lib: {
      entry: "src/vite.ts",
      formats: ["es"],
      fileName: () => "vite.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    rollupOptions: {
      external: (id) => id.startsWith("node:"),
    },
    sourcemap: true,
  },
});

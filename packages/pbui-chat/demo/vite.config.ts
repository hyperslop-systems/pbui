import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

/*
 * The demo is served by the Go binary from /static/ (pkg/chatui embeds
 * ../../../pkg/chatui/embed). `pbuiVite()` is REQUIRED: pbui is consumed
 * through the workspace link, and without `resolve.dedupe` two Reacts load
 * and the first hook call in pbui fails with "Cannot read properties of
 * null (reading 'useState')" (playbook §3).
 */
const outDir = path.resolve(import.meta.dirname, "../../../pkg/chatui/embed");

/*
 * `emptyOutDir` wipes the tracked `.gitkeep` that lets `go build -tags embed`
 * compile before the UI exists; restore it after every build.
 */
function keepGitkeep() {
  return {
    name: "pbui-chat-keep-gitkeep",
    closeBundle() {
      fs.writeFileSync(path.join(outDir, ".gitkeep"), "");
    },
  };
}

export default defineConfig({
  ...pbuiVite(),
  plugins: [react(), keepGitkeep()],
  base: "/static/",
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_PBUI_CHAT_BACKEND_TARGET ?? "http://127.0.0.1:8090",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

/*
 * `pbuiVite()` is required: the packages are consumed through workspace
 * links, and without `resolve.dedupe` two Reacts load and the first hook
 * call in pbui fails with "Cannot read properties of null (reading
 * 'useState')".
 */
export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  server: { port: 5175 },
});

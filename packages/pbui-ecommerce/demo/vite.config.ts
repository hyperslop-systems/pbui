import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { pbuiVite } from "@hyperslop-systems/pbui/vite";

export default defineConfig({
  ...pbuiVite(),
  plugins: [react()],
  server: { port: 5176 },
});

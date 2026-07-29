import { fileURLToPath } from "node:url";

/**
 * Absolute path to Datalab's package-owned static assets.
 *
 * A Vite executable shell uses this as `publicDir`; the package remains
 * independent of the shell's output directory and `/static/` base URL.
 */
export const datalabPublicDir = fileURLToPath(
  new URL(/* @vite-ignore */ "../public", import.meta.url),
);

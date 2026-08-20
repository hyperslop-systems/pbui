import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Every `display: grid` rule in the chat and workbench packages must state
 * its column template. An implicit column track is `auto`, which sizes to the
 * widest child's max-content — a wide table widget then pushes its tile past
 * the tile boundary and the tile body scrolls horizontally (found in the
 * browser on a narrowed chat tile; ChatApp.module.css was the culprit).
 */
const roots = [resolve(__dirname, "../src"), resolve(__dirname, "../../pbui-workbench/src")];

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (name.endsWith(".module.css") || name === "styles.css") out.push(full);
  }
  return out;
}

describe("grid rules declare their columns", () => {
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of cssFiles(root)) {
      const css = readFileSync(file, "utf8");
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1].trim();
        const body = match[2];
        if (!/display:\s*(inline-)?grid\b/.test(body)) continue;
        if (/grid-template-columns|grid-template-areas|grid-template:/.test(body)) continue;
        // A rule may opt out when the template is computed at runtime (the split ratio).
        if (/grid-columns:\s*inline/.test(body)) continue;
        offenders.push(`${file}: ${selector}`);
      }
    }
  }
  it("has no implicit-column grids", () => {
    expect(offenders).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The core's fence (guide §7.1, §22): no React, no DOM, no browser globals in
 * any production module of this package. The same shape as the link kernel's
 * `no-react.test.ts`, widened to the whole tree.
 *
 * Two exemptions, listed explicitly so they cannot grow silently: the
 * `persistence/` and `sync/` subpaths are host adapters by design (they read
 * `localStorage` and schedule timers) and are allowed `globalThis.*` access
 * behind a typeof guard, but still no React.
 */
const HOST_ADAPTERS = ["persistence", "sync"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

describe("workbench-core imports no React and reads no DOM", () => {
  const root = import.meta.dirname;
  const files = walk(root);

  it("has production modules to fence", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no module imports react or react-dom", () => {
    const offenders = files.filter((file) => /from ["']react(-dom)?(\/|["'])/.test(stripComments(readFileSync(file, "utf8"))));
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it("no module outside the host adapters touches window, document, or DOM element types", () => {
    const offenders = files.filter((file) => {
      const rel = relative(root, file);
      if (HOST_ADAPTERS.some((dir) => rel.startsWith(`${dir}/`))) return false;
      const source = stripComments(readFileSync(file, "utf8"));
      // A leading `.` is a property of something else (`world.document.views`); a bare `document.` is the DOM.
      return /(^|[^.\w])(globalThis\.)?(document|window|localStorage|navigator)\.[a-zA-Z]/.test(source) || /\bHTMLElement\b|\bElement\b|\bDOMRect\b/.test(source);
    });
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it("host adapters guard their globals and still import no React", () => {
    const offenders = files.filter((file) => {
      const rel = relative(root, file);
      if (!HOST_ADAPTERS.some((dir) => rel.startsWith(`${dir}/`))) return false;
      const source = stripComments(readFileSync(file, "utf8"));
      // A bare `window.` or `document.` (not through globalThis) is a DOM assumption, not a guarded host access.
      return /(^|[^.\w])(document|window)\.[a-zA-Z]/.test(source);
    });
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it("runs without a DOM at all", () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
  });
});

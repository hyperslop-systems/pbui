/**
 * NO STYLESHEET IS ORPHANED, AND THE CASCADE ORDER IS THE DOCUMENTED ONE.
 *
 * # Why this test exists
 *
 * `src/styles.css` — 100 lines of zero-specificity fallbacks for the
 * presentation parts, with a header explaining exactly what it protects a bare
 * consumer against — was imported by nothing. Vite's library build collects
 * CSS from the module graph, so a file no module imports is simply absent from
 * `dist/pbui.css`. It never shipped, and nothing said so: not the build, not
 * the types, not a test, not a lint. The same defect one layer up produced
 * `tokens.css` in 0.3.0.
 *
 * That is the failure this file ends. A stylesheet that exists and is attached
 * to nothing is now a test failure rather than a discovery someone makes
 * eleven months later while tracing an unrelated bug.
 *
 * # It reads SOURCE, not dist
 *
 * `tokens-defined.test.ts` learned this the hard way: the publish workflow runs
 * `test` BEFORE `build`, so a test that reads `dist/` fails in CI with its own
 * "run pnpm build first" message. Both invariants here are properties of the
 * source anyway — which files are imported, and in what order — so reading
 * source is also the more direct question.
 *
 * # What is deliberately NOT tested here
 *
 * "Every `data-part` a component renders has a CSS rule." That looks like the
 * same idea and is not an invariant: 19 of the 51 parts have no attribute rule
 * because their components are styled by CSS modules, and `data-part` is a
 * stable hook for products and tests rather than a styling contract. Asserting
 * it would mean 19 false positives on day one.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function rootDeclarationBlocks(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) =>
      match[1]!
        .split(",")
        .some((selector) => /^(?::root|html|:where\((?::root|html)\))$/.test(selector.trim())),
    )
    .map((match) => match[2]!);
}

const root = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Every `import "…css"` specifier in a source file, in source order. */
function cssImportsOf(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/^import\s+"([^"]+\.css)";/gm)].map((m) => m[1]!);
}

const entry = join(root, "src", "index.ts");
const entryImports = cssImportsOf(entry);

describe("stylesheet wiring", () => {
  it("finds the entry point's CSS imports", () => {
    // A guard on the guard: if the regex stops matching, every assertion below
    // passes vacuously and the orphan check silently stops working.
    expect(entryImports.length).toBeGreaterThan(3);
  });

  it("imports every top-level stylesheet from the entry point", () => {
    // `src/*.css` and `public/*.css` are the hand-written sheets. Module CSS is
    // excluded: it is imported by its own component, which the next test covers.
    const sheets = [
      ...readdirSync(join(root, "src"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => `./${f}`),
      ...readdirSync(join(root, "public"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => `../public/${f}`),
    ];

    const orphans = sheets.filter((sheet) => !entryImports.includes(sheet));
    expect(orphans, `not imported by src/index.ts, so absent from dist/pbui.css`).toEqual([]);
  });

  it("imports every component stylesheet from its own component", () => {
    const modules = walk(join(root, "src")).filter((p) => p.endsWith(".module.css"));
    expect(modules.length).toBeGreaterThan(10);

    const orphans = modules.filter((cssPath) => {
      const dir = cssPath.slice(0, cssPath.lastIndexOf("/"));
      const name = cssPath.slice(cssPath.lastIndexOf("/") + 1);
      const siblings = readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
      return !siblings.some((f) => readFileSync(join(dir, f), "utf8").includes(name));
    });

    expect(orphans.map((p) => relative(root, p)), "no sibling imports this").toEqual([]);
  });

  it("never sets font-size on the document root", () => {
    /*
     * `font-size` on `:root`/`html` redefines what `1rem` means for the whole
     * document, and a consumer CANNOT undo it from `body` — rem always
     * resolves against the root. The typographic baseline shipped that way for
     * one commit and rescaled every rem-based layout in every consumer from a
     * 16px basis to an 11.5px one: datalab-ui's LauncherDialog went from
     * 544x352 to 391x253, a 28% shrink, measured in a browser.
     *
     * Typography inherits from `body`; layout scales from `:root`. A design
     * system may set the first and must not touch the second. This is the
     * assertion, because the mistake is one character wide.
     */
    // Comments stripped FIRST. Without it this matched the `:where(:root)` in
    // the prose above the rule it was checking, then ran forward to the next
    // `{` — which is the `body` block — and reported the very fix it exists to
    // confirm. `tokens-defined.test.ts` learned the same lesson and has the
    // same one-line defence; a CSS check that reads comments measures nothing.
    const css = [
      readFileSync(join(root, "src", "styles.css"), "utf8"),
      readFileSync(join(root, "src", "tokens.css"), "utf8"),
    ].join("\n");

    const rootBlocks = rootDeclarationBlocks(css);
    expect(rootBlocks.length, "no root selector block found — the scan is broken").toBeGreaterThan(0);
    const offenders = rootBlocks
      .filter((body) => /(^|[;\s])font-size\s*:/.test(body));

    expect(offenders, "font-size on the root element rescales every consumer's rem").toEqual([]);
  });

  it("recognizes every supported spelling of a document-root selector", () => {
    const blocks = rootDeclarationBlocks(`
      html { color: red; }
      :root, body { color: blue; }
      :where(:root) { color: green; }
      :where(html) { color: purple; }
      html body { font-size: 12px; }
    `);
    expect(blocks).toEqual([
      " color: red; ",
      " color: blue; ",
      " color: green; ",
      " color: purple; ",
    ]);
  });

  it("keeps the parts files after the component modules", () => {
    /*
     * The cascade, and the reason the order in `src/index.ts` is load-bearing:
     *
     *   tokens.css, styles.css   `:where()` — zero specificity, cannot lose
     *   the component modules    hashed classes — (0,1,0)
     *   the parts files          plain attribute selectors — ALSO (0,1,0)
     *
     * The last two tie, so ties break on order, so the parts must come last.
     * They are imported below the `export *` lines to achieve that, which
     * relies on ES imports being evaluated in source order — subtle enough
     * that it deserves an assertion rather than the comment that is already
     * there.
     */
    const parts = ["../public/components.css", "../public/presentation-parts.css", "../public/chrome.css"];
    const zeroSpecificity = ["./tokens.css", "./styles.css"];

    const source = readFileSync(entry, "utf8");
    const firstExport = source.indexOf("\nexport ");
    expect(firstExport).toBeGreaterThan(0);

    for (const sheet of zeroSpecificity) {
      expect(source.indexOf(`import "${sheet}";`), `${sheet} must precede the components`)
        .toBeLessThan(firstExport);
    }
    for (const sheet of parts) {
      expect(source.indexOf(`import "${sheet}";`), `${sheet} must follow the components`)
        .toBeGreaterThan(firstExport);
    }
  });
});

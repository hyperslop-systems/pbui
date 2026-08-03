/**
 * Every token PBUI reads must have a default.
 *
 * This is the guard for the failure that `src/tokens.css` exists to end. An
 * undefined custom property does not fall back and does not warn: it
 * invalidates the ENTIRE declaration at computed-value time, so
 * `border: var(--pbui-border-hair)` with the token missing renders as no
 * border, with a green build and a silent console.
 *
 * Before `tokens.css`, PBUI read 44 tokens and defined none. Every product
 * rediscovered that independently, and two of them shipped it: agentlogic's
 * split-divider grip never rendered because of a typo (`--pbui-ink-faint` for
 * `--pbui-faint`), and no product at all defined the nine tokens `JsonBlock`
 * and `Dialog` read.
 *
 * The check reads the SOURCE stylesheets, not the built bundle. The first
 * version read `dist/` and broke CI on its first run: the publish workflow
 * orders `test` before `build`, so `dist/` did not exist and the guard failed
 * with "run pnpm build first". Reading source is better on the merits anyway —
 * it catches a token the moment it is written rather than after a build, and it
 * works in a fresh checkout.
 *
 * The glob has to cover everything that reaches a consumer: every
 * `.module.css` under `src/`, the plain stylesheets beside them, and the three
 * hand-written files in `public/` that ship as separate exports.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

/** Every `var(--pbui-*)` read in the built CSS, ignoring inline fallbacks. */
function tokensRead(css: string): Set<string> {
  const found = new Set<string>();
  // `var(--x)` only. `var(--x, fallback)` is safe by construction, so a read
  // WITH a fallback is deliberately not flagged.
  for (const match of css.matchAll(/var\((--pbui-[a-z0-9-]+)\)/g)) {
    found.add(match[1] as string);
  }
  return found;
}

/** Every `--pbui-*:` definition in the built CSS. */
function tokensDefined(css: string): Set<string> {
  const found = new Set<string>();
  for (const match of css.matchAll(/(--pbui-[a-z0-9-]+)\s*:/g)) {
    found.add(match[1] as string);
  }
  return found;
}

/** Every stylesheet that reaches a consumer, read from source. */
function allCss(): string {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".css")) files.push(full);
    }
  };
  walk(join(ROOT, "src"));
  walk(join(ROOT, "public"));

  return files.map((file) => stripComments(readFileSync(file, "utf8"))).join("\n");
}

/**
 * Removes CSS comments before scanning.
 *
 * Not optional. `src/tokens.css` documents the agentlogic defect by quoting
 * `var(--pbui-ink-faint)` in prose, and without this the guard reported that
 * quotation as an undefined token — which it found on its first run against
 * source. A checker that reads comments is a checker that fails on its own
 * documentation.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

describe("token defaults", () => {
  const css = allCss();

  it("found stylesheets to check", () => {
    // A guard that silently reads nothing passes vacuously forever. This is
    // the assertion that stops that, and it is why the glob is asserted
    // rather than assumed.
    expect(css.length, "no CSS found under src/ or public/").toBeGreaterThan(1000);
  });

  it("defines every token it reads", () => {
    const read = tokensRead(css);
    const defined = tokensDefined(css);
    const missing = [...read].filter((token) => !defined.has(token)).sort();

    expect(
      missing,
      `these tokens are read by PBUI's own CSS and have no default in src/tokens.css.\n` +
        `An undefined custom property invalidates the whole declaration silently.\n` +
        `Add a default for each in src/tokens.css, in the same commit as the component.`,
    ).toEqual([]);
  });

  it("keeps the defaults at zero specificity", () => {
    // `:where(:root)` is (0,0,0), so a product's own `:root` block wins
    // regardless of import order — which matters because the family's
    // documented order loads the product's tokens BEFORE this stylesheet.
    // A plain `:root` here would override every product's palette.
    const tokensBlock = css.includes(":where(:root)");
    expect(
      tokensBlock,
      "src/tokens.css must wrap its defaults in :where(:root); a bare :root " +
        "would override every consumer's own tokens.",
    ).toBe(true);
  });
});

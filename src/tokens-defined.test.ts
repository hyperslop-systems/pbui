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
 * The check is deliberately run against the BUILT CSS rather than the source.
 * A token can enter the bundle from any `.module.css`, and reading the source
 * files individually would miss one the moment somebody adds a component. It
 * is the same grep the products run as `make ui-token-check`; running it here
 * too means the library fails first, which is where the fix belongs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = join(__dirname, "..", "dist");

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

function builtCss(): string {
  if (!existsSync(DIST)) return "";
  return readdirSync(DIST)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(DIST, name), "utf8"))
    .join("\n");
}

describe("token defaults", () => {
  const css = builtCss();

  it("has a built bundle to check", () => {
    // A skipped guard is a guard nobody notices has stopped running. If dist
    // is absent the message says to build rather than passing vacuously.
    expect(css.length, "dist/*.css is empty — run `pnpm build` first").toBeGreaterThan(0);
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

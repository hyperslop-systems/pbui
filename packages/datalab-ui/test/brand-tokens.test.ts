import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The DR-98 guard: the brand has no colours of its own.
 *
 * `brand.css` aliases four presentation tones — source, step, chart, doc — so
 * that the bar under the wordmark and the 4px tone edge on a chip are the same
 * four values. The whole benefit of that is destroyed the moment someone writes
 * a hex literal, because from then on there are two colour systems again and
 * nothing says which is authoritative.
 *
 * It is an easy mistake to make and an invisible one to review: a literal
 * copied from the brand sheet renders *almost* identically, so the diff looks
 * fine and the screenshot looks fine, and the drift only appears the next time
 * a tone is retuned.
 *
 * This also guards the other direction. Aliasing creates a dependency that is
 * invisible from `tokens.css`: someone deleting or renaming `--pbui-tone-step`
 * has no reason to know four marketing surfaces depend on it. A `var()` naming
 * a token that no longer exists resolves to nothing and the bar simply
 * disappears — no error, no warning, in any browser.
 */

const brand = await readFile(
  fileURLToPath(new URL("../src/styles/brand.css", import.meta.url)),
  "utf8",
);
const tokens = await readFile(
  fileURLToPath(new URL("../../../src/tokens.css", import.meta.url)),
  "utf8",
);

/** Every `--brand-*: value;` declaration, in source order. */
function declarations(css: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  const pattern = /^\s*(--brand-[a-z0-9-]+)\s*:\s*([^;]+);/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    out.push({ name: match[1] as string, value: (match[2] as string).trim() });
  }
  return out;
}

/** Strip comments, so a hex written in prose is not mistaken for a value. */
function code(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const DECLARATIONS = declarations(code(brand));

/** The four phases, and the tone each must resolve to. */
const PHASE_ALIASES: Record<string, string> = {
  "--brand-import": "--pbui-tone-source",
  "--brand-understand": "--pbui-tone-step",
  "--brand-visualize": "--pbui-tone-chart",
  "--brand-export": "--pbui-tone-doc",
};

describe("brand.css is aliases, not values (DR-98)", () => {
  test("there are declarations to check", () => {
    // A moved or renamed file would otherwise make this suite pass by checking
    // nothing at all — the failure mode every file-reading test has.
    expect(DECLARATIONS.length).toBeGreaterThan(10);
  });

  test("no declaration contains a hex colour", () => {
    const literals = DECLARATIONS.filter(({ value }) => /#[0-9a-f]{3,8}\b/i.test(value)).map(
      ({ name, value }) => `${name}: ${value}`,
    );
    expect(literals).toEqual([]);
  });

  test("no declaration contains an rgb/hsl colour either", () => {
    // The same mistake, spelled differently. Worth its own case because a
    // reviewer scanning for `#` will not see `rgb(124 174 155)`.
    const functional = DECLARATIONS.filter(({ value }) =>
      /\b(rgba?|hsla?|color|oklch|lab)\s*\(/i.test(value),
    ).map(({ name, value }) => `${name}: ${value}`);
    expect(functional).toEqual([]);
  });

  test("each phase aliases the tone it is supposed to", () => {
    for (const [brandToken, expected] of Object.entries(PHASE_ALIASES)) {
      const declaration = DECLARATIONS.find((d) => d.name === brandToken);
      expect(declaration, `${brandToken} is missing from brand.css`).toBeDefined();
      expect(declaration?.value).toBe(`var(${expected})`);
    }
  });

  test("every referenced --pbui-* token exists in tokens.css", () => {
    const missing: string[] = [];
    for (const { name, value } of DECLARATIONS) {
      for (const [, referenced] of value.matchAll(/var\(\s*(--pbui-[a-z0-9-]+)/gi)) {
        // Declared, not merely mentioned: a token named only inside a comment
        // in tokens.css does not resolve at runtime.
        if (!new RegExp(`^\\s*${referenced}\\s*:`, "m").test(code(tokens))) {
          missing.push(`${name} references ${referenced}, which tokens.css does not declare`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("the four phases are declared in the brand's order", () => {
    // The order IS the brand — it is a process, not a palette — and a file
    // whose declarations disagree with `PHASES` in phases.ts is a file someone
    // will eventually read as authoritative.
    const order = DECLARATIONS.filter((d) => d.name in PHASE_ALIASES).map((d) => d.name);
    expect(order).toEqual([
      "--brand-import",
      "--brand-understand",
      "--brand-visualize",
      "--brand-export",
    ]);
  });
});

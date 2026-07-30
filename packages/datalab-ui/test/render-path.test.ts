import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The render path stays off the rows.
 *
 * `FieldChip` calls `resolveField` during render, and a table header draws one
 * chip per column of pipeline output — thirteen for the `readings` fixture,
 * unbounded in general. Before DATADROP-6 phase 1 that resolution went through
 * `tableFor`, which evaluates the whole pipeline, so every field chip on screen
 * evaluated it again on every frame.
 *
 * This is enforced structurally: anything under `components/` that reaches for
 * `tableFor` fails the test. A wall-clock microbenchmark used to accompany this
 * guard, but elapsed-time thresholds measure scheduler and garbage-collection
 * noise in the parallel suite. The import-level invariant is both deterministic
 * and closer to the actual architectural requirement.
 */

const SRC = resolve(import.meta.dirname, "../src");

/* ------------------------------------------------------- the hard guard -- */

/**
 * Where `tableFor` is legitimate under `components/`, and why.
 *
 * One entry, and it is the place the lookup is *supposed* to enter: the shell
 * builds the environment and hands both resolvers to `environmentFor`. Every
 * other component receives an already-built environment and must reach for
 * `fieldsFor`.
 */
const ALLOWED: Array<{ prefix: string; because: string }> = [
  {
    prefix: "components/pages/Workbench/WorkbenchProviders.tsx",
    because:
      "builds the PbuiEnvironment and hands both resolvers to environmentFor — " +
      "this is where the table lookup is supposed to enter the component tree",
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    // Stories are exempt for the reason layers.test.ts states: a story is a
    // review surface, not shipped code, and it composes whatever demonstrates
    // the component.
    else if (/\.tsx?$/.test(path) && !path.endsWith(".stories.tsx")) out.push(path);
  }
  return out;
}

describe("nothing under components/ evaluates the pipeline", () => {
  test("tableFor is not referenced outside the allow-list", () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(join(SRC, "components"))) {
      const rel = relative(SRC, path);
      if (ALLOWED.some((entry) => rel.startsWith(entry.prefix))) continue;

      const text = readFileSync(path, "utf8");
      text.split("\n").forEach((line, index) => {
        // Skip comments: the rule is about calls, and several docstrings name
        // the function precisely to explain why they must not call it.
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        if (/\btableFor\b/.test(code)) offenders.push(`${rel}:${index + 1}  ${line.trim()}`);
      });
    }

    expect(
      offenders,
      `these reach for tableFor, which evaluates the whole pipeline.\n` +
        `Use fieldsFor — it is O(steps) and safe in a render body (DR-40).\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("field chips keep semantic type and omit provenance chrome", () => {
  test("FieldChip renders TypeBadge but not ProvenanceBadge", () => {
    const source = readFileSync(join(SRC, "components/atoms/FieldChip/FieldChip.tsx"), "utf8");
    expect(source).toContain("<TypeBadge");
    expect(source).not.toContain("ProvenanceBadge");
    // Provenance remains available through the mouse-documentation contract.
    expect(source).toContain("field.inferred_from");
  });
});

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * One folder per component (pbui playbook §6a): `Name/Name.tsx` with an
 * `index.ts` and a story beside it. Component files that live loose in a
 * directory fail here.
 */
const SRC = resolve(import.meta.dirname, "../src");

/** Files that are not components: factories, contexts, fixtures. */
const NOT_COMPONENTS = new Set(["createWorkbench.tsx", "context.tsx", "stories/demoApps.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const TSX = walk(SRC).filter((f) => f.endsWith(".tsx") && !/\.(stories|test)\.tsx$/.test(f));

describe("one folder per component", () => {
  test("every component lives in a folder of its own name with an index.ts and a story", () => {
    const violations: string[] = [];
    for (const file of TSX) {
      const rel = relative(SRC, file);
      if (NOT_COMPONENTS.has(rel)) continue;
      const name = basename(file, ".tsx");
      if (basename(join(file, "..")) !== name) {
        violations.push(`${rel}: expected to live in a folder named ${name}/`);
        continue;
      }
      if (!existsSync(join(file, "..", "index.ts"))) violations.push(`${rel}: missing index.ts`);
      if (!existsSync(join(file, "..", `${name}.stories.tsx`))) violations.push(`${rel}: missing ${name}.stories.tsx`);
    }
    expect(violations).toEqual([]);
  });
});

import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Story coverage, enforced.
 *
 * `.storybook/main.ts` opens with the claim that "a component without a story
 * is a component nobody has ever seen". That was true of 22 components out of
 * 24 until DATADROP-6, which is what a written-down convention does when
 * nothing checks it — the same argument `layers.test.ts` makes about the layer
 * graph, and the same remedy (DR-35).
 *
 * The return is specific rather than aesthetic. DATADROP-5 shipped three UI
 * defects found only by opening a browser and clicking: identity-provider prose
 * rendered in token mode, an empty "Signed in on" heading for the root
 * principal, and a tooltip reading "you are a admin". Each is a *state* of a
 * component, each needs a particular server configuration to reach by clicking,
 * and each is two lines of props in a story.
 */

const SRC = resolve(import.meta.dirname, "../src");
const COMPONENTS = join(SRC, "components");

/** The Storybook title prefix each layer's stories must use. */
const PREFIX: Record<string, string> = {
  foundation: "Design System/Foundation/",
  // DATADROP-14. Its own group rather than a folder under Foundation: the
  // identity is not part of the workbench's visual language, it is the frame
  // around it, and the sidebar is the architecture (see the group test below).
  brand: "Design System/Brand/",
  layout: "Design System/Layout/",
  atoms: "Design System/Atoms/",
  molecules: "Component Library/Molecules/",
  organisms: "Component Library/Organisms/",
  pages: "Applications/",
};

/** Component directories, as [layer, name, absolute path]. */
function componentDirs(): Array<[string, string, string]> {
  const out: Array<[string, string, string]> = [];
  for (const layer of readdirSync(COMPONENTS)) {
    const layerDir = join(COMPONENTS, layer);
    if (!statSync(layerDir).isDirectory()) continue;
    for (const name of readdirSync(layerDir)) {
      const dir = join(layerDir, name);
      if (statSync(dir).isDirectory()) out.push([layer, name, dir]);
    }
  }
  return out;
}

function storyFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".stories.tsx")) out.push(path);
    }
  };
  walk(SRC);
  return out;
}

/**
 * The `title` from a story file's meta, by regex rather than by importing.
 *
 * Importing a story file pulls in React, the CSS modules and the whole
 * component tree beneath it, which turns a 200 ms test into a bundling
 * exercise. The title is a literal string in every file we write, and
 * GUIDELINES.md requires it to stay one — which is exactly the kind of
 * constraint a test may rely on as long as it says so.
 */
function titleOf(source: string): string | null {
  return /title:\s*["'`]([^"'`]+)["'`]/.exec(source)?.[1] ?? null;
}

const DIRS = componentDirs();

describe("story coverage", () => {
  test("there are components to check", () => {
    // A refactor that moves components/ elsewhere would otherwise make this
    // whole suite pass by checking nothing.
    expect(DIRS.length).toBeGreaterThan(20);
  });

  test("every stateful component directory has a story or a reasoned exemption", () => {
    const missing = DIRS.filter(([, name, dir]) => {
      if (fileExists(join(dir, `${name}.stories.tsx`))) return false;
      const component = join(dir, `${name}.tsx`);
      if (!fileExists(component)) return true;
      return !/@story-exempt:\s*\S.{8,}/.test(readFileSync(component, "utf8"));
    })
      .map(([layer, name]) => `${layer}/${name}`)
      .sort();
    expect(missing).toEqual([]);
  });

  test("every component directory has a component and a barrel", () => {
    // The CSS module is deliberately NOT required: several atoms are pure
    // composition over other atoms and correctly own no styles of their own.
    const broken: string[] = [];
    for (const [layer, name, dir] of DIRS) {
      if (!fileExists(join(dir, `${name}.tsx`))) broken.push(`${layer}/${name}: no ${name}.tsx`);
      if (!fileExists(join(dir, "index.ts"))) broken.push(`${layer}/${name}: no index.ts`);
    }
    expect(broken).toEqual([]);
  });

  test("no empty component directories", () => {
    // organisms/StatusBar was one: an empty directory left behind by a rename,
    // which the coverage check above would otherwise report as a component
    // missing its story rather than as a directory that should not exist.
    const empty = DIRS.filter(([, , dir]) => readdirSync(dir).length === 0).map(
      ([layer, name]) => `${layer}/${name}`,
    );
    expect(empty).toEqual([]);
  });

  test("every story title uses its layer's prefix", () => {
    const wrong: string[] = [];
    for (const file of storyFiles()) {
      const rel = relative(SRC, file);
      const parts = rel.split("/");
      if (parts[0] !== "components") continue; // pbui/ owns its own hierarchy
      const layer = parts[1] as string;
      const prefix = PREFIX[layer];
      if (!prefix) continue;

      const title = titleOf(readFileSync(file, "utf8"));
      if (title === null) wrong.push(`${rel}: no title in the meta literal`);
      else if (!title.startsWith(prefix)) wrong.push(`${rel}: "${title}" should start "${prefix}"`);
    }
    expect(wrong).toEqual([]);
  });

  test("the sidebar reads as the dependency order", () => {
    // Not decoration: the hierarchy in .storybook/main.ts mirrors the layer
    // decomposition, so a reviewer scanning the sidebar is scanning the
    // architecture. A title in the wrong group breaks that quietly.
    const titles = storyFiles()
      .map((file) => titleOf(readFileSync(file, "utf8")))
      .filter((title): title is string => title !== null);

    const groups = new Set(titles.map((title) => title.split("/").slice(0, 2).join("/")));
    for (const group of groups) {
      expect([
        "Design System/Foundation",
        "Design System/Brand",
        "Design System/Layout",
        "Design System/Atoms",
        "Design System/PBUI",
        "Component Library/Molecules",
        "Component Library/Organisms",
        "Applications/Workbench",
        // DATADROP-7: sandboxed instances, and the two-instance story that is
        // phase 2's acceptance test. A group of its own rather than a story
        // under Workbench, because what it demonstrates is not the product's
        // shell but the property that there can be more than one of it.
        "Applications/Embedding",
        // DATADROP-7 phase 7: the tour section and the band.
        "Applications/Tour",
        // DATADROP-14: the front door, which contains the tour band.
        "Applications/Marketing",
        // DATALAB-UI-AUDIT-1: every registered application, rendered from the
        // registry. Under Applications rather than Component Library because a
        // tile is not a component — it is a container over one, and what its
        // story shows is the wiring above the panel.
        "Applications/Tiles",
      ]).toContain(group);
    }
  });
});

/**
 * Every registered application has a story of its own.
 *
 * The organisms were storied and the *containers above them* were not, which is
 * the half where the hooks, the derivations, the signed-out branch and the "no
 * document" branch live. `apps/tiles.stories.tsx` closes that, and this is what
 * stops it reopening: a twenty-eighth application whose author never opened
 * Storybook fails here rather than shipping unseen.
 *
 * Parsed rather than imported, for the reason `apps.test.ts` gives — importing
 * `apps/all` pulls in React, every component beneath it and their CSS modules.
 * `registerApp({ id: "…" })` and `renderTile("…")` are literals in every file we
 * write, and saying so is what makes relying on them fair.
 */
describe("tile story coverage", () => {
  const TILE_STORIES = join(SRC, "apps", "tiles.stories.tsx");

  function registeredIds(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(path) && !path.endsWith(".stories.tsx")) {
          const pattern = /registerApp\(\{([\s\S]*?)\n\}\);/g;
          const source = readFileSync(path, "utf8");
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(source)) !== null) {
            const id = /\bid:\s*["']([^"']+)["']/.exec(match[1] as string)?.[1];
            if (id) found.push(id);
          }
        }
      }
    };
    walk(join(SRC, "apps"));
    return found.sort();
  }

  const IDS = registeredIds();

  test("there are applications to check", () => {
    expect(IDS.length).toBeGreaterThan(20);
  });

  test("apps/tiles.stories.tsx exists", () => {
    // Without it the coverage check below would pass by reading nothing.
    expect(fileExists(TILE_STORIES)).toBe(true);
  });

  test("every registered application is rendered by a story of its own", () => {
    const source = readFileSync(TILE_STORIES, "utf8");
    // The contact sheet renders every application from `allApps()`, so a new one
    // is never invisible — but a frame in a grid of twenty-eight is not the same
    // as a story with a name and a sentence saying what state it shows.
    const missing = IDS.filter((id) => !source.includes(`renderTile("${id}"`));
    expect(missing).toEqual([]);
  });
});

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import * as storeModule from "../src/store";
import { makeStore } from "../src/store";
import { save, load, clear, WORKBENCH_KEY } from "../src/store/persist";
import { createDatalabRuntime, type DatalabRuntime } from "../src/store/runtime";
import { defaultSeed } from "../src/store/seed";
import { worldActions } from "../src/store/world";

/**
 * Instance isolation (DATADROP-7).
 *
 * The landing page embeds five workbenches in one scrolling page, each with its
 * own documents, its own layout and its own accept plumbing. Everything in this
 * file is a property that has to hold for that to be possible, and every one of
 * them was *false* before this ticket — not visibly, because there was only
 * ever one workbench, but structurally.
 *
 * The tests are cheap and the failures they prevent are not. The persistence
 * one in particular guards a defect that produces no error and no warning: the
 * reader's real workbench layout, silently overwritten by whichever tutorial
 * section they last scrolled past.
 */

const SRC = resolve(import.meta.dirname, "../src");
const apps = datalabManifests();

/**
 * A whole workbench over the product's default seed. Ids are minted, not
 * sequential: the property under test is that two INDEPENDENT instances never
 * agree on an id, which a deterministic generator would falsify by design.
 */
const runtime = (): DatalabRuntime =>
  createDatalabRuntime({ seed: defaultSeed({ apps }), apps, ownership: "trust" });

/* -------------------------------------------- one analytics page runtime -- */

describe("embedded workbenches share one analytics runtime", () => {
  test("the tour owns AnalysisProvider above every embedded store", () => {
    const app = readFileSync(resolve(SRC, "DatalabApp.tsx"), "utf8");
    const instance = readFileSync(
      resolve(SRC, "components/pages/WorkbenchInstance/WorkbenchInstance.tsx"),
      "utf8",
    );
    // DATADROP-14 renamed LandingPage -> TutorialBand and put the marketing
    // page above it; both stories must still own the provider, because the
    // property being guarded is about the PROVIDER's position rather than about
    // any one page.
    const tourStory = readFileSync(
      resolve(SRC, "components/pages/TutorialBand/TutorialBand.stories.tsx"),
      "utf8",
    );
    const marketingStory = readFileSync(
      resolve(SRC, "components/pages/MarketingPage/MarketingPage.stories.tsx"),
      "utf8",
    );
    expect(app).toContain('<AnalysisProvider principalKey="embedded-fixtures">');
    expect(tourStory).toContain('<AnalysisProvider principalKey="storybook-tour-fixtures">');
    expect(marketingStory).toContain(
      '<AnalysisProvider principalKey="storybook-marketing-fixtures">',
    );
    expect(instance).not.toContain("AnalysisProvider");
  });
});

/* ------------------------------------------------------ no ambient store -- */

describe("there is no ambient store", () => {
  test("the store module exports no constructed instance", () => {
    // DR-46. `makeStore` is a factory, and the module used to export a store it
    // had already built beside it — restoring from localStorage as a side
    // effect of being *imported*. Exactly one file used it, which is why the
    // defect was invisible; the problem is that the next person to write
    // `import { store }` would have got a working import and five instances
    // sharing one world.
    //
    // Checked by shape rather than by name so that `export const workbench =
    // makeStore()` fails too.
    const exported = Object.entries(storeModule as Record<string, unknown>);
    const instances = exported.filter(
      ([, value]) =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as { dispatch?: unknown }).dispatch === "function" &&
        typeof (value as { getState?: unknown }).getState === "function",
    );
    expect(instances.map(([name]) => name)).toEqual([]);
  });

  test("nothing outside main.tsx imports a store value", () => {
    // The module-graph half of the same property. `import type` is fine and is
    // what sixteen files do; a runtime import is not.
    const files = walk(SRC).filter((path) => !path.endsWith("main.tsx"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const pattern = /(?:^|\n)\s*import\s+(?!type\b)([^;]*?)\s+from\s+["'][./]*store["']/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const clause = match[1] as string;
        // `import { makeStore }` and `import type { RootState }` are both fine.
        // `import { store }` is not, and neither is a default import.
        if (/\bstore\b/.test(clause.replace(/\bmakeStore\b/g, ""))) {
          offenders.push(`${file}: import ${clause}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/* ------------------------------------------------------- two live stores -- */

describe("two stores share nothing", () => {
  test("a document added to one does not appear in the other", () => {
    const a = makeStore();
    const b = makeStore();

    // Both are seeded with one document (DR-46 moved the seed into the
    // factory), so the starting point is symmetric.
    expect(a.getState().world.docOrder).toHaveLength(1);
    expect(b.getState().world.docOrder).toHaveLength(1);

    a.dispatch(worldActions.newDoc(null));

    expect(a.getState().world.docOrder).toHaveLength(2);
    expect(b.getState().world.docOrder).toHaveLength(1);
  });

  test("document ids do not collide across stores", () => {
    // The prototype uses module-global counters (pbui-landing.jsx:278), which
    // are unique only by accident of being global. We use UUIDs (DR-12), and
    // this is the property that buys.
    const a = makeStore();
    const b = makeStore();
    expect(a.getState().world.docOrder[0]).not.toBe(b.getState().world.docOrder[0]);
  });

  test("a workspace created in one leaves the other's document alone", () => {
    const a = runtime();
    const b = runtime();

    const before = JSON.stringify(b.core.getState().document);
    const count = a.core.getState().document.workspaces.length;
    expect(a.controller.createWorkspace({ name: "extra" }).ok).toBe(true);

    expect(a.core.getState().document.workspaces).toHaveLength(count + 1);
    expect(a.core.getState().document.workspaces.map((s) => s.name)).toContain("extra");
    expect(JSON.stringify(b.core.getState().document)).toBe(before);
    expect(b.store.getState().navigation.workspace).not.toHaveProperty(
      a.core.getState().session.workspaceId,
    );
  });

  test("workspace ids do not collide across runtimes", () => {
    // Every runtime compiles its own seed, so nothing is shared through a
    // module-level initial state evaluated once at load.
    const a = runtime();
    const b = runtime();
    const aIds = new Set(a.core.getState().document.workspaces.map((s) => s.id));
    const shared = b.core.getState().document.workspaces.filter((s) => aIds.has(s.id));

    // The hardwired workspaces have fixed ids by design (DR-29) and are
    // expected to match. Everything else must be freshly generated.
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((s) => b.store.getState().navigation.workspace[s.id]?.pinned)).toBe(true);
  });

  test("a store built without seeding has no documents", () => {
    // The escape hatch matters: a story of the empty state needs it, and it is
    // the only way to reach a world with no documents now that the factory
    // seeds by default.
    const empty = makeStore({ seed: false });
    expect(empty.getState().world.docOrder).toEqual([]);
  });
});

/* --------------------------------------------------- scoped persistence -- */

/**
 * A localStorage, because the test runner has no DOM.
 *
 * Deliberately a real Map rather than a mock with assertions on it. The
 * property under test is that two keys hold two different payloads, and a spy
 * that records "setItem was called with key-a" would pass just as happily if
 * `save` wrote the same bytes to both. Storing and reading them back is the
 * only version of this test that can fail for the right reason.
 */
const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

/** `save` for a whole runtime: its world, the core's document and session, its navigation. */
const persist = (key: string, rt: DatalabRuntime) => {
  const core = rt.core.getState();
  save(
    key,
    rt.store.getState().world,
    { document: core.document, workspaceId: core.session.workspaceId },
    rt.store.getState().navigation,
  );
};

describe("persistence is scoped to a key", () => {
  test("two keys do not overwrite each other", () => {
    // DR-47's whole point in one test. Before this ticket `save` wrote to a
    // module constant, so the second call would have destroyed the first.
    const a = runtime();
    const b = runtime();
    a.store.dispatch(worldActions.newDoc(null));

    persist("key-a", a);
    persist("key-b", b);

    expect(load("key-a", apps)?.world.docOrder).toHaveLength(2);
    expect(load("key-b", apps)?.world.docOrder).toHaveLength(1);

    clear("key-a");
    clear("key-b");
  });

  test("the application key is a constant nobody has to spell", () => {
    // A typo'd key is a silently empty restore, which looks exactly like a
    // first run. Exporting the constant is what stops it.
    expect(WORKBENCH_KEY).toBe("datadrop-workbench");
  });

  test("clearing one key leaves the other", () => {
    const rt = runtime();
    persist("key-a", rt);
    persist("key-b", rt);

    clear("key-a");

    expect(load("key-a", apps)).toBeNull();
    expect(load("key-b", apps)).not.toBeNull();
    clear("key-b");
  });
});

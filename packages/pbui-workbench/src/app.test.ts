import { describe, expect, it } from "vitest";
import { documentSlotPort } from "@hyperslop-systems/pbui";
import { createPresentationRegistry, defineWorkbenchApp, isAppAvailable, manifestsOf } from "./app";

const Tile = () => null;

describe("defineWorkbenchApp", () => {
  it("splits one declaration into a manifest and a presentation that share the id", () => {
    const app = defineWorkbenchApp({
      manifest: { id: "sku", ports: [documentSlotPort("product")] },
      presentation: { title: "SKU", tone: "var(--pbui-cat-1)", group: "shop", Component: Tile },
    });
    expect(app.manifest).toMatchObject({ id: "sku", viewCardinality: "many", duplicatePlacement: "clone" });
    expect(app.manifest.ports?.[0]?.documentSlot).toBe(true);
    expect(app.presentation).toMatchObject({ id: "sku", title: "SKU", group: "shop" });
    expect("ports" in app.presentation).toBe(false);
  });

  it("refuses a contradictory manifest and a presentation with no title or component", () => {
    expect(() => defineWorkbenchApp({ manifest: { id: "x", viewCardinality: "one", duplicatePlacement: "clone" }, presentation: { title: "x", tone: "t", Component: Tile } })).toThrow(/cannot be cloned/);
    expect(() => defineWorkbenchApp({ manifest: { id: "x" }, presentation: { title: "", tone: "t", Component: Tile } })).toThrow(/needs a title/);
  });

  it("registry refuses duplicates, availability defaults to true, manifestsOf projects", () => {
    const a = defineWorkbenchApp({ manifest: { id: "a" }, presentation: { title: "a", tone: "t", Component: Tile } });
    const b = defineWorkbenchApp({ manifest: { id: "b" }, presentation: { title: "b", tone: "t", Component: Tile, available: ({ workspaceId }) => workspaceId === "main" } });
    const registry = createPresentationRegistry([a, b.presentation]);
    expect(registry.list().map((app) => app.id)).toEqual(["a", "b"]);
    expect(() => createPresentationRegistry([a, a])).toThrow(/twice/);
    expect(isAppAvailable(a.presentation, { workspaceId: "x" })).toBe(true);
    expect(isAppAvailable(b.presentation, { workspaceId: "x" })).toBe(false);
    expect(manifestsOf([a, b]).map((m) => m.id)).toEqual(["a", "b"]);
  });
});

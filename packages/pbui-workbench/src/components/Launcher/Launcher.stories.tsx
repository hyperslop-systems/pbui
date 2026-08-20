import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = {
  title: "Workbench/Launcher",
};
export default meta;

export const Open: StoryObj = {
  name: "open: a placed singleton is “go to”, the rest “place”",
  render: function OpenStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }), []);
    useEffect(() => {
      wb.verbs.openLauncher();
    }, [wb]);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 360 }}>
        <wb.Surface />
        <wb.Launcher />
      </div>
    );
  },
};

/**
 * Per-pane invocation: `openLauncher(placementId)` aims the same dialog at
 * one tile. Choosing an application REPLACES what that tile shows; choosing
 * a view LINKS the tile to it. Nothing is added to the layout either way.
 *
 * Note the missing door: a product reaches this through its `<tile>`
 * presentation's object menu (the "Show something else here…" action from
 * `createTileDescriptor`), so a product without a tile presentation has the
 * mode but no way for a user to invoke it.
 */
export const PerPane: StoryObj = {
  name: "per-pane: show something else in THIS tile",
  render: function PerPaneStory() {
    const wb = useMemo(
      () => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }),
      [],
    );
    useEffect(() => {
      const first = wb.store.getState().document.workspaces[0]?.tree;
      const leaf = first?.body.case === "split" ? first.body.value.a : first;
      if (leaf) wb.verbs.openLauncher(leaf.id);
    }, [wb]);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 360 }}>
        <wb.Surface />
        <wb.Launcher />
      </div>
    );
  },
};

/** A product's own rows model and groups, through the slot (DR-U6). */
export const ProductRows: StoryObj = {
  name: "slot: a product's rows model",
  render: function ProductRowsStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(tile("counter")) }), []);
    useEffect(() => {
      wb.verbs.openLauncher();
    }, [wb]);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 360 }}>
        <wb.Surface />
        <wb.Launcher
          rows={({ apps, query }) =>
            apps
              .list()
              .filter((app) => app.title.toLowerCase().includes(query))
              .map((app) => ({
                id: `place:${app.id}`,
                kind: "app" as const,
                appId: app.id,
                title: app.title.toUpperCase(),
                detail: "a product row",
              }))
          }
          renderDetail={(row) => <em>{row.detail}</em>}
        />
      </div>
    );
  },
};

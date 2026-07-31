/**
 * The chrome kit in isolation (PBUI-UNIFY-001): the tile frame with its drag
 * grip and drop overlay, and the launcher shell with an example rows model.
 * The stories import the two shipped stylesheets the products import, so what
 * renders here is exactly the family default.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "../../public/presentation-parts.css";
import "../../public/chrome.css";
import { LauncherShell } from "./LauncherShell";
import { DropZoneOverlay, TileFrame } from "./TileFrame";
import { useTileDrag, type DragZone } from "./useTileDrag";

const meta: Meta = {
  title: "Chrome/Kit",
};
export default meta;

function DemoTile({ id, tone, title }: { id: string; tone: string; title: string }) {
  const [log, setLog] = useState<string>("");
  const drag = useTileDrag({
    id,
    onSwap: (source, target) => setLog(`swap ${source} ⇄ ${target}`),
    onDock: (source, target, zone) => setLog(`dock ${source} → ${target} (${zone})`),
  });
  return (
    <TileFrame
      placementId={id}
      tone={tone}
      title={title}
      canClose
      onSplit={(direction) => setLog(`split ${direction}`)}
      onClose={() => setLog("close")}
      grip={{ onPointerDown: drag.onGripPointerDown }}
      dropZone={drag.zone}
      dragging={drag.dragging}
      registerElement={drag.register}
    >
      <div style={{ padding: 8, fontSize: 12 }}>
        {log || "drag the ⠿ onto the other tile; centre swaps, edges dock"}
      </div>
    </TileFrame>
  );
}

export const TwoTilesWithDrag: StoryObj = {
  name: "tile frames with live drag/dock",
  render: () => (
    <div style={{ display: "flex", gap: 8, height: 260 }}>
      <DemoTile id="story-a" tone="#cfe3d4" title="lean source" />
      <DemoTile id="story-b" tone="#d8d2ea" title="interactive goals" />
    </div>
  ),
};

export const DropZones: StoryObj = {
  name: "the five drop-zone previews",
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(["left", "right", "top", "bottom", "center"] as DragZone[]).map((zone) => (
        <div
          key={zone}
          style={{ position: "relative", width: 220, height: 140, border: "1px solid #999" }}
        >
          <DropZoneOverlay zone={zone} />
        </div>
      ))}
    </div>
  ),
};

export const Launcher: StoryObj = {
  name: "the launcher shell",
  render: function LauncherStory() {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(true);
    const [chosen, setChosen] = useState<string | null>(null);
    const all = {
      views: [
        { id: "view:goals", title: "interactive goals", detail: "goals · shown 1 place" },
        { id: "view:script", title: "tactic script", detail: "script · shown 2 places" },
      ],
      apps: [
        { id: "app:overview", title: "development overview", detail: "declaration statuses" },
        { id: "app:trace", title: "protocol trace", detail: "every JSON-RPC message", disabled: true },
      ],
    };
    const match = (title: string) => title.toLowerCase().includes(query.trim().toLowerCase());
    if (!open)
      return (
        <button type="button" onClick={() => setOpen(true)}>
          reopen (chose: {chosen ?? "nothing"})
        </button>
      );
    return (
      <LauncherShell
        title="Open a view"
        groups={[
          { label: "OPEN VIEWS", rows: all.views.filter((row) => match(row.title)) },
          { label: "NEW VIEW", rows: all.apps.filter((row) => match(row.title)) },
        ]}
        query={query}
        onQueryChange={setQuery}
        onChoose={(id) => {
          setChosen(id);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        status="new views open beside the active tile · open views switch workspace"
        enterVerb={(id) => (id?.startsWith("view:") ? "go to" : "open")}
      />
    );
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Button, Kbd, Text, Toolbar } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = {
  title: "Workbench/Surface",
  parameters: { layout: "fullscreen" },
};
export default meta;

function Frame({ children, height = 520 }: { children: React.ReactNode; height?: number }) {
  return <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height, padding: 8 }}>{children}</div>;
}

export const ThreeTiles: StoryObj = {
  name: "three tiles: split, close, drag the ⠿ to swap or dock",
  render: function ThreeTilesStory() {
    const wb = useMemo(
      () =>
        createWorkbench({
          apps: demoApps,
          initial: layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second counter" })))),
        }),
      [],
    );
    return (
      <Frame>
        <wb.Surface />
      </Frame>
    );
  },
};

export const Resize: StoryObj = {
  name: "resize: drag the divider; it snaps at ¼ ⅓ ½ ⅔ ¾ and the arrow keys nudge it",
  render: function ResizeStory() {
    const wb = useMemo(
      () => createWorkbench({ apps: demoApps, initial: layout(split("row", 1 / 3, tile("notes"), tile("counter"))) }),
      [],
    );
    return (
      <Frame height={360}>
        <wb.Surface />
      </Frame>
    );
  },
};

export const DragToSwapOrDock: StoryObj = {
  name: "drag: centre swaps the two applications, an edge docks the source beside the target",
  render: function DragStory() {
    const wb = useMemo(
      () => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }),
      [],
    );
    return (
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", height: 420, padding: 8, gap: 8 }}>
        <Text size="small" prose>
          Press the ⠿ grip of one tile and drag over the other. The overlay names the outcome before you release:
          the centre swaps the two applications, the four edges split-dock the dragged view there and close its
          old tile. Releasing anywhere else abandons the drag.
        </Text>
        <wb.Surface />
      </div>
    );
  },
};

export const WithLauncherAndPersistence: StoryObj = {
  name: "launcher (⌘K / Ctrl+K) and serialize()/restore()",
  render: function LauncherStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(tile("counter")) }), []);
    const doc = wb.useDocument();
    return (
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", height: 480, padding: 8, gap: 8 }}>
        <Toolbar tight>
          <Text size="small">
            press <Kbd>⌘K</Kbd> (or <Kbd>Ctrl+K</Kbd>) to place an application beside the active tile
          </Text>
          <Button variant="framed" onClick={() => wb.verbs.openLauncher()}>
            open the launcher
          </Button>
          <Button variant="framed" onClick={() => wb.reset()}>
            reset layout
          </Button>
          <Text size="tiny" tone="faint">
            {Object.keys(doc.views).length} views · {wb.serialize().length} bytes serialised
          </Text>
        </Toolbar>
        <wb.Surface />
        <wb.Launcher />
      </div>
    );
  },
};

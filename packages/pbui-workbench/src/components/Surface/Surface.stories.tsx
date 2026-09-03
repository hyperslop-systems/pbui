import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { Button, Kbd, Text, Toolbar } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../../createWorkbenchShell";
import { commands, layout, split, tile } from "@hyperslop-systems/workbench-core";
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
          <Button variant="framed" onClick={() => wb.dispatch({ kind: "launcher.open" })}>
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

export const PlacementMode: StoryObj = {
  name: "placement mode: aim a document at a pane (5.E)",
  render: function PlacementStory() {
    const wb = useMemo(
      () =>
        createWorkbench({
          apps: demoApps,
          initial: layout(split("row", 0.55, tile("counter"), split("col", 0.5, tile("notes"), tile("counter")))),
        }),
      [],
    );
    const [log, setLog] = useState("nothing placed yet");

    /**
     * What a product's file list does: arm the mode, word the banner and the
     * per-tile overlays in its own vocabulary, then turn the aim into a
     * `view.open` with `at`. The controller places nothing itself.
     */
    const openHere = async (fileName: string) => {
      const outcome = await wb.placement.begin({
        prompt: `placing ${fileName}`,
        defaultLabel: "beside the active tile",
        labelFor: (_placementId, zone) => {
          return zone === "replace"
            ? `${fileName} takes over this pane`
            : zone === "center"
              ? `${fileName} opens beside this pane`
              : `${fileName} docks at this pane's ${zone} edge`;
        },
      });
      if (outcome.kind !== "aimed") {
        setLog(outcome.kind === "default" ? `${fileName}: took the default spot` : `${fileName}: cancelled`);
        if (outcome.kind === "default") wb.execute(commands.place("notes"));
        return;
      }
      wb.execute(commands.open("notes", {}, { title: fileName, at: { placementId: outcome.placementId, zone: outcome.zone } }));
      setLog(`${fileName} → ${outcome.zone} of ${outcome.placementId}`);
    };

    return (
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", height: 520, padding: 8, gap: 8 }}>
        <Toolbar tight>
          <Text size="small">open a file — then click the pane it should land in:</Text>
          <Button variant="framed" onClick={() => void openHere("Basic.lean")}>
            Basic.lean
          </Button>
          <Button variant="framed" onClick={() => void openHere("Tactics.lean")}>
            Tactics.lean
          </Button>
          <Text size="tiny" tone="faint">
            {log}
          </Text>
        </Toolbar>
        <wb.Surface />
      </div>
    );
  },
};

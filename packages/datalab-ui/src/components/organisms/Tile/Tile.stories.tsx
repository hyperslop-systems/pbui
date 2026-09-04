import { useMemo, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { defineWorkbenchApp, type WorkbenchApp } from "@hyperslop-systems/pbui-workbench";
import { renderDatalabTileAction, renderDatalabTitle } from "./Tile";
import { ObjectMenu } from "../../../pbui";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import {
  DatalabWorkbenchProvider,
  useDatalabWorkbench,
} from "../../../appkit/DatalabWorkbenchContext";
import {
  createDatalabWorkbench,
  datalabSingleStageSeed,
  type DatalabWorkbench,
} from "../../../appkit/workbench";
import { datalabWorkbenchApps } from "../../../appkit/workbenchApps";
import { tile } from "../../../store/seed";
import { WorkbenchProviders } from "../../pages/Workbench/WorkbenchProviders";
import { LauncherDialog } from "../LauncherDialog";
import "../../../apps/all";

/**
 * Datalab's title slot, in the shell's tile.
 *
 * The component under test is `TileTitle` (and `TileAction`): the `<tile>`
 * presentation, the derived `chart · α` label, the inline rename and the door
 * to the launcher. The frame around it — grip, split and close buttons, the
 * drop overlay — is the workbench shell's, so the story renders a whole
 * `Surface` over one seeded tile and passes the two slots the way
 * `WorkbenchShell` does. Anything less would be a title with no tile.
 */
interface TileStoryProps {
  appId: string;
  title?: string;
}

/**
 * A ghost application, for the "this build no longer has it" state.
 *
 * The core refuses a document naming an application its catalog lacks, so
 * the view's app has to exist for the WORKBENCH. The point of the story is
 * that it does not exist for the REGISTRY — `appFor` finds nothing, the title
 * falls back to the raw id and the menu offers no duplicate.
 */
function ghostApp(appId: string): WorkbenchApp {
  return defineWorkbenchApp({
    manifest: { id: appId, launch: "unbound" },
    presentation: { title: appId, tone: "faint", Component: () => null },
  });
}

function buildWorkbench(appId: string, title: string | undefined): DatalabWorkbench {
  const apps = datalabWorkbenchApps();
  const known = apps.some((app) => app.manifest.id === appId);
  return createDatalabWorkbench({
    seed: datalabSingleStageSeed("story", tile(appId, title ? { title } : {})),
    ...(known ? {} : { apps: [...apps, ghostApp(appId)] }),
  });
}

function TileStory({ appId, title }: TileStoryProps) {
  // Built ONCE per args, never per render: a workbench owns subscriptions.
  const workbench = useMemo(() => buildWorkbench(appId, title), [appId, title]);
  return (
    <StoryProviders workbench={workbench}>
      <Canvas />
    </StoryProviders>
  );
}

/** The shell's Surface with Datalab's two slots, exactly as `WorkbenchShell` mounts it. */
function Canvas() {
  const workbench = useDatalabWorkbench();
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <workbench.shell.Surface
        renderTitle={renderDatalabTitle}
        tileAction={renderDatalabTileAction}
        linkModeShortcut={false}
      />
    </div>
  );
}

function StoryProviders({
  workbench,
  children,
}: {
  workbench: DatalabWorkbench;
  children: ReactNode;
}) {
  return (
    <DatalabWorkbenchProvider workbench={workbench}>
      <AnalysisProvider principalKey="storybook-tile">
        <WorkbenchProviders>
          {children}
          {/* Replace … opens the product's launcher, which the shell mounts;
              here the story mounts it, so the door leads somewhere. */}
          <LauncherDialog />
          <ObjectMenu />
        </WorkbenchProviders>
      </AnalysisProvider>
    </DatalabWorkbenchProvider>
  );
}

const meta = {
  title: "Component Library/Organisms/Tile",
  component: TileStory,
  parameters: { tile: { width: 420, height: 320 }, pbui: false },
  args: { appId: "about" },
} satisfies Meta<typeof TileStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DocumentBound: Story = {
  args: { appId: "pipeline" },
};

export const UnknownApplication: Story = {
  args: { appId: "an-app-that-was-removed" },
};

export const Renamed: Story = {
  args: { appId: "chart", title: "Yield by station" },
};

export const Narrow: Story = {
  parameters: { tile: { width: 240, height: 280 } },
  args: { appId: "encode" },
};

export const NarrowLongTitle: Story = {
  parameters: { tile: { width: 240, height: 280 } },
  args: {
    appId: "chart",
    title: "Monthly production yield by station and operating line",
  },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

function title(canvasElement: HTMLElement): HTMLElement {
  const element = canvasElement.querySelector<HTMLElement>('[data-ptype="tile"]');
  if (!element) throw new Error("the tile title presentation did not render");
  return element;
}

function menuItem(canvasElement: HTMLElement, label: string): HTMLButtonElement {
  const item = [...canvasElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!item) throw new Error(`the title menu has no “${label}” action`);
  return item;
}

/** The launcher is a modal; it may be portaled, so it is looked for on the document. */
const launcherOpen = () => document.querySelector('[aria-label="close the launcher"]') !== null;

export const MenuOpenedByLeftClick: Story = {
  play: async ({ canvasElement }) => {
    title(canvasElement).click();
    await settle();
    if (!canvasElement.querySelector('[role="menu"]')) throw new Error("left click did not open");
  },
};

export const MenuOpenedByContextClick: Story = {
  play: async ({ canvasElement }) => {
    title(canvasElement).dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 80, clientY: 40 }),
    );
    await settle();
    if (!canvasElement.querySelector('[role="menu"]')) {
      throw new Error("context click did not open");
    }
  },
};

export const RenameFromMenu: Story = {
  args: { appId: "chart", title: "Yield by station" },
  play: async ({ canvasElement }) => {
    title(canvasElement).click();
    await settle();
    menuItem(canvasElement, "Rename …").click();
    await settle();
    if (!canvasElement.querySelector('input[aria-label="view name"]')) {
      throw new Error("Rename did not open the title editor");
    }
  },
};

export const ReplaceFromMenu: Story = {
  args: { appId: "about" },
  play: async ({ canvasElement }) => {
    title(canvasElement).click();
    await settle();
    menuItem(canvasElement, "Replace …").click();
    await settle();
    if (!launcherOpen()) throw new Error("Replace did not open the launcher");
    // Escape closes the launcher, which hands focus back to the tile it targeted.
    (document.activeElement ?? window).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle();
    if (launcherOpen()) throw new Error("Escape did not close Replace");
    const cell = canvasElement.querySelector<HTMLElement>('[data-part="workbench-tile"]');
    if (!cell?.contains(document.activeElement)) {
      throw new Error("Escape did not restore focus to the tile");
    }
  },
};

export const LinkedDuplicateFlow: Story = {
  args: { appId: "chart", title: "Yield by station" },
  play: async ({ canvasElement }) => {
    title(canvasElement).click();
    await settle();
    menuItem(canvasElement, "Create linked duplicate").click();
    await settle();
    const titles = canvasElement.querySelectorAll('[data-ptype="tile"]');
    if (titles.length !== 2)
      throw new Error(`expected two linked placements, saw ${titles.length}`);
    (titles[1] as HTMLElement).click();
    await settle();
    menuItem(canvasElement, "Close view everywhere");
  },
};

export const IndependentDuplicateFlow: Story = {
  args: { appId: "chart", title: "Yield by station" },
  play: async ({ canvasElement }) => {
    title(canvasElement).click();
    await settle();
    menuItem(canvasElement, "Duplicate").click();
    await settle();
    const titles = canvasElement.querySelectorAll('[data-ptype="tile"]');
    if (titles.length !== 2) {
      throw new Error(`expected two independent placements, saw ${titles.length}`);
    }
    (titles[1] as HTMLElement).click();
    await settle();
    menuItem(canvasElement, "Close view");
  },
};

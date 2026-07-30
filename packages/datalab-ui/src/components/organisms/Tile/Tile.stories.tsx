import { useMemo, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Provider, useSelector } from "react-redux";
import { Tile } from "./Tile";
import { makeStore, type AppStore, type RootState } from "../../../store";
import { singleStageLayout } from "../../../store/stages";
import type { Node } from "../../../store/layout";
import { ObjectMenu } from "../../../pbui";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import { WorkbenchProviders } from "../../pages/Workbench/WorkbenchProviders";
import { NodeView } from "../SplitView";
import "../../../apps/all";

interface TileStoryProps {
  appId: string;
  title?: string;
}

function TileStory({ appId, title }: TileStoryProps) {
  const fixture = useMemo(() => {
    let node: Extract<Node, { type: "leaf" }> | null = null;
    const layout = singleStageLayout("story", (builder) => {
      node = builder.leaf(appId, null, title) as Extract<Node, { type: "leaf" }>;
      return node;
    });
    return { store: makeStore({ preloaded: { layout } }), node: node! };
  }, [appId, title]);

  return <StoryProviders store={fixture.store}>{<Tile node={fixture.node} />}</StoryProviders>;
}

function StoryProviders({ store, children }: { store: AppStore; children: ReactNode }) {
  return (
    <Provider store={store}>
      <AnalysisProvider principalKey="storybook-tile">
        <WorkbenchProviders>
          {children}
          <ObjectMenu />
        </WorkbenchProviders>
      </AnalysisProvider>
    </Provider>
  );
}

function CurrentTree() {
  const tree = useSelector(
    (state: RootState) =>
      state.layout.spaces.find((space) => space.id === state.layout.currentSpaceId)?.tree,
  );
  return tree ? <NodeView node={tree} /> : null;
}

function ViewLifecycleStory() {
  const store = useMemo(
    () =>
      makeStore({
        preloaded: {
          layout: singleStageLayout("story", (builder) =>
            builder.leaf("chart", null, "Yield by station"),
          ),
        },
      }),
    [],
  );
  return (
    <StoryProviders store={store}>
      <CurrentTree />
    </StoryProviders>
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
    const titleControl = title(canvasElement);
    titleControl.click();
    await settle();
    menuItem(canvasElement, "Replace …").click();
    await settle();
    if (!canvasElement.querySelector('[aria-label="replace view"]')) {
      throw new Error("Replace did not open the shared switcher");
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    if (canvasElement.querySelector('[aria-label="replace view"]')) {
      throw new Error("Escape did not close Replace");
    }
    if (document.activeElement !== titleControl) {
      throw new Error("Escape did not restore focus to the view title");
    }
  },
};

export const LinkedDuplicateFlow: Story = {
  render: () => <ViewLifecycleStory />,
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
  render: () => <ViewLifecycleStory />,
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

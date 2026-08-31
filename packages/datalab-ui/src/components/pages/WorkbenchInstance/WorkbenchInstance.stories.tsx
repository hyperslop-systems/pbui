import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkbenchInstance } from "./WorkbenchInstance";
import { fixturesFrom } from "../../../api/fixtures";
import { readings, census } from "../../../fixtures";
import { createDefaultGraphic, fieldRef } from "../../../model/graphicAuthoring";
import { split } from "../../../store/layout";
import { singleStageLayout } from "../../../store/stages";
import { newId } from "../../../store/world";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";

/**
 * A sandboxed workbench, and — the story that matters — two of them.
 *
 * `TwoInstances` is DATADROP-7 phase 2's acceptance test. It is the only place
 * in the tree where the property the whole ticket exists to establish is
 * actually observable: two complete workbenches on one page, sharing a module
 * graph, a registry, a stylesheet and nothing else. Before this ticket the
 * property was not false so much as unobservable, because there was only ever
 * one.
 *
 * The `play` function adds a document to the left instance and asserts the
 * right one is unchanged. That is a weaker check than it looks unless you know
 * what it would have caught: a module-level store, a shared persistence key, a
 * shared workspace id, or a registry that had become per-instance state.
 */
const meta = {
  title: "Applications/Embedding",
  component: WorkbenchInstance,
  decorators: [
    (Story) => (
      <AnalysisProvider principalKey="storybook-fixtures">
        <Story />
      </AnalysisProvider>
    ),
  ],
  parameters: {
    tile: false,
    layout: "fullscreen",
    // The instance brings its own PbuiProvider. The decorator's would render a
    // second accept banner and mouse-doc line describing a context nothing is
    // using, which a reviewer cannot tell apart from the instance's own chrome.
    pbui: false,
    // These stories render whole shells, which are the landmark structure the
    // rule is about. Everywhere else it is off because a story renders a
    // fragment with no page shell.
    a11y: { config: { rules: [{ id: "region", enabled: true }] } },
  },
} satisfies Meta<typeof WorkbenchInstance>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The layout a tour section teaching the grammar would seed. */
function grammarSpaces() {
  return singleStageLayout("build", (builder) =>
    split(
      "row",
      split("col", builder.leaf("pipeline"), builder.leaf("encode"), 0.55),
      builder.leaf("chart"),
      0.46,
    ),
  );
}

/**
 * A world holding one document already pointed at a fixture source.
 *
 * `defaultChart(table)` is the same function `useDocTable` applies when a table
 * first arrives, so the encoding here is the encoding the product would infer —
 * a story that hand-wrote a mapping would be asserting what the engine produces
 * rather than showing it.
 */
function seededWorld() {
  const id = newId();
  return {
    docs: {
      [id]: createDefaultGraphic(id, "α", readings),
    },
    docOrder: [id],
    activeDocId: id,
  };
}

function seededAuthoringWorld() {
  const world = seededWorld();
  const document = Object.values(world.docs)[0]!;
  const view = document.views[document.rootView]!;
  view.encodings = {
    x: fieldRef("source:root", "data.humidity"),
    y: fieldRef("source:root", "data.temp_c"),
    color: fieldRef("source:root", "data.station"),
  };
  return world;
}

/** Chart beside table, both on one document — the pair §B teaches. */
function chartAndTable() {
  return singleStageLayout("look", (builder) =>
    split("row", builder.leaf("chart"), builder.leaf("table"), 0.55),
  );
}

function authorAndChart() {
  return singleStageLayout("author", (builder) =>
    split("row", builder.leaf("encode"), builder.leaf("chart"), 0.42),
  );
}

/**
 * A workbench with data and no server (DR-48).
 *
 * **This story is phase 3's acceptance test, and the way to check it is to stop
 * the API.** Nothing here mocks `fetch`, installs a service worker or swaps a
 * component: `ChartApp` and `TableApp` are the product's, `useDocTable` calls
 * the same generated hooks, and RTK Query keys the cache the same way. The only
 * difference is that the store carries a fixture map on its thunk extra
 * argument, so the base query answers from memory and never reaches the
 * network.
 *
 * If this story ever needs `msw` or a running server, DR-48 has failed.
 */
export const WithFixtures: Story = {
  args: {
    config: {
      fixtures: fixturesFrom(readings, census),
      preloaded: { world: seededWorld(), layout: chartAndTable() },
      apps: ["chart", "table", "pipeline", "encode", "sources", "launcher"],
      workspaces: false,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 520 }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * The real authoring container beside the real chart container over fixture
 * data. Analysis buttons dispatch Redux actions, the adapter recompiles the
 * document, and the chart updates without a server.
 */
export const AuthoringWithFixtures: Story = {
  args: {
    config: {
      fixtures: fixturesFrom(readings),
      preloaded: { world: seededAuthoringWorld(), layout: authorAndChart() },
      apps: ["chart", "encode"],
      workspaces: false,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 620 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement, step }) => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    const button = (name: string) => {
      const found = [...canvasElement.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent?.trim() === name,
      );
      if (!found) throw new Error(`no ${name} authoring button`);
      return found;
    };
    const chartDescription = () =>
      canvasElement.querySelector('[role="img"]')?.getAttribute("aria-label") ??
      canvasElement.querySelector('[role="img"]')?.textContent ??
      "";

    await step("histogram mode recompiles the chart", async () => {
      button("histogram").click();
      await settle();
      const description = chartDescription();
      if (!description.includes("bar plot") || !description.includes("12 rendered layer rows")) {
        throw new Error(`histogram did not render: ${description}`);
      }
    });

    await step("the bin preset changes generated geometry", async () => {
      button("20").click();
      await settle();
      const description = chartDescription();
      if (!description.includes("20 rendered layer rows")) {
        throw new Error(`20-bin histogram did not render: ${description}`);
      }
    });

    await step("regression mode emits observations, ribbon, and fit", async () => {
      button("regression").click();
      await settle();
      const description = chartDescription();
      if (!description.includes("point + ribbon + line")) {
        throw new Error(`regression layers did not render: ${description}`);
      }
    });
  },
};

export const Default: Story = {
  args: { config: {} },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 520 }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * A narrowed vocabulary (DR-53).
 *
 * The tile dropdown offers six applications rather than all twenty-five, because a
 * section teaching the grammar of graphics has no business offering the token
 * manager. Open a tile's application picker to see it.
 */
export const ScopedApplications: Story = {
  args: {
    config: {
      apps: ["chart", "table", "pipeline", "encode", "sources", "launcher"],
      preloaded: { layout: grammarSpaces() },
      workspaces: false,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 520 }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Two workbenches, sharing nothing.
 *
 * Seeded differently on purpose: one document each is symmetric and would hide
 * a shared store behind matching numbers.
 */
export const TwoInstances: Story = {
  args: { config: {} },
  render: () => (
    <div style={{ display: "flex", gap: 16, height: 460, padding: 8 }}>
      <div data-testid="left" style={{ display: "flex", flex: 1, minWidth: 0 }}>
        <WorkbenchInstance config={{ preloaded: { layout: grammarSpaces() }, workspaces: false }} />
      </div>
      <div data-testid="right" style={{ display: "flex", flex: 1, minWidth: 0 }}>
        <WorkbenchInstance
          config={{
            apps: ["chart", "table", "launcher"],
            preloaded: { layout: grammarSpaces() },
            workspaces: false,
          }}
        />
      </div>
    </div>
  ),
  // Plain DOM and thrown errors rather than a testing library, matching
  // `Pbui.stories.tsx` — the only other story in the tree that interacts.
  play: async ({ canvasElement, step }) => {
    const settle = () => new Promise((r) => setTimeout(r, 80));
    const side = (name: string) => {
      const root = canvasElement.querySelector<HTMLElement>(`[data-testid="${name}"]`);
      if (!root) throw new Error(`no ${name} instance`);
      return root;
    };

    /**
     * How many documents that instance's world holds.
     *
     * Read off the mouse-doc line, which reports "N tiles · N workspaces · N
     * documents". It is the cheapest observable in the shell that describes the
     * *world* rather than the layout, and reading it through the DOM rather
     * than through the store is deliberate: a test that reaches into the store
     * would pass even if the two instances shared one and the components were
     * subscribed to the wrong one.
     */
    const documents = (root: HTMLElement) => {
      const line = root.querySelector('[data-part="mouse-doc"]')?.textContent ?? "";
      const found = /(\d+) documents/.exec(line);
      if (!found) throw new Error(`no document count in "${line}"`);
      return Number(found[1]);
    };

    await step("both instances start with one document", async () => {
      if (documents(side("left")) !== 1) throw new Error("left did not start with one document");
      if (documents(side("right")) !== 1) throw new Error("right did not start with one document");
    });

    await step("a document added to one does not appear in the other", async () => {
      const plus = side("left").querySelector<HTMLButtonElement>(
        '[aria-label="new document in this tile"]',
      );
      if (!plus) throw new Error("no ＋ in the left instance's document bar");
      plus.click();
      await settle();

      if (documents(side("left")) !== 2) throw new Error("the document did not land in left");
      if (documents(side("right")) !== 1) {
        throw new Error("the worlds are shared — right saw left's document");
      }
    });

    await step("the scoped instance offers fewer applications", async () => {
      const options = (root: HTMLElement) =>
        root.querySelectorAll('[aria-label="application"] option').length;
      // Left is unscoped (every registered application); right names three.
      if (options(side("right")) >= options(side("left"))) {
        throw new Error("the app scope had no effect on the right instance's picker");
      }
    });
  },
};

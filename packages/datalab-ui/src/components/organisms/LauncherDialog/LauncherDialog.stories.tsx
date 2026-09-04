import { useEffect, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { DatalabWorkbenchProvider } from "../../../appkit/DatalabWorkbenchContext";
import { createDatalabWorkbench, datalabSingleStageSeed } from "../../../appkit/workbench";
import { navigationActions } from "../../../store/navigation";
import { split, tile } from "../../../store/seed";
import { LauncherDialog } from "./LauncherDialog";
import "../../../apps/all";

/**
 * The launcher modal, in the states that are expensive to reach by clicking.
 *
 * The awkward mode here is `MissingWorkspace` (GUIDELINES §3): typing `ws9`
 * into a stage with four workspaces takes a specific layout to produce and one
 * line of args to render, and it is the state most likely to be shipped as a
 * blank list by accident.
 */

type Scenario =
  | "fill"
  | "replace"
  | "query-workspace"
  | "query-new"
  | "missing-workspace"
  | "no-results"
  | "out-of-scope"
  | "navigate"
  | "navigate-new";

/** Types into the search field the way a user would, after the modal mounts. */
function Typed({ text }: { text: string }) {
  useEffect(() => {
    if (!text) return;
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [text]);
  return null;
}

function invocationFor(scenario: Scenario, placementId: string) {
  if (scenario === "replace" || scenario === "out-of-scope") {
    return { kind: "replace" as const, placementId };
  }
  // Navigate with NO active placement, which is the state a freshly loaded page
  // is actually in — nothing has been focused yet. It is also the state that
  // once hid every new-view row, so it is the one worth having a story for.
  if (scenario === "navigate" || scenario === "navigate-new") {
    return { kind: "navigate" as const, activePlacementId: null };
  }
  return { kind: "fill-launcher" as const, placementId };
}

const QUERY: Partial<Record<Scenario, string>> = {
  "query-workspace": "ws2 yield",
  "query-new": "+chart",
  "missing-workspace": "ws9",
  "no-results": "qqqq",
  "navigate-new": "+chart",
};

/** Named rather than inline: `test/stories.test.ts` takes the first quoted `title` key in the file as the meta title. */
const CHART_TITLE = "Yield by production line";

const viewIdOf = (leaf: { body: { case?: string; value?: unknown } }): string =>
  leaf.body.case === "leaf" ? (leaf.body.value as { viewId: string }).viewId : "";

function LauncherStory({ scenario }: { scenario: Scenario }) {
  const fixture = useMemo(() => {
    const seed = datalabSingleStageSeed(
      "story",
      split(
        "row",
        0.42,
        tile("launcher"),
        split("col", 0.5, tile("chart", { title: CHART_TITLE }), tile("table")),
      ),
    );
    const workbench = createDatalabWorkbench({ seed });
    const first = seed.document.workspaces[0]!;
    const tiles = leaves(first.tree);
    const placementId = tiles[0]!.id;
    const chartViewId =
      tiles.map(viewIdOf).find((id) => seed.document.views[id]?.appId === "chart") ?? "";

    // A second workspace holding a linked copy of the first chart, so `ws2`
    // has something to find and the linked/total counts are exercised. Made
    // through the controller — the same door the strip's "+" uses.
    const created = workbench.controller.createWorkspace({ name: "explore", select: false });
    if (created.ok && created.workspaceId) {
      const tree = workbench.core.getState().index.workspaceById.get(created.workspaceId)?.tree;
      const leaf = leaves(tree)[0];
      if (leaf) {
        workbench.controller.replacePlacement(leaf.id, { kind: "existing", viewId: chartViewId });
      }
      // The out-of-scope scenario gives the *other* workspace an allow-list
      // the target does not share, which is the §8.4 case: the row is still
      // listed under its own workspace and cannot be placed here.
      if (scenario === "out-of-scope") {
        workbench.controller.setWorkspaceApps(created.workspaceId, ["chart", "encoding"]);
        workbench.controller.setWorkspaceApps(first.id, ["table", "launcher"]);
      }
    }

    workbench.store.dispatch(navigationActions.openLauncher(invocationFor(scenario, placementId)));
    return { workbench, placementId };
  }, [scenario]);

  return (
    <DatalabWorkbenchProvider workbench={fixture.workbench}>
      <Typed text={QUERY[scenario] ?? ""} />
      <LauncherDialog />
    </DatalabWorkbenchProvider>
  );
}

const meta = {
  title: "Component Library/Organisms/LauncherDialog",
  component: LauncherStory,
  // The modal sizes itself; the decorator's tile would only constrain it.
  parameters: { tile: false },
  args: { scenario: "fill" },
} satisfies Meta<typeof LauncherStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty query: workspace groups, the current one first, plus new views. */
export const EmptyQuery: Story = {};

/** Opened from the tile title menu, so the header names the target. */
export const ReplaceTarget: Story = { args: { scenario: "replace" } };

/** `ws2 yield` — one workspace, with the alias resolved beside the name. */
export const WorkspaceQuery: Story = { args: { scenario: "query-workspace" } };

/** `+chart` — no existing views at all. */
export const NewViewQuery: Story = { args: { scenario: "query-new" } };

/** The awkward mode: a workspace ordinal this stage does not have. */
export const MissingWorkspace: Story = { args: { scenario: "missing-workspace" } };

/** Nothing matches, and the empty state names the two prefixes. */
export const NoResults: Story = { args: { scenario: "no-results" } };

/** A row placed where its application is offered, targeting one where it is not. */
export const OutOfScopeTarget: Story = { args: { scenario: "out-of-scope" } };

/**
 * `Mod+K` with nothing focused — the state a page load leaves you in.
 *
 * The header names the tile a new view would be created beside, because in
 * navigate mode creating splits rather than replaces (Decision 6). This story
 * exists because that state once showed no new-view rows at all.
 */
export const NavigateFromColdLoad: Story = { args: { scenario: "navigate" } };

/** `+chart` in navigate mode: offered, and it will split the named tile. */
export const NavigateCreatesBySplitting: Story = { args: { scenario: "navigate-new" } };

export const ArrowKeysMoveTheActiveRow: Story = {
  play: async () => {
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]');
    if (!input) throw new Error("the search combobox did not render");
    const activeId = () => input.getAttribute("aria-activedescendant");

    const first = activeId();
    if (!first) throw new Error("no result was active on open");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (activeId() === first) throw new Error("ArrowDown did not move the active row");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (activeId() !== first) throw new Error("ArrowUp did not return to the first row");

    // DOM focus must never leave the input: that is what makes
    // aria-activedescendant the thing a screen reader announces.
    if (document.activeElement !== input) {
      throw new Error("arrow navigation moved DOM focus off the search field");
    }
  },
};

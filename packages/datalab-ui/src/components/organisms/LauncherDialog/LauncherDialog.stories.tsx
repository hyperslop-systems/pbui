import { useEffect, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Provider, useDispatch } from "react-redux";
import { makeStore } from "../../../store";
import { layoutActions, split, type Node, type NodeId } from "../../../store/layout";
import { singleStageLayout } from "../../../store/stages";
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

function invocationFor(scenario: Scenario, placementId: NodeId) {
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

function Opener({ scenario, placementId }: { scenario: Scenario; placementId: NodeId }) {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(layoutActions.openLauncher(invocationFor(scenario, placementId)));
  }, [dispatch, scenario, placementId]);
  return null;
}

const QUERY: Partial<Record<Scenario, string>> = {
  "query-workspace": "ws2 yield",
  "query-new": "+chart",
  "missing-workspace": "ws9",
  "no-results": "qqqq",
  "navigate-new": "+chart",
};

function LauncherStory({ scenario }: { scenario: Scenario }) {
  const fixture = useMemo(() => {
    let placementId: NodeId = "";
    const layout = singleStageLayout("story", (builder) => {
      const launcher = builder.leaf("launcher");
      placementId = launcher.id;
      const chart = builder.leaf("chart", null, "Yield by production line");
      return split("row", launcher, split("col", chart, builder.leaf("table"), 0.5), 0.42);
    });

    // A second workspace holding a linked copy of the first chart, so `ws2`
    // has something to find and the linked/total counts are exercised.
    const first = layout.spaces[0];
    const chartLeaf = first
      ? (function find(node: Node): Extract<Node, { type: "leaf" }> | null {
          if (node.type === "leaf") {
            return layout.views[node.viewId]?.appId === "chart" ? node : null;
          }
          return find(node.a) ?? find(node.b);
        })(first.tree)
      : null;

    if (first && chartLeaf) {
      layout.spaces = [
        first,
        {
          id: "story-b",
          name: "explore",
          stageId: first.stageId,
          tree: { id: "story-b-leaf", type: "leaf", viewId: chartLeaf.viewId },
          // The out-of-scope scenario gives the *other* workspace an allow-list
          // the target does not share, which is the §8.4 case: the row is still
          // listed under its own workspace and cannot be placed here.
          ...(scenario === "out-of-scope" ? { apps: ["chart", "encoding"] } : {}),
        },
      ];
      if (scenario === "out-of-scope") first.apps = ["table", "launcher"];
    }

    return { store: makeStore({ preloaded: { layout } }), placementId };
  }, [scenario]);

  return (
    <Provider store={fixture.store}>
      <Opener scenario={scenario} placementId={fixture.placementId} />
      <Typed text={QUERY[scenario] ?? ""} />
      <LauncherDialog />
    </Provider>
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

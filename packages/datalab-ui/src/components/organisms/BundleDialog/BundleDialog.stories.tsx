import type { Meta, StoryObj } from "@storybook/react-vite";
import { BundleDialog } from "./BundleDialog";

/**
 * Import a tile, a workspace or a stage from a bundle.
 *
 * The three states below are the three the design specifies, and each one is
 * expensive to reach by clicking — the first needs Firefox, the second needs a
 * bundle already on the clipboard, the third needs the user to paste the wrong
 * thing. All three are two lines of props here.
 */
const meta = {
  title: "Component Library/Organisms/BundleDialog",
  component: BundleDialog,
  parameters: { tile: false, layout: "fullscreen" },
  args: {
    kind: "tile" as const,
    initial: "",
    from: null,
    knownApps: new Set(["chart", "table", "sources", "inspector"]),
    onCancel: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof BundleDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const TILE_BUNDLE = JSON.stringify(
  {
    format: "datadrop.layout",
    version: 3,
    kind: "tile",
    exportedAt: "2026-07-26T18:04:11.512Z",
    name: "readings, filtered",
    payload: {
      view: { app: "chart", title: "readings, filtered", documents: {} },
      docs: [],
    },
  },
  null,
  2,
);

/**
 * **Empty — and this is the path, not the fallback.**
 *
 * Firefox does not implement `navigator.clipboard.readText` for web content:
 * there is no permission to request and no flag to pass. So the dialog opens
 * with the field empty and focused, and ⌘V works with no click first. Build
 * this state first and verify it in Firefox; the prefill below is the
 * optimisation.
 *
 * The confirm button is disabled, and there is no error message — an empty
 * field is not a mistake.
 */
export const Empty: Story = {};

/** Prefilled from the clipboard, with a line saying where the content came from. */
export const Prefilled: Story = {
  args: { initial: TILE_BUNDLE, from: "clipboard" },
};

/**
 * Rejected: the user pasted something else.
 *
 * The verdict re-runs on every keystroke, so the confirm button is never
 * enabled for content that would then fail. A user should not be able to press
 * a button that reports an error.
 */
export const Rejected: Story = {
  args: { initial: "site,mean_temp,n\nnorth,21.4,18\nsouth,23.9,22\n" },
};

/**
 * The wrong KIND of bundle, which is a different refusal from a damaged one.
 *
 * "That is a workspace; this tile can only take a tile" tells the reader what
 * to do next. "Import failed" does not.
 */
export const WrongKind: Story = {
  args: {
    initial: JSON.stringify(
      {
        format: "datadrop.layout",
        version: 3,
        kind: "workspace",
        exportedAt: "2026-07-26T18:04:11.512Z",
        name: "explore",
        payload: {
          name: "explore",
          tree: { leaf: { view: 0 } },
          views: [{ app: "sources", documents: {} }],
          docs: [],
        },
      },
      null,
      2,
    ),
  },
};

/**
 * The awkward mode: a bundle naming an application this build does not have.
 *
 * It **warns and imports anyway**. The tile comes in naming `chartsy` and
 * renders `Tile`'s existing "no application called …" state, which preserves
 * the shape of what was shared: a reader sees a layout with one tile they
 * cannot fill, which is true, rather than a smaller layout, which is a lie
 * about what their colleague sent.
 */
export const UnknownApplication: Story = {
  args: {
    initial: TILE_BUNDLE.replace('"app": "chart"', '"app": "chartsy"'),
    from: "clipboard",
  },
};

/** A workspace import, so the confirm button and the title read for that kind. */
export const Workspace: Story = {
  args: {
    kind: "workspace" as const,
    from: "template",
    initial: JSON.stringify(
      {
        format: "datadrop.layout",
        version: 3,
        kind: "workspace",
        exportedAt: "2026-07-24T09:12:00.000Z",
        name: "weekly sensor review",
        payload: {
          name: "weekly sensor review",
          docs: [],
          views: [
            { app: "sources", documents: {} },
            { app: "inspector", documents: {} },
          ],
          tree: {
            split: {
              dir: "row",
              ratio: 0.34,
              a: { leaf: { view: 0 } },
              b: { leaf: { view: 1 } },
            },
          },
        },
      },
      null,
      2,
    ),
  },
};

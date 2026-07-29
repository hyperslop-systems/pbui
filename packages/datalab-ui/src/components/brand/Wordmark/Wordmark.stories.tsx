import type { Meta, StoryObj } from "@storybook/react-vite";
import { Wordmark } from ".";

/**
 * The wordmark at its three sizes, on both surfaces.
 *
 * The reason to look at this rather than trust the SVG: the letterforms are
 * hand-drawn on a 100x140 grid with 22-unit chamfers, and the properties that
 * decide whether it reads as one word — the space between DATA and LAB, the L's
 * narrower advance, the weight of the chamfer against the stem — are all
 * invisible in the path data and obvious here.
 *
 * `Inverted` is not decoration either. The glyphs fill with `currentColor` and
 * nothing else, which is the whole reason a lockup on the dark masthead needs
 * no second class; this story is the assertion that it actually works.
 */
const meta: Meta<typeof Wordmark> = {
  title: "Design System/Brand/Wordmark",
  component: Wordmark,
  parameters: { tile: false, layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof Wordmark>;

export const Hero: Story = { args: { size: "hero" } };
export const Masthead: Story = { args: { size: "masthead" } };
export const Footer: Story = { args: { size: "footer" } };

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
      <Wordmark size="hero" />
      <Wordmark size="masthead" />
      <Wordmark size="footer" />
    </div>
  ),
};

export const Inverted: Story = {
  render: () => (
    <div
      style={{
        background: "var(--pbui-ink)",
        color: "var(--pbui-paper)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        alignItems: "flex-start",
      }}
    >
      <Wordmark size="hero" />
      <Wordmark size="masthead" />
    </div>
  ),
};

/**
 * Against a paragraph, which is the check that matters for the masthead size:
 * the wordmark has to hold its own beside 11.5px prose without shouting.
 */
export const InContext: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Wordmark size="masthead" />
      <span
        style={{ font: "var(--pbui-fs-base)/1.5 var(--pbui-font)", color: "var(--pbui-faint)" }}
      >
        a grammar-of-graphics workbench
      </span>
    </div>
  ),
};

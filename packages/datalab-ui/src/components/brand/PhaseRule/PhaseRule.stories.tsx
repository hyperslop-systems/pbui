import type { Meta, StoryObj } from "@storybook/react-vite";
import { PhaseRule } from ".";

/**
 * The four-bar rule, in the four configurations that exist.
 *
 * The story worth reading is `LabelsOnPaper` beside `LabelsOnInk`. The phase
 * colours are aliases of the presentation tones (DR-98), which are *graphic*
 * colours held to 3:1 — so on paper the labels take `--brand-faint` and the
 * colour is carried by the bar, while on ink the same tones are light-on-dark
 * and may be used as text.
 *
 * Rendering both here is how that rule stays true: the paper variant in phase
 * colours looks better in isolation and fails an audit, and this is where
 * someone would notice it had been "improved".
 */
const meta: Meta<typeof PhaseRule> = {
  title: "Design System/Brand/PhaseRule",
  component: PhaseRule,
  parameters: { tile: false, layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof PhaseRule>;

export const BarsOnly: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <PhaseRule />
    </div>
  ),
};

export const LabelsOnPaper: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <PhaseRule labels />
    </div>
  ),
};

export const IconsAndLabels: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <PhaseRule icons labels />
    </div>
  ),
};

export const LabelsOnInk: Story = {
  render: () => (
    <div style={{ background: "var(--pbui-ink)", color: "var(--pbui-paper)", padding: 32 }}>
      <div style={{ width: 420 }}>
        <PhaseRule icons labels on="ink" />
      </div>
    </div>
  ),
};

/** Narrow, where UNDERSTAND has to wrap rather than push its neighbour out. */
export const Narrow: Story = {
  render: () => (
    <div style={{ width: 220 }}>
      <PhaseRule icons labels />
    </div>
  ),
};

/**
 * The three sizes, which until DATALAB-UI-AUDIT-1 could not be storied at all.
 *
 * `masthead` and `footer` were `.lockup_masthead .bar` and `.lockup_footer .bar`
 * in a stylesheet the lockup and the rule shared, so the only way to see them
 * was to render a lockup — the component's own story showed one of its three
 * appearances and gave no hint that the others existed. That is the concrete
 * cost of a shared sheet, and it is why the size is now a prop.
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24, width: 420 }}>
      <PhaseRule size="hero" />
      <PhaseRule size="masthead" />
      <PhaseRule size="footer" />
    </div>
  ),
};

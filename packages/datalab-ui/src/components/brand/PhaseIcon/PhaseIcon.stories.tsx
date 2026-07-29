import type { Meta, StoryObj } from "@storybook/react-vite";
import { PhaseIcon } from ".";
import { PHASES, phaseVar } from "../phases";

/**
 * The four glyphs, at the sizes they are actually used.
 *
 * `Small` is the one to check. The sign-up tile draws these at 14px, and the
 * brain is the glyph that decides whether the set works at that size — three
 * gyri per lobe is the most detail that survives, and this story is where a
 * fourth would obviously be too many.
 */
const meta: Meta<typeof PhaseIcon> = {
  title: "Design System/Brand/PhaseIcon",
  component: PhaseIcon,
  parameters: { tile: false, layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof PhaseIcon>;

function Row({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      {PHASES.map((phase) => (
        <span key={phase} style={{ color: phaseVar(phase) }}>
          <PhaseIcon phase={phase} size={size} />
        </span>
      ))}
    </div>
  );
}

export const Large: Story = { render: () => <Row size={48} /> };
export const Default: Story = { render: () => <Row size={24} /> };
export const Small: Story = { render: () => <Row size={14} /> };

export const Ink: Story = {
  render: () => (
    <div style={{ background: "var(--pbui-ink)", padding: 32 }}>
      <Row size={48} />
    </div>
  ),
};

/**
 * In ink rather than in phase colour, which is how they appear in the brand
 * sheet's own icon-set row.
 */
export const Monochrome: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, color: "var(--pbui-ink)" }}>
      {PHASES.map((phase) => (
        <PhaseIcon key={phase} phase={phase} size={48} />
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClaimBlock, Lockup } from ".";

/**
 * The logo lockup at its three sizes, plus the claim block.
 *
 * `Hero` is the brand sheet's full treatment: parent line, wordmark, rule,
 * icons, labels. `Masthead` and `Footer` drop the words, because at 22px and
 * 15px the four labels are smudges competing with the wordmark above them —
 * which is the kind of judgement that only survives if it is visible somewhere.
 *
 * `OnInk` exercises the property the whole file rests on: every mark is
 * `currentColor` or a token, so inverting is a background and a colour on the
 * wrapper and nothing else.
 */
const meta: Meta<typeof Lockup> = {
  title: "Design System/Brand/Lockup",
  component: Lockup,
  parameters: { tile: false, layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof Lockup>;

export const Hero: Story = { args: { size: "hero", parent: true, icons: true, labels: true } };
export const Masthead: Story = { args: { size: "masthead", parent: true } };
export const Footer: Story = { args: { size: "footer" } };

export const OnInk: Story = {
  render: () => (
    <div style={{ background: "var(--pbui-ink)", color: "var(--pbui-paper)", padding: 40 }}>
      <Lockup size="hero" parent labels />
    </div>
  ),
};

/** The brand sheet's usage example. */
export const Claim: Story = {
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <ClaimBlock />
    </div>
  ),
};

/** Everything at once, which is what a brand sheet is. */
export const Sheet: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 640 }}>
      <Lockup size="hero" parent icons labels />
      <Lockup size="masthead" parent />
      <Lockup size="footer" />
      <ClaimBlock />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import { MarketingPage } from "./MarketingPage";

/**
 * The front door: what a stranger sees at `/`.
 *
 * Six stores end up on this page — the hero plus the tutorial band's five — and
 * all six answer from committed fixtures rather than from a server (DR-48).
 *
 * **Stop the API server before reading this.** If anything on the page needs
 * it, DR-48 has failed and the marketing page will be blank for exactly the
 * visitors it was built for.
 *
 * Worth doing by hand, in this order:
 *
 *  1. Right-click a mark in the hero chart and choose **Exclude …**. A filter
 *     step appears in the pipeline beside it. That is the whole pitch, above
 *     the paragraph making it.
 *  2. Scroll past the hero and watch the header take its edge.
 *  3. Check the four-bar rule under the hero lede against the chip tones in the
 *     workbench beside it — they are the same four colours (DR-98).
 *  4. Narrow the window below 900px and confirm every grid collapses to one
 *     column rather than overflowing.
 */
const meta = {
  title: "Applications/Marketing/Page",
  component: MarketingPage,
  decorators: [
    (Story) => (
      <AnalysisProvider principalKey="storybook-marketing-fixtures">
        <Story />
      </AnalysisProvider>
    ),
  ],
  parameters: {
    tile: false,
    layout: "fullscreen",
    pbui: false,
    a11y: { config: { rules: [{ id: "region", enabled: true }] } },
  },
} satisfies Meta<typeof MarketingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

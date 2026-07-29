import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import { TutorialBand } from "./TutorialBand";

/**
 * The tutorial band: five sandboxed workbenches, one after another.
 *
 * Rendered here on its own, without the marketing page that sets it into
 * itself — which is exactly what a story is for. The page around it is
 * `Applications/Marketing/Page`.
 *
 * **Everything below is the real application.** Not screenshots, not a demo
 * mode — the same `WorkbenchShell` the product renders, five times, each over
 * its own store, answering from committed fixtures rather than from a server.
 * They share a module graph, a registry, a stylesheet and nothing else.
 *
 * Worth doing by hand, in this order:
 *
 *  1. In §A, right-click a mark in a chart and choose **Exclude …**. A filter
 *     step appears in the pipeline beside it. That is the whole system.
 *  2. Scroll to §A and press ▶ on a step: grey tick, WATCHED. Then do the same
 *     move by hand in another section: green.
 *  3. In §D, pick a module card and watch the large tile become it.
 *  4. Press ↺ on any section. The world and the ticks go back together.
 *  5. Add a document in §B, then scroll to §C and confirm it is not there.
 *
 * **Stop the API server before reading this.** If anything on the page needs
 * it, DR-48 has failed.
 */
const meta = {
  title: "Applications/Tour/Band",
  component: TutorialBand,
  decorators: [
    (Story) => (
      <AnalysisProvider principalKey="storybook-tour-fixtures">
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
} satisfies Meta<typeof TutorialBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

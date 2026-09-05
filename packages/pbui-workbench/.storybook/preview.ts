import type { Preview } from "@storybook/react-vite";
// The consumer import order (playbook §3): the design system (which ships a
// default for every token it reads), then this package's own parts. The
// stories' app tones come from pbui's own tokens, so no product token sheet
// is needed here.
import "@hyperslop-systems/pbui/styles.css";
import "./base.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
};

export default preview;

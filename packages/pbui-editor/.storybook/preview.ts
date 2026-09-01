import type { Preview } from "@storybook/react-vite";
// The consumer import order: the design system (which ships a default for
// every token it reads), then this package's own stylesheet.
import "@hyperslop-systems/pbui/styles.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
};

export default preview;

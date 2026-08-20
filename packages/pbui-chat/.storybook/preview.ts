import type { Preview } from "@storybook/react-vite";
// The product import order (playbook §3): reset, tokens, the design system,
// then the product's own grammar. Storybook is a consumer of the library, so
// it loads the demo product's stylesheets exactly as the demo app does.
import "../demo/src/styles/reset.css";
import "../demo/src/styles/tokens.css";
import "@hyperslop-systems/pbui/styles.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
};

export default preview;

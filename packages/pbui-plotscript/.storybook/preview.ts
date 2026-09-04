import type { Preview } from "@storybook/react-vite";
import "@hyperslop-systems/pbui/styles.css";
import "./base.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import "@hyperslop-systems/pbui-editor/styles.css";
import "@hyperslop-systems/pbui-sandbox/styles.css";
import "@hyperslop-systems/plot/styles.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
};

export default preview;

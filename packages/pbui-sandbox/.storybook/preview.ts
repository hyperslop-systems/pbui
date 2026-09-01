import type { Preview } from "@storybook/react-vite";
// The consumer import order: the design system, then the packages this one
// composes (workbench chrome, the editor), then our own module CSS arrives
// with the components the stories import.
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import "@hyperslop-systems/pbui-editor/styles.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
};

export default preview;

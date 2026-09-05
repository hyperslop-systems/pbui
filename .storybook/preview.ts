import type { Preview } from "@storybook/react-vite";
// The storybook is a CONSUMER of the library, so it must define the design
// tokens the components read — pbui ships none, and an undefined token fails
// silently at computed-value time (the §4 trap of the new-app playbook).
// Without this import every story renders bare: monospace becomes Times,
// borders vanish, and the selection fill disappears. The canonical values
// live in datalab-ui's tokens.css; storybook borrows them verbatim.
import "../src/tokens.css";
import "./base.css";
import "../src/styles.css";
import "../public/components.css";
// The documented product import order (new-app playbook §3) continues with
// the presentation parts — THE design-system look for menus, hover, and
// acceptance. Without it, only the zero-specificity fallbacks in
// src/styles.css apply, and every object menu in every story renders as the
// bare default rather than the family look.
import "../public/presentation-parts.css";
import "../public/chrome.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;

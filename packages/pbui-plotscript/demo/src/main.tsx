import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The product import order: the design system (which ships a default for
// every token it reads), then each package's parts, then the demo's own
// grammar, last.
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import "@hyperslop-systems/pbui-editor/styles.css";
import "@hyperslop-systems/pbui-sandbox/styles.css";
import "@hyperslop-systems/plot/styles.css";
import "@hyperslop-systems/pbui-plotscript/styles.css";
import "./styles/app.css";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

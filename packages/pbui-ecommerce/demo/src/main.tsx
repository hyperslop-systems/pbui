import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import "@hyperslop-systems/plot/styles.css";
import "@hyperslop-systems/pbui-ecommerce/styles.css";
import "./styles/app.css";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

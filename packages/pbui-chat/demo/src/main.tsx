import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The product import order (playbook §3): reset, tokens, the design system,
// the chat layer's parts, then the product's own grammar, last.
import "./styles/reset.css";
import "./styles/tokens.css";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-chat/styles.css";
import "./styles/app.css";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The product import order (playbook §3): reset, tokens, the design system,
// the workbench's and the chat layer's parts, then the product's own
// grammar, last.
import "./styles/reset.css";
import "./styles/tokens.css";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import "@hyperslop-systems/pbui-chat/styles.css";
import "@hyperslop-systems/pbui-sandbox/styles.css";
import "./styles/app.css";
import { App } from "./App";
import { conversationsReady } from "./workbench";

/*
 * The first conversation has to exist before the first render: a `chat` tile
 * is a view OF a conversation now, and a fresh browser has to ask the server
 * for a session id before it has one to bind to.
 */
await conversationsReady;

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

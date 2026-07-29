import { createRoot } from "react-dom/client";

import { DatalabApp } from "./DatalabApp";
import "./styles";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from the page shell");

createRoot(container).render(<DatalabApp />);

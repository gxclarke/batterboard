import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initPersistence } from "./store/autosave";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
initPersistence().catch(console.error);
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

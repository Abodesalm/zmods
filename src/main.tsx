import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Desktop chrome: no browser context menu, no drag-and-drop navigation.
window.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, [data-allow-context-menu]")) return;
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

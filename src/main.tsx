import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/themes.css";
import { useUiStore } from "./store/ui";

// Apply theme class on store change
useUiStore.subscribe((state) => {
  const html = document.documentElement;
  html.className = html.className.replace(/theme-\w+[\w-]*/g, "").trim();
  html.classList.add(`theme-${state.theme}`);
});
// Apply initial theme
document.documentElement.classList.add(`theme-${useUiStore.getState().theme}`);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

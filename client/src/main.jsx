import React, {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Prevent accidental value changes when scrolling over focused number inputs.
window.addEventListener(
  "wheel",
  (event) => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement &&
      activeElement.type === "number"
    ) {
      activeElement.blur();
    }
  },
  {passive: true},
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

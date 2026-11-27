import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles/studio.css";
import "@assets/social-inspect/embedded.css";
import "@assets/svg-compose/embedded.css";
import "./app.css";
import "./shell.css";
import "./cards.css";
import "./pages.css";
import { DesktopFlushProvider } from "./lib/flush";
import { router } from "./router";

// WebKit navigates away from the app when a file is dropped on the page. Block
// that default everywhere; tool-specific dropzones still receive their events.
for (const type of ["dragenter", "dragover", "drop"]) {
  window.addEventListener(
    type,
    (event) => {
      if (event instanceof DragEvent) event.preventDefault();
    },
    true,
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DesktopFlushProvider>
      <RouterProvider router={router} />
    </DesktopFlushProvider>
  </StrictMode>,
);

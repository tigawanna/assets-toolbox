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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DesktopFlushProvider>
      <RouterProvider router={router} />
    </DesktopFlushProvider>
  </StrictMode>,
);

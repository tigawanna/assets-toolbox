import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { HeadlessRenderer } from "./HeadlessRenderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./data-access-layer/collections";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element");
const headless =
  window.location.pathname.endsWith("/render") ||
  new URLSearchParams(window.location.search).has("board");
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {headless ? <HeadlessRenderer /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
);

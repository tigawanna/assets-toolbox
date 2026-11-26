import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setDesktopWorkspaceActive } from "./lib/desktop";
import "./styles.css";

export function mountSvgCompose(host: HTMLElement): () => void {
  host.classList.add("svg-compose-root");
  const root = createRoot(host);
  let flush: (() => Promise<boolean>) | null = null;

  const onReady = (next: (() => Promise<boolean>) | null) => {
    flush = next;
    if (next) setDesktopWorkspaceActive(true);
  };

  root.render(createElement(StrictMode, null, createElement(App, { onReady })));

  return () => {
    const pendingFlush = flush;
    const finish = () => {
      root.unmount();
      setDesktopWorkspaceActive(false);
      host.classList.remove("svg-compose-root");
    };
    if (pendingFlush) void pendingFlush().then(finish, finish);
    else finish();
  };
}

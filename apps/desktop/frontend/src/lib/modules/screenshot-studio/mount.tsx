import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import ScreenshotStudioApp from "./ScreenshotStudioApp";
import { setDesktopModuleActive, type DesktopFlush } from "../../desktop";
import "./styles.css";

export function mountScreenshotStudio(host: HTMLElement): () => void {
  host.classList.add("screenshot-studio-root");
  const root = createRoot(host);
  let flush: DesktopFlush | null = null;

  const onReady = (next: DesktopFlush | null) => {
    flush = next;
    setDesktopModuleActive("studio", next !== null);
  };

  root.render(createElement(StrictMode, null, createElement(ScreenshotStudioApp, { onReady })));

  return () => {
    const pendingFlush = flush;
    const finish = () => {
      root.unmount();
      setDesktopModuleActive("studio", false);
      host.classList.remove("screenshot-studio-root");
    };
    if (pendingFlush) void pendingFlush().then(finish, finish);
    else finish();
  };
}

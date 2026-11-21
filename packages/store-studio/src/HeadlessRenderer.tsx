import { useEffect } from "react";

import { getHost } from "./data-access-layer/host";
import { loadProject } from "./data-access-layer/project";
import { renderSlice } from "./render/renderSlice";

declare global {
  interface Window {
    __STORE_STUDIO_RENDER_DONE__?: boolean;
    __STORE_STUDIO_RENDER_RESULT__?: unknown;
    __STORE_STUDIO_RENDER_ERROR__?: string;
  }
}

/** Mounted at /render?board=<kind> by `store-studio render` under Playwright. */
export function HeadlessRenderer() {
  useEffect(() => {
    void (async () => {
      try {
        window.__STORE_STUDIO_RENDER_DONE__ = false;
        const project = await loadProject();
        const kind = new URLSearchParams(window.location.search).get("board");
        const board =
          project.boards.find((candidate) => candidate.kind === kind) ?? project.boards[0];
        if (board === undefined) throw new Error("No board in the project");
        const host = getHost();
        for (let index = 0; index < board.sliceCount; index += 1) {
          const png = await renderSlice(project, board, index);
          await host.exportSlice({ boardId: board.id, index, png });
        }
        const report = await host.finishExport({
          project,
          boardIds: [board.id],
          settings: project.export,
        });
        window.__STORE_STUDIO_RENDER_RESULT__ = report;
      } catch (error) {
        window.__STORE_STUDIO_RENDER_ERROR__ =
          error instanceof Error ? error.message : String(error);
      } finally {
        window.__STORE_STUDIO_RENDER_DONE__ = true;
      }
    })();
  }, []);
  return <div className="loading">Rendering…</div>;
}

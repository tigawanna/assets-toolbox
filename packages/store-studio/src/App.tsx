import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { StudioStage } from "./canvas/StudioStage";
import { loadProject } from "./data-access-layer/project";
import { useProject } from "./data-access-layer/useProject";
import { materializeSources } from "./templates/registry";
import { Assets, BoardTabs, Layers, SliceStrip } from "./panels/Panels";
import { EventLogPanel } from "./panels/EventLogPanel";
import { ExportDialog } from "./panels/ExportDialog";
import { Inspector } from "./panels/Inspector";
import { LintPanel } from "./panels/LintPanel";
import { StorePreview } from "./panels/StorePreview";
import { TemplateGallery } from "./panels/TemplateGallery";
import { useHistory } from "./session/history";
import { useSelection } from "./session/selection";
import { useLayout } from "./session/layout";

export function App() {
  const project = useProject();
  const [ready, setReady] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const layout = useLayout();
  const dragOrigin = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    void loadProject()
      .then(() => {
        materializeSources();
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const history = useHistory.getState();
      const selection = useSelection.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selection.ids.length > 0
      ) {
        history.commit((draft) => {
          for (const board of draft.boards) {
            board.nodes = board.nodes.filter((node) => !selection.ids.includes(node.id));
          }
        });
        selection.clear();
      } else if (event.key.startsWith("Arrow")) {
        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (event.key === "ArrowLeft") dx = -step;
        else if (event.key === "ArrowRight") dx = step;
        else if (event.key === "ArrowUp") dy = -step;
        else if (event.key === "ArrowDown") dy = step;
        if (dx === 0 && dy === 0) return;
        event.preventDefault();
        history.commit((draft) => {
          for (const board of draft.boards) {
            for (const node of board.nodes) {
              if (selection.ids.includes(node.id)) {
                node.x += dx;
                node.y += dy;
              }
            }
          }
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function startCanvasDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.target instanceof HTMLButtonElement) return;
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      ox: layout.offset.x,
      oy: layout.offset.y,
    };
    layout.setFloating(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Synthetic events in tests have no active pointer to capture. */
    }
  }

  function moveCanvasDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const origin = dragOrigin.current;
    if (origin === null) return;
    layout.setOffset({
      x: origin.ox + event.clientX - origin.x,
      y: origin.oy + event.clientY - origin.y,
    });
  }

  function endCanvasDrag(): void {
    dragOrigin.current = null;
  }

  if (!ready) return <div className="loading">Loading Store Studio…</div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Store Studio</strong>
          <span className="store-badge">
            {project.store === "play" ? "Google Play" : "App Store"}
          </span>
        </div>
        <BoardTabs />
        <div className="top-actions">
          <label className="app-name-field">
            App
            <input
              value={project.app.name}
              onChange={(event) =>
                useHistory.getState().commit((draft) => {
                  draft.app.name = event.target.value;
                })
              }
            />
          </label>
          <button
            type="button"
            className={layout.leftOpen ? "panel-toggle active" : "panel-toggle"}
            title="Toggle left sidebar"
            aria-label="Toggle left sidebar"
            onClick={layout.toggleLeft}
          >
            ◧
          </button>
          <button
            type="button"
            className={layout.rightOpen ? "panel-toggle active" : "panel-toggle"}
            title="Toggle right sidebar"
            aria-label="Toggle right sidebar"
            onClick={layout.toggleRight}
          >
            ◨
          </button>
          <button type="button" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <ExportDialog />
        </div>
      </header>
      <main
        className={`workspace${layout.leftOpen ? "" : " no-left"}${
          layout.rightOpen ? "" : " no-right"
        }`}
      >
        <aside className="left-sidebar">
          <TemplateGallery />
          <Assets />
          <Layers />
        </aside>
        <section className="center">
          <div
            className="canvas-grip"
            onPointerDown={startCanvasDrag}
            onPointerMove={moveCanvasDrag}
            onPointerUp={endCanvasDrag}
            onPointerCancel={endCanvasDrag}
          >
            <span className="grip-icon">⠿</span>
            <strong>Canvas</strong>
            <span className="hint">drag to pan the board only</span>
            {layout.floating ? (
              <button type="button" onClick={layout.dock}>
                Dock
              </button>
            ) : null}
          </div>
          <div
            className={layout.floating ? "stage-movable floating" : "stage-movable"}
            style={
              layout.floating
                ? { transform: `translate(${layout.offset.x}px, ${layout.offset.y}px)` }
                : undefined
            }
          >
            <StudioStage />
          </div>
          <SliceStrip />
        </section>
        <aside className="right-sidebar">
          <Inspector />
          <LintPanel />
          <EventLogPanel />
        </aside>
      </main>
      {showPreview ? <StorePreview /> : null}
    </div>
  );
}

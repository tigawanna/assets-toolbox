export type Notice = {
  id: number;
  label: string;
  keyHint?: string;
  detail?: string;
};

export type DragStatus = { mode: "move" | "duplicate"; count: number };

type Props = {
  notice: Notice | null;
  drag: DragStatus | null;
  activeTool: string | null;
};

/** Edge-of-canvas readout: announces actions and stays put while dragging. */
export function StatusHud({ notice, drag, activeTool }: Props) {
  let content = null;
  if (drag) {
    content = (
      <div className="hud-pill hud-drag" key="drag">
        <span className="hud-pulse" />
        <span>
          {drag.mode === "duplicate" ? "Duplicating" : "Moving"} {drag.count}{" "}
          {drag.count === 1 ? "item" : "items"}
        </span>
        <span className="hud-detail">release to drop</span>
      </div>
    );
  } else if (notice) {
    content = (
      <div className="hud-pill" key={notice.id}>
        {notice.keyHint && <kbd className="hud-key">{notice.keyHint}</kbd>}
        <span>{notice.label}</span>
        {notice.detail && <span className="hud-detail">{notice.detail}</span>}
      </div>
    );
  } else if (activeTool) {
    content = (
      <div className="hud-pill hud-quiet" key={activeTool}>
        <span className="hud-tool-dot" />
        {activeTool} tool
      </div>
    );
  }

  return (
    <div aria-live="polite" className="hud">
      {content}
    </div>
  );
}

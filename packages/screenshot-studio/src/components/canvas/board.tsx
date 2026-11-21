import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { FrameRow } from "@/lib/events";
import { displaySize } from "@/lib/presets";

interface BoardProps {
  frames: FrameRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (frames: { id: string; x: number; y: number }[]) => Promise<void> | void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

/** One wide banner. Each child is a slice that exports as its own screenshot. */
export function Board({ frames, selectedId, onSelect, onMove }: BoardProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const ordered = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
  const origin = ordered[0] ?? { x: 64, y: 64 };
  const banner = live ?? { x: origin.x, y: origin.y };

  useEffect(() => {
    if (live === null) return;
    const first = [...frames].sort((a, b) => a.x - b.x || a.y - b.y)[0];
    if (first !== undefined && first.x === live.x && first.y === live.y) setLive(null);
  }, [frames, live]);

  useEffect(() => {
    const element = viewport.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) =>
        Math.min(2.5, Math.max(0.25, current * (event.deltaY > 0 ? 0.92 : 1.08))),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (drag === null) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrag(null);
      setLive(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);

  function release(event: ReactPointerEvent<HTMLElement>) {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const x = Math.round(drag.originX + (event.clientX - drag.startX) / zoom);
    const y = Math.round(drag.originY + (event.clientY - drag.startY) / zoom);
    setDrag(null);
    if (x === drag.originX && y === drag.originY) {
      setLive(null);
      return;
    }
    const dx = x - drag.originX;
    const dy = y - drag.originY;
    setLive({ x, y });
    const next = ordered.map((frame) => ({ id: frame.id, x: frame.x + dx, y: frame.y + dy }));
    void Promise.resolve(onMove(next)).catch(() => setLive(null));
  }

  let cursor = 0;
  const slices = ordered.map((frame) => {
    const size = displaySize(frame.width, frame.height);
    const left = cursor;
    cursor += size.width;
    return { frame, size, left };
  });
  const bannerWidth = Math.max(cursor, 280);
  const bannerHeight = Math.max(...slices.map((slice) => slice.size.height), 160);

  return (
    <div
      ref={viewport}
      data-testid="canvas"
      className="canvas-grid relative h-full min-h-0 w-full overflow-hidden"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onSelect(null);
        const originPan = { ...pan };
        const startX = event.clientX;
        const startY = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => {
          setPan({
            x: originPan.x + next.clientX - startX,
            y: originPan.y + next.clientY - startY,
          });
        };
        const up = () => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          event.currentTarget.removeEventListener("pointermove", move);
          event.currentTarget.removeEventListener("pointerup", up);
          event.currentTarget.removeEventListener("pointercancel", up);
        };
        event.currentTarget.addEventListener("pointermove", move);
        event.currentTarget.addEventListener("pointerup", up);
        event.currentTarget.addEventListener("pointercancel", up);
      }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Open Devices and add a slice.</p>
        ) : (
          <div
            data-testid="banner"
            className="absolute rounded-lg border border-dashed border-primary/50 bg-background/80"
            style={{
              width: bannerWidth,
              height: bannerHeight + 28,
              transform: `translate(${banner.x}px, ${banner.y}px)`,
            }}
          >
            <div
              className="flex h-7 cursor-grab items-center px-2 text-xs text-muted-foreground active:cursor-grabbing"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: banner.x,
                  originY: banner.y,
                });
              }}
              onPointerMove={(event) => {
                if (drag === null || drag.pointerId !== event.pointerId) return;
                setLive({
                  x: Math.round(drag.originX + (event.clientX - drag.startX) / zoom),
                  y: Math.round(drag.originY + (event.clientY - drag.startY) / zoom),
                });
              }}
              onPointerUp={release}
              onPointerCancel={(event) => {
                if (drag === null || drag.pointerId !== event.pointerId) return;
                setDrag(null);
                setLive(null);
              }}
            >
              Banner · drag here · Esc releases
            </div>
            {slices.map((slice, index) => {
              const selected = slice.frame.id === selectedId;
              return (
                <button
                  key={slice.frame.id}
                  type="button"
                  data-testid={`frame-${slice.frame.id}`}
                  className={
                    selected
                      ? "absolute border-l border-primary bg-background text-left"
                      : "absolute border-l border-border bg-background text-left"
                  }
                  style={{
                    left: slice.left,
                    top: 28,
                    width: slice.size.width,
                    height: slice.size.height,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(slice.frame.id)}
                >
                  <span className="flex h-full flex-col justify-between p-3">
                    <span className="text-sm font-medium">
                      {index + 1}. {slice.frame.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {slice.frame.width}×{slice.frame.height}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

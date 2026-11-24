import { lazy, Suspense, useEffect, useState } from "react";

import type { StudioMenuActions } from "@/components/studio-context-menu";
import type { AssetRow, BoardRow, StudioNode } from "@/lib/studio";

const StudioStage = lazy(async () => {
  const module = await import("./studio-stage");
  return { default: module.StudioStage };
});

export interface CanvasHostProps extends StudioMenuActions {
  board: BoardRow;
  nodes: StudioNode[];
  assets: AssetRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveCollection: (id: string, x: number, y: number) => void;
  onTransform: (
    id: string,
    next: { x: number; y: number; width: number; height: number; rotation: number },
  ) => void;
}

export function CanvasHost(props: CanvasHostProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Loading canvas…
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          Loading canvas…
        </div>
      }
    >
      <StudioStage {...props} />
    </Suspense>
  );
}

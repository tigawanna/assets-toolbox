export type StoreName = "play" | "app-store";
export type EventKind = "add" | "move" | "remove";

/** A screenshot holder. Position is canvas pixels, not device pixels. */
export interface FrameRow {
  id: string;
  store: StoreName;
  presetId: string;
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

/** One finished gesture, stored as its own SQLite row. */
export interface EventRow {
  id: string;
  seq: number;
  ts: string;
  kind: EventKind;
  label: string;
  frameId: string;
  x: number;
  y: number;
  store: StoreName;
  presetId: string;
  frameLabel: string;
  width: number;
  height: number;
}

export interface StudioSnapshot {
  frames: FrameRow[];
  events: EventRow[];
}

export function nextPosition(count: number): { x: number; y: number } {
  const column = count % 4;
  return { x: 64 + column * 56, y: 64 + column * 40 };
}

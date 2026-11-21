import { eq } from "drizzle-orm";

import { type EventRow, type FrameRow, type StoreName, type StudioSnapshot } from "@/lib/events";
import { findPreset } from "@/lib/presets";

import { defaultDatabasePath, openStudio, type StudioDb } from "./connection";
import { findFrame, frameCount, latestSeq, readSnapshot } from "./queries";
import { events, frames } from "./schema";

function eventFor(seq: number, kind: EventRow["kind"], label: string, frame: FrameRow): EventRow {
  return {
    id: crypto.randomUUID(),
    seq,
    ts: new Date().toISOString(),
    kind,
    label,
    frameId: frame.id,
    x: frame.x,
    y: frame.y,
    store: frame.store,
    presetId: frame.presetId,
    frameLabel: frame.label,
    width: frame.width,
    height: frame.height,
  };
}

function change(database: StudioDb, work: (tx: StudioDb) => void): StudioSnapshot {
  database.transaction((tx) => {
    work(tx as unknown as StudioDb);
  });
  return readSnapshot(database);
}

export function addFrame(store: StoreName, presetId: string, path = defaultDatabasePath()): StudioSnapshot {
  const preset = findPreset(store, presetId);
  if (preset === undefined) throw new Error(`Unknown preset ${store}/${presetId}`);
  const database = openStudio(path);
  return change(database, (tx) => {
    const position = { x: 64 + frameCount(tx) * 300, y: 64 };
    const frame: FrameRow = {
      id: crypto.randomUUID(),
      store: preset.store,
      presetId: preset.id,
      label: preset.label,
      width: preset.width,
      height: preset.height,
      x: position.x,
      y: position.y,
    };
    tx.insert(frames).values(frame).run();
    tx.insert(events).values(eventFor(latestSeq(tx) + 1, "add", `Add ${preset.label}`, frame)).run();
  });
}

export function moveFrames(
  updates: { id: string; x: number; y: number }[],
  path = defaultDatabasePath(),
): StudioSnapshot {
  if (updates.length === 0) throw new Error("A banner move needs at least one frame");
  const database = openStudio(path);
  return change(database, (tx) => {
    let seq = latestSeq(tx);
    for (const update of updates) {
      if (!Number.isFinite(update.x) || !Number.isFinite(update.y)) {
        throw new Error("Position must be finite");
      }
      const current = findFrame(tx, update.id);
      if (current === undefined) throw new Error(`Unknown frame ${update.id}`);
      const next = { ...current, x: update.x, y: update.y };
      tx.update(frames).set({ x: update.x, y: update.y }).where(eq(frames.id, update.id)).run();
      seq += 1;
      tx.insert(events)
        .values(eventFor(seq, "move", `Move banner`, next))
        .run();
    }
  });
}

export function moveFrame(id: string, x: number, y: number, path = defaultDatabasePath()): StudioSnapshot {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Position must be finite");
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = findFrame(tx, id);
    if (current === undefined) throw new Error(`Unknown frame ${id}`);
    const next = { ...current, x, y };
    tx.update(frames).set({ x, y }).where(eq(frames.id, id)).run();
    tx.insert(events).values(eventFor(latestSeq(tx) + 1, "move", `Move ${current.label}`, next)).run();
  });
}

export function removeFrame(id: string, path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = findFrame(tx, id);
    if (current === undefined) throw new Error(`Unknown frame ${id}`);
    tx.insert(events).values(eventFor(latestSeq(tx) + 1, "remove", `Remove ${current.label}`, current)).run();
    tx.delete(frames).where(eq(frames.id, id)).run();
  });
}

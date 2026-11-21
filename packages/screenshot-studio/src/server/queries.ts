import { asc, count, eq, max } from "drizzle-orm";

import type { EventRow, FrameRow, StudioSnapshot } from "@/lib/events";

import { defaultDatabasePath, openStudio, type StudioDb } from "./connection";
import { events, frames } from "./schema";

function asFrame(row: typeof frames.$inferSelect): FrameRow {
  return row as FrameRow;
}

function asEvent(row: typeof events.$inferSelect): EventRow {
  return row as EventRow;
}

export function listFrames(database: StudioDb): FrameRow[] {
  return database.select().from(frames).all().map(asFrame);
}

export function listEvents(database: StudioDb): EventRow[] {
  return database.select().from(events).orderBy(asc(events.seq)).all().map(asEvent);
}

export function findFrame(database: StudioDb, id: string): FrameRow | undefined {
  const row = database.select().from(frames).where(eq(frames.id, id)).get();
  return row === undefined ? undefined : asFrame(row);
}

export function frameCount(database: StudioDb): number {
  const row = database.select({ total: count() }).from(frames).get();
  return row?.total ?? 0;
}

export function latestSeq(database: StudioDb): number {
  const row = database.select({ latest: max(events.seq) }).from(events).get();
  return row?.latest ?? 0;
}

export function readSnapshot(database: StudioDb): StudioSnapshot {
  return { frames: listFrames(database), events: listEvents(database) };
}

export function readStudio(path = defaultDatabasePath()): StudioSnapshot {
  return readSnapshot(openStudio(path));
}

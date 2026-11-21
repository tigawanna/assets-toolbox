import { createCollection, localOnlyCollectionOptions, queryOnce } from "@tanstack/db";

import type { EventRow, FrameRow, StudioSnapshot } from "@/lib/events";

export const framesCollection = createCollection(
  localOnlyCollectionOptions<FrameRow, string>({
    id: "studio-frames",
    getKey: (frame) => frame.id,
  }),
);

export const eventsCollection = createCollection(
  localOnlyCollectionOptions<EventRow, string>({
    id: "studio-events",
    getKey: (event) => event.id,
  }),
);

async function clear(collection: typeof framesCollection | typeof eventsCollection): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: collection }).select(({ row }) => ({ id: row.id })),
  );
  for (const row of current) await collection.delete(row.id).when("settled");
}

/** Replace the in-memory collections with the snapshot the server just wrote. */
export async function applySnapshot(snapshot: StudioSnapshot): Promise<void> {
  await clear(framesCollection);
  await clear(eventsCollection);
  for (const frame of snapshot.frames) await framesCollection.insert(frame).when("settled");
  for (const event of snapshot.events) await eventsCollection.insert(event).when("settled");
}

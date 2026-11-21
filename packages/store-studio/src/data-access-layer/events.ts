import { diffDocuments, isEventRecord, type EventLog } from "../model/events";
import type { StudioProject } from "../model/schema";
import { getHost } from "./host";

let queue: Promise<void> = Promise.resolve();
let lastSeq = 0;
let counter = 0;

export interface EventMeta {
  actor?: string | undefined;
  label?: string | undefined;
}

/** Seed the sequence from a log read at startup so new events continue it. */
export function initEvents(log: EventLog | null): void {
  lastSeq = log === null ? 0 : (log.records.filter(isEventRecord).at(-1)?.seq ?? 0);
}

/**
 * Append one event per finished gesture. Appends are serialized so a patch is
 * always applied to the document state it was computed from.
 */
export function recordEvent(
  before: StudioProject,
  after: StudioProject,
  meta: EventMeta = {},
): Promise<void> {
  const patch = diffDocuments(before, after);
  if (patch.length === 0) return Promise.resolve();
  counter += 1;
  const input = {
    id: `${Date.now().toString(36)}-${counter}`,
    ts: new Date().toISOString(),
    actor: meta.actor ?? "editor",
    label: meta.label ?? "edit",
    parentSeq: lastSeq,
    patch,
  };
  queue = queue
    .then(async () => {
      const record = await getHost().appendEvent(input);
      lastSeq = record.seq;
    })
    .catch((error: unknown) => {
      console.warn("Could not append an event to the edit log:", error);
    });
  return queue;
}

/** Test helper: wait until all queued appends have finished. */
export function flushEvents(): Promise<void> {
  return queue;
}

export function resetEventQueue(): void {
  queue = Promise.resolve();
  lastSeq = 0;
}

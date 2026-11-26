// @vitest-environment jsdom

import { queryOnce } from "@tanstack/db";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { clearStudio, eventsCollection, mergeSnapshot } from "../src/lib/studio-collections";
import { defaultBoard, type StudioSnapshot } from "../src/lib/studio";

function snapshot(): StudioSnapshot {
  return {
    board: defaultBoard("Concurrent"),
    nodes: [],
    assets: [],
    events: [
      {
        id: "same-event",
        seq: 1,
        ts: "2026-11-26T10:00:00.000Z",
        kind: "board",
        label: "Update board",
        nodeId: "board",
        x: 0,
        y: 0,
        detail: "{}",
      },
    ],
  };
}

beforeEach(async () => {
  await clearStudio();
});

describe("studio collection snapshots", () => {
  it("serializes overlapping merges and inserts an event only once", async () => {
    const value = snapshot();
    await expect(Promise.all([mergeSnapshot(value), mergeSnapshot(value)])).resolves.toEqual([
      undefined,
      undefined,
    ]);

    const events = await queryOnce((q) => q.from({ event: eventsCollection }));
    expect(events.map((event) => event.id)).toEqual(["same-event"]);
  });
});

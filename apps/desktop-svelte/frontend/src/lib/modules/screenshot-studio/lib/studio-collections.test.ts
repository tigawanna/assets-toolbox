// @vitest-environment jsdom

import { queryOnce } from "@tanstack/db";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { defaultBoard, type EventRow, type StudioNode, type StudioSnapshot } from "@/lib/studio";
import {
  applySnapshot,
  assetsCollection,
  boardCollection,
  clearStudio,
  eventsCollection,
  mergeSnapshot,
  nodesCollection,
} from "./studio-collections";

function node(id: string): StudioNode {
  return {
    id,
    name: id,
    type: "text",
    text: id,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fontSize: 24,
    fontWeight: 600,
    align: "left",
    color: "#ffffff",
  };
}

function event(id: string, seq: number): EventRow {
  return {
    id,
    seq,
    ts: new Date(seq * 1_000).toISOString(),
    kind: "add",
    label: id,
    nodeId: id,
    x: 0,
    y: 0,
    detail: "",
  };
}

function snapshot(name: string, nodeIds: string[], eventIds: string[]): StudioSnapshot {
  return {
    board: defaultBoard(name),
    nodes: nodeIds.map(node),
    events: eventIds.map((id, index) => event(id, index + 1)),
    assets: [],
  };
}

type StudioCollection =
  | typeof boardCollection
  | typeof nodesCollection
  | typeof eventsCollection
  | typeof assetsCollection;

async function ids(collection: StudioCollection): Promise<string[]> {
  const rows = await queryOnce((q) =>
    q.from({ row: collection }).select(({ row }) => ({ id: row.id })),
  );
  return rows.map((row) => row.id);
}

beforeEach(async () => {
  await clearStudio();
});

afterEach(async () => {
  await clearStudio();
});

describe("studio collection snapshots", () => {
  it("clears every collection when applying a snapshot", async () => {
    await applySnapshot(snapshot("Old", ["old-node"], ["old-event"]));
    await applySnapshot(snapshot("New", ["new-node"], ["new-event"]));

    expect(await ids(boardCollection)).toEqual(["board"]);
    expect(await ids(nodesCollection)).toEqual(["new-node"]);
    expect(await ids(eventsCollection)).toEqual(["new-event"]);
    expect(await ids(assetsCollection)).toEqual([]);
  });

  it("serializes apply and clear through the same queue", async () => {
    const first = snapshot("First", ["first-node"], ["first-event"]);
    const second = snapshot("Second", ["second-node"], ["second-event"]);

    await Promise.all([applySnapshot(first), applySnapshot(second)]);
    expect(await ids(nodesCollection)).toEqual(["second-node"]);
    expect(await ids(eventsCollection)).toEqual(["second-event"]);

    await Promise.all([mergeSnapshot(first), clearStudio()]);
    expect(await ids(boardCollection)).toEqual([]);
    expect(await ids(nodesCollection)).toEqual([]);
    expect(await ids(eventsCollection)).toEqual([]);
    expect(await ids(assetsCollection)).toEqual([]);
  });

  it("inserts duplicate events only once during concurrent merges", async () => {
    const shared = event("shared", 1);
    const first = snapshot("First", ["first-node"], [shared.id, "first-event"]);
    const second = snapshot("Second", ["second-node"], [shared.id, shared.id, "second-event"]);

    await Promise.all([mergeSnapshot(first), mergeSnapshot(second)]);

    const eventIds = await ids(eventsCollection);
    expect(eventIds.filter((id) => id === shared.id)).toHaveLength(1);
    expect(eventIds).toContain("first-event");
    expect(eventIds).toContain("second-event");
    expect(await ids(nodesCollection)).toEqual(["second-node"]);
  });
});

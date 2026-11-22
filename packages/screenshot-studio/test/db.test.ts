import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { parseEventSnapshot, writeBoardFill } from "../src/lib/studio";
import { closeStudio, openStudio } from "../src/server/connection";
import { listEvents } from "../src/server/queries";
import { events } from "../src/server/schema";
import {
  addDevice,
  addDevicePair,
  applyBoardStore,
  cloneCollection,
  duplicateNode,
  duplicateSlices,
  removeNode,
  removeSlices,
  undoLast,
  updateBoard,
  updateNode,
} from "../src/server/mutations";
import { readStudio } from "../src/server/queries";

const dirs: string[] = [];

function databasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "screenshot-studio-"));
  dirs.push(dir);
  return join(dir, "studio.sqlite");
}

afterEach(() => {
  const created = dirs.splice(0);
  for (const dir of created) closeStudio(join(dir, "studio.sqlite"));
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("studio event log", () => {
  it("records an add, a move, and a remove", () => {
    const path = databasePath();
    const added = addDevice("phone-punch", 0, path);
    const node = added.nodes[0];
    expect(node).toBeDefined();
    expect(node?.type).toBe("device");
    expect(added.board.sliceCount).toBe(5);
    expect(added.assets).toEqual([]);
    expect(added.events).toHaveLength(1);

    updateNode(node!.id, { x: 420, y: 180 }, "Move", "move", path);
    const moved = readStudio(path);
    expect(moved.nodes[0]?.x).toBe(420);
    expect(moved.nodes[0]?.y).toBe(180);
    expect(moved.events.map((event) => event.kind)).toEqual(["add", "move"]);

    removeNode(node!.id, path);
    const removed = readStudio(path);
    expect(removed.nodes).toHaveLength(0);
    expect(removed.events.map((event) => event.kind)).toEqual(["add", "move", "remove"]);
  });

  it("renames the board", () => {
    const path = databasePath();
    const next = updateBoard({ name: "  Hero phones  " }, path);
    expect(next.board.name).toBe("Hero phones");
    expect(next.events.at(-1)?.label).toBe("Rename Hero phones");
  });

  it("stores a fill that covers two slices", () => {
    const path = databasePath();
    updateBoard(
      {
        background: writeBoardFill({
          color: "#2a332c",
          bands: [{ id: "band-a", start: 0, count: 2, color: "#ff7700" }],
        }),
      },
      path,
    );
    const loaded = readStudio(path);
    expect(JSON.parse(loaded.board.background)).toMatchObject({
      color: "#2a332c",
      bands: [{ id: "band-a", start: 0, count: 2, color: "#ff7700" }],
    });
  });

  it("deletes a middle slice and shifts the later device", () => {
    const path = databasePath();
    const first = addDevice("phone-punch", 0, path).nodes[0];
    const second = addDevice("phone-punch", 2, path).nodes.find((node) => node.id !== first?.id);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const before = second!.x;
    const next = removeSlices(1, 1, path);
    expect(next.board.sliceCount).toBe(4);
    expect(next.nodes.map((node) => node.id)).toEqual([first!.id, second!.id]);
    expect(next.nodes.find((node) => node.id === second!.id)?.x).toBeLessThan(before);
    expect(next.events.at(-1)?.label).toBe("Delete slice 2");
  });

  it("duplicates a device onto the next slice", () => {
    const path = databasePath();
    const original = addDevice("phone-punch", 0, path).nodes[0]!;
    const copied = duplicateNode(original.id, path);
    expect(copied.nodes).toHaveLength(2);
    const clone = copied.nodes.find((node) => node.id === copied.nodeId);
    expect(clone?.x).toBeGreaterThan(original.x);
    expect(clone?.name).toBe(`${original.name} copy`);
  });

  it("duplicates a slice and the device sitting in it", () => {
    const path = databasePath();
    addDevice("phone-punch", 0, path);
    const next = duplicateSlices(0, 1, path);
    expect(next.board.sliceCount).toBe(6);
    expect(next.nodes).toHaveLength(2);
    expect(next.events.at(-1)?.label).toBe("Duplicate slice 1");
  });

  it("stacks an Android and Apple phone on the same slice", () => {
    const path = databasePath();
    const next = addDevicePair("phone-punch", "iphone-island", 0, path);
    expect(next.nodes).toHaveLength(2);
    const android = next.nodes.find(
      (node) => node.type === "device" && node.model === "phone-punch",
    );
    const apple = next.nodes.find(
      (node) => node.type === "device" && node.model === "iphone-island",
    );
    expect(android).toBeDefined();
    expect(apple).toBeDefined();
    expect(apple!.z).toBeGreaterThan(android!.z ?? 0);
    expect(apple!.x).toBeGreaterThan(android!.x);
    expect(parseEventSnapshot(next.events[0]!.detail)).not.toBeNull();
  });

  it("undoes the last event and restores the previous snapshot", () => {
    const path = databasePath();
    expect(undoLast(path).events).toHaveLength(0);

    const first = addDevice("phone-punch", 0, path);
    const second = addDevice("iphone-island", 0, path);
    expect(second.nodes).toHaveLength(2);

    const undone = undoLast(path);
    expect(undone.nodes).toHaveLength(1);
    expect(undone.nodes[0]?.id).toBe(first.nodes[0]?.id);
    expect(undone.events).toHaveLength(1);

    const empty = undoLast(path);
    expect(empty.nodes).toHaveLength(0);
    expect(empty.events).toHaveLength(0);
    expect(empty.board.name).toBe("Untitled");
  });

  it("undoes a stacked pair even if the previous event has no snapshot", () => {
    const path = databasePath();
    const first = addDevice("tablet", 0, path);
    addDevicePair("phone-punch", "iphone-island", 0, path);
    const database = openStudio(path);
    const prior = listEvents(database)[0];
    expect(prior).toBeDefined();
    database.update(events).set({ detail: "{}" }).where(eq(events.id, prior!.id)).run();
    const undone = undoLast(path);
    expect(undone.nodes).toHaveLength(1);
    expect(undone.nodes[0]?.id).toBe(first.nodes[0]?.id);
    expect(undone.events).toHaveLength(1);
  });

  it("applies Apple listing rules to the current board", () => {
    const path = databasePath();
    addDevice("phone-punch", 0, path);
    const next = applyBoardStore("app-store", path);
    expect(next.board.store).toBe("app-store");
    expect(next.board.presetId).toBe("iphone-6-9");
    expect(next.nodes[0]?.type).toBe("device");
    if (next.nodes[0]?.type === "device") expect(next.nodes[0].model).toBe("iphone-island");
  });

  it("clones a scene strip onto the same board", () => {
    const path = databasePath();
    addDevice("phone-punch", 0, path);
    const next = cloneCollection("col-main", "app-store", path);
    expect(next.board.collections).toHaveLength(2);
    expect(next.board.store).toBe("play");
    expect(next.board.collections?.[1]?.store).toBe("app-store");
    expect(next.board.collections?.[1]?.name).toBe("Scenes · Apple");
    expect(next.nodes).toHaveLength(2);
    expect(new Set(next.nodes.map((node) => node.collectionId)).size).toBe(2);
  });
});

// @vitest-environment jsdom

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vite-plus/test";

import { resetProjectStorage } from "./project-db";
import {
  addText,
  cloneBoard,
  createBoard,
  deleteBoard,
  listBoards,
  loadStudio,
  patchNode,
  renameBoard,
  undoEvent,
} from "./fns";

beforeEach(async () => {
  localStorage.clear();
  await resetProjectStorage();
});

describe("browser-local Screenshot Studio adapter", () => {
  it("creates, lists, loads, and deletes boards", async () => {
    const created = await createBoard({ data: { name: "Launch board" } });
    expect(created.name).toBe("Launch board");
    expect((await listBoards()).map((board) => board.id)).toEqual([created.id]);
    expect(localStorage.length).toBe(0);

    const snapshot = await loadStudio({ data: { projectId: created.id } });
    expect(snapshot.board.name).toBe("Launch board");
    expect(snapshot.nodes).toEqual([]);

    await deleteBoard({ data: { projectId: created.id } });
    expect(await listBoards()).toEqual([]);
  });

  it("adds layers with restore snapshots and undoes one step", async () => {
    const board = await createBoard({ data: { name: "Layers" } });
    const first = await addText({
      data: { projectId: board.id, role: "headline" },
    });
    expect(first.nodes).toHaveLength(1);
    expect(first.events).toHaveLength(1);
    expect(first.events[0]?.nodeId).toBe(first.nodes[0]?.id);

    const second = await addText({
      data: { projectId: board.id, role: "subtext" },
    });
    expect(second.nodes).toHaveLength(2);

    const undone = await undoEvent({ data: { projectId: board.id } });
    expect(undone.nodes).toHaveLength(1);
    expect(undone.events).toHaveLength(1);
    expect(undone.nodes[0]?.id).toBe(first.nodes[0]?.id);
  });

  it("patches nodes without changing their identity", async () => {
    const board = await createBoard({ data: { name: "Editing" } });
    const snapshot = await addText({
      data: { projectId: board.id, role: "headline" },
    });
    const node = snapshot.nodes[0]!;

    const patched = await patchNode({
      data: {
        projectId: board.id,
        id: node.id,
        patch: { x: 120, text: "Updated headline" },
        label: "Edit headline",
      },
    });

    expect(patched.nodes[0]).toMatchObject({
      id: node.id,
      type: node.type,
      x: 120,
      text: "Updated headline",
    });
  });

  it("serializes concurrent mutations without losing layers or history", async () => {
    const board = await createBoard({ data: { name: "Concurrent" } });
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        addText({
          data: {
            projectId: board.id,
            role: index % 2 === 0 ? "headline" : "subtext",
          },
        }),
      ),
    );

    const snapshot = await loadStudio({ data: { projectId: board.id } });
    expect(snapshot.nodes).toHaveLength(12);
    expect(new Set(snapshot.nodes.map((node) => node.id)).size).toBe(12);
    expect(snapshot.events.map((event) => event.seq)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  it("renames boards and strips without adding undo events", async () => {
    const board = await createBoard({ data: { name: "Before rename" } });
    await addText({ data: { projectId: board.id, role: "headline" } });
    await addText({ data: { projectId: board.id, role: "subtext" } });
    const collectionId = (await loadStudio({ data: { projectId: board.id } })).board
      .collections![0]!.id;

    const renamed = await renameBoard({
      data: { projectId: board.id, name: "After rename" },
    });
    expect(renamed.events).toHaveLength(2);
    expect(renamed.board.name).toBe("After rename");

    const stripRenamed = await renameBoard({
      data: { projectId: board.id, collectionId, name: "Renamed scenes" },
    });
    expect(stripRenamed.events).toHaveLength(2);
    expect(stripRenamed.board.collections?.[0]?.name).toBe("Renamed scenes");

    const undone = await undoEvent({ data: { projectId: board.id } });
    expect(undone.nodes).toHaveLength(1);
    expect(undone.board.name).toBe("After rename");
    expect(undone.board.collections?.[0]?.name).toBe("Renamed scenes");
  });

  it("clones board content with fresh history", async () => {
    const board = await createBoard({ data: { name: "Original" } });
    await addText({ data: { projectId: board.id, role: "headline" } });

    const cloned = await cloneBoard({ data: { projectId: board.id } });
    expect(cloned.id).not.toBe(board.id);
    expect(cloned.name).toBe("Original copy");

    const snapshot = await loadStudio({ data: { projectId: cloned.id } });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.seq).toBe(1);
  });
});

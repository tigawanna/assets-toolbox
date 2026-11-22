import { desc, eq } from "drizzle-orm";

import { duplicateSliceRange, removeSliceRange } from "@/lib/bands";
import {
  boardFillFor,
  cloneNode,
  createAsset,
  createDeviceNode,
  createShapeNode,
  createTextNode,
  defaultBoard,
  MAX_SLICES,
  nextStackZ,
  nodeZ,
  parseEventSnapshot,
  writeBoardFill,
  type BoardRow,
  type EventKind,
  type EventRow,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";
import type { DeviceModelId } from "@/devices/catalog";
import { findPreset, type StoreName } from "@/lib/presets";
import {
  applyStoreToCollection,
  cloneSceneCollection,
  storeLabel,
} from "@/lib/store-rules";
import {
  boardCollections,
  collectionAsBoard,
  collectionFrame,
  findCollection,
  nodesInCollection,
  patchCollection,
  removeSceneCollection,
  writeCollectionFill,
} from "@/lib/scenes";

import { defaultDatabasePath, openStudio, pathOfStudio, type StudioDb } from "./connection";
import { projectIdFromDatabasePath, publishLive } from "./live";
import {
  findNode,
  latestSeq,
  listEvents,
  listNodes,
  readBoard,
  readSnapshot,
  serializeBoard,
} from "./queries";
import { assets, boards, events, nodes } from "./schema";

function eventFor(
  seq: number,
  kind: EventKind,
  label: string,
  node: { id: string; x: number; y: number },
  detail = "",
): EventRow {
  return {
    id: crypto.randomUUID(),
    seq,
    ts: new Date().toISOString(),
    kind,
    label,
    nodeId: node.id,
    x: node.x,
    y: node.y,
    detail,
  };
}

function detailObject(detail: string): Record<string, unknown> {
  if (detail === "") return {};
  try {
    const parsed = JSON.parse(detail) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { note: detail };
  } catch {
    return { note: detail };
  }
}

function stampEventSnapshot(tx: StudioDb): void {
  const last = tx.select().from(events).orderBy(desc(events.seq)).get();
  if (last === undefined) return;
  const snapshot = { board: readBoard(tx), nodes: listNodes(tx) };
  const extra = detailObject(last.detail);
  tx.update(events)
    .set({ detail: JSON.stringify({ ...extra, ...snapshot }) })
    .where(eq(events.id, last.id))
    .run();
}

function ensureLastSnapshot(tx: StudioDb): void {
  const last = tx.select().from(events).orderBy(desc(events.seq)).get();
  if (last === undefined) return;
  if (parseEventSnapshot(last.detail) !== null) return;
  stampEventSnapshot(tx);
}

function change(database: StudioDb, work: (tx: StudioDb) => void): StudioSnapshot {
  database.transaction((tx) => {
    ensureLastSnapshot(tx as unknown as StudioDb);
    work(tx as unknown as StudioDb);
    stampEventSnapshot(tx as unknown as StudioDb);
  });
  const snapshot = readSnapshot(database);
  const last = snapshot.events.at(-1);
  publishLive(
    projectIdFromDatabasePath(pathOfStudio(database)),
    last?.seq ?? 0,
    last?.label ?? "",
  );
  return snapshot;
}

function writeNode(tx: StudioDb, node: StudioNode): void {
  const body = JSON.stringify(node);
  const existing = tx.select().from(nodes).where(eq(nodes.id, node.id)).get();
  if (existing === undefined) tx.insert(nodes).values({ id: node.id, body }).run();
  else tx.update(nodes).set({ body }).where(eq(nodes.id, node.id)).run();
}

function writeBoard(tx: StudioDb, board: BoardRow): void {
  const values = serializeBoard(board);
  const existing = tx.select().from(boards).where(eq(boards.id, board.id)).get();
  if (existing === undefined) tx.insert(boards).values(values).run();
  else {
    const { id: _id, ...columns } = values;
    tx.update(boards).set(columns).where(eq(boards.id, board.id)).run();
  }
}

function currentBoard(tx: StudioDb): BoardRow {
  const existing = tx.select().from(boards).get();
  if (existing === undefined) {
    const board = defaultBoard();
    writeBoard(tx, board);
    return board;
  }
  return readBoard(tx);
}

function frameFor(board: BoardRow, collectionId?: string) {
  const collection = findCollection(board, collectionId);
  return { collection, frame: collectionAsBoard(board, collection) };
}

export function addDevice(
  model: DeviceModelId,
  slice = 0,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { frame, collection } = frameFor(board, collectionId);
    const node = {
      ...createDeviceNode(model, frame, slice),
      collectionId: collection.id,
      z: nextStackZ(listNodes(tx)),
    };
    writeNode(tx, node);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "add", `Add ${node.name}`, node))
      .run();
  });
}

export function addText(
  role: "headline" | "subtext",
  slice = 0,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { frame, collection } = frameFor(board, collectionId);
    const node = {
      ...createTextNode(frame, role, slice),
      collectionId: collection.id,
      z: nextStackZ(listNodes(tx)),
    };
    writeNode(tx, node);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "add", `Add ${node.name}`, node))
      .run();
  });
}

export function addShape(
  slice = 0,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { frame, collection } = frameFor(board, collectionId);
    const node = {
      ...createShapeNode(frame, slice),
      collectionId: collection.id,
      z: nextStackZ(listNodes(tx)),
    };
    writeNode(tx, node);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "add", `Add ${node.name}`, node))
      .run();
  });
}

export function updateNode(
  id: string,
  patch: Record<string, unknown>,
  label: string,
  kind: EventKind = "edit",
  path = defaultDatabasePath(),
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = findNode(tx, id);
    if (current === undefined) throw new Error(`Unknown node ${id}`);
    const next = { ...current, ...patch, id: current.id, type: current.type } as StudioNode;
    writeNode(tx, next);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, kind, label, next, JSON.stringify(patch)))
      .run();
  });
}

export function removeNode(id: string, path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = findNode(tx, id);
    if (current === undefined) throw new Error(`Unknown node ${id}`);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "remove", `Remove ${current.name}`, current))
      .run();
    tx.delete(nodes).where(eq(nodes.id, id)).run();
  });
}

export function addAsset(
  name: string,
  mime: string,
  data: string,
  path = defaultDatabasePath(),
): StudioSnapshot & { assetId: string } {
  if (!data.startsWith("data:")) throw new Error("Assets must be data URLs");
  const database = openStudio(path);
  const asset = createAsset(name, mime, data);
  const snapshot = change(database, (tx) => {
    tx.insert(assets).values(asset).run();
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "edit", `Import ${name}`, { id: asset.id, x: 0, y: 0 }))
      .run();
  });
  return { ...snapshot, assetId: asset.id };
}

export function duplicateNode(
  id: string,
  path = defaultDatabasePath(),
): StudioSnapshot & { nodeId: string } {
  const database = openStudio(path);
  let nodeId = "";
  const snapshot = change(database, (tx) => {
    const current = findNode(tx, id);
    if (current === undefined) throw new Error(`Unknown node ${id}`);
    const board = currentBoard(tx);
    const { collection } = frameFor(board, current.collectionId);
    const preset = collectionFrame(collection);
    const nextX = current.x + preset.width;
    const fits = nextX + Math.min(current.width, preset.width) <= preset.width * collection.sliceCount;
    const copy = {
      ...cloneNode(current, fits ? preset.width : 48, fits ? 0 : 48),
      z: nextStackZ(listNodes(tx)),
    };
    nodeId = copy.id;
    writeNode(tx, copy);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "add", `Duplicate ${current.name}`, copy))
      .run();
  });
  return { ...snapshot, nodeId };
}

export function duplicateSlices(
  start: number,
  count = 1,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { collection } = frameFor(board, collectionId);
    const srcStart = Math.max(0, Math.min(collection.sliceCount - 1, Math.floor(start)));
    const srcCount = Math.max(1, Math.min(Math.floor(count), collection.sliceCount - srcStart));
    if (collection.sliceCount + srcCount > MAX_SLICES) {
      throw new Error(`At most ${MAX_SLICES} slices`);
    }
    const filled = writeCollectionFill(collection);
    const fill = boardFillFor({ ...board, ...filled });
    const preset = collectionFrame(collection);
    const insertAt = srcStart + srcCount;
    const originalCount = collection.sliceCount;
    const nextCollection = writeCollectionFill({
      ...collection,
      sliceCount: originalCount + srcCount,
      background: writeBoardFill({
        ...fill,
        bands: duplicateSliceRange(fill.bands, srcStart, srcCount, originalCount),
      }),
    });
    writeBoard(tx, patchCollection(board, collection.id, nextCollection));
    const shift = srcCount * preset.width;
    const fallback = boardCollections(board)[0]?.id ?? collection.id;
    for (const node of nodesInCollection(listNodes(tx), collection.id, fallback)) {
      const index = Math.floor((node.x + node.width / 2) / preset.width);
      if (index >= insertAt) writeNode(tx, { ...node, x: node.x + shift });
      if (index >= srcStart && index < insertAt) {
        writeNode(tx, {
          ...cloneNode(node, shift, 0),
          collectionId: collection.id,
          z: nextStackZ(listNodes(tx)),
        });
      }
    }
    const label =
      srcCount === 1
        ? `Duplicate slice ${srcStart + 1}`
        : `Duplicate slices ${srcStart + 1}–${srcStart + srcCount}`;
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          label,
          { id: board.id, x: 0, y: 0 },
          JSON.stringify({ start: srcStart, count: srcCount }),
        ),
      )
      .run();
  });
}

export function removeSlices(
  start: number,
  count = 1,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { collection } = frameFor(board, collectionId);
    const delStart = Math.max(0, Math.min(collection.sliceCount - 1, Math.floor(start)));
    const delCount = Math.max(1, Math.min(Math.floor(count), collection.sliceCount - delStart));
    const remaining = collection.sliceCount - delCount;
    if (remaining < 1) throw new Error("Keep at least one slice");
    const filled = writeCollectionFill(collection);
    const fill = boardFillFor({ ...board, ...filled });
    const preset = collectionFrame(collection);
    const originalCount = collection.sliceCount;
    const nextCollection = writeCollectionFill({
      ...collection,
      sliceCount: remaining,
      background: writeBoardFill({
        ...fill,
        bands: removeSliceRange(fill.bands, delStart, delCount, originalCount),
      }),
    });
    writeBoard(tx, patchCollection(board, collection.id, nextCollection));
    const delEnd = delStart + delCount;
    const shift = delCount * preset.width;
    const fallback = boardCollections(board)[0]?.id ?? collection.id;
    for (const node of nodesInCollection(listNodes(tx), collection.id, fallback)) {
      const index = Math.floor((node.x + node.width / 2) / preset.width);
      if (index >= delStart && index < delEnd) {
        tx.delete(nodes).where(eq(nodes.id, node.id)).run();
        continue;
      }
      if (index >= delEnd) writeNode(tx, { ...node, x: node.x - shift });
    }
    const label =
      delCount === 1
        ? `Delete slice ${delStart + 1}`
        : `Delete slices ${delStart + 1}–${delStart + delCount}`;
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          label,
          { id: board.id, x: 0, y: 0 },
          JSON.stringify({ start: delStart, count: delCount }),
        ),
      )
      .run();
  });
}

export function updateBoard(
  patch: Partial<BoardRow> & { collectionId?: string; x?: number; y?: number },
  path = defaultDatabasePath(),
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = currentBoard(tx);
    const collectionId = patch.collectionId;
    const { collectionId: _omit, x, y, ...rest } = patch;
    let board = current;
    if (collectionId !== undefined && collectionId !== "") {
      const collection = findCollection(current, collectionId);
      const next = writeCollectionFill({
        ...collection,
        name:
          rest.name !== undefined && rest.name.trim() !== "" ? rest.name.trim() : collection.name,
        store: rest.store ?? collection.store,
        presetId: rest.presetId ?? collection.presetId,
        sliceCount: rest.sliceCount ?? collection.sliceCount,
        background: rest.background ?? collection.background,
        ...(x === undefined ? {} : { x }),
        ...(y === undefined ? {} : { y }),
      });
      if (findPreset(next.store, next.presetId) === undefined) {
        throw new Error(`Unknown preset ${next.store}/${next.presetId}`);
      }
      board = patchCollection(current, collection.id, next);
    } else {
      board = { ...current, ...rest };
      if (findPreset(board.store, board.presetId) === undefined) {
        throw new Error(`Unknown preset ${board.store}/${board.presetId}`);
      }
      if (rest.store !== undefined || rest.presetId !== undefined || rest.sliceCount !== undefined || rest.background !== undefined) {
        const collection = findCollection(board);
        board = patchCollection(board, collection.id, writeCollectionFill({
          ...collection,
          store: rest.store ?? collection.store,
          presetId: rest.presetId ?? collection.presetId,
          sliceCount: rest.sliceCount ?? collection.sliceCount,
          background: rest.background ?? collection.background,
        }));
      }
      board.name = board.name.trim() === "" ? "Untitled" : board.name.trim();
    }
    writeBoard(tx, board);
    const moved = x !== undefined || y !== undefined;
    const renamed = rest.name !== undefined && !moved && Object.keys(rest).length === 1;
    const collection = collectionId === undefined ? undefined : findCollection(board, collectionId);
    let label = "Update board";
    if (moved) label = `Move ${collection?.name ?? "strip"}`;
    else if (renamed) label = `Rename ${collection?.name ?? board.name}`;
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          label,
          { id: board.id, x: 0, y: 0 },
          JSON.stringify(patch),
        ),
      )
      .run();
  });
}

export function reorderNodes(ids: string[], path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const current = listNodes(tx);
    const count = ids.length;
    for (const [index, id] of ids.entries()) {
      const node = current.find((item) => item.id === id);
      if (node === undefined) continue;
      writeNode(tx, { ...node, z: count - 1 - index });
    }
    const board = currentBoard(tx);
    tx.insert(events)
      .values(eventFor(latestSeq(tx) + 1, "edit", "Stack layers", { id: board.id, x: 0, y: 0 }))
      .run();
  });
}

export function restoreToSeq(seq: number, path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const all = listEvents(tx);
    const target = all.find((event) => event.seq === seq);
    if (target === undefined) throw new Error("Unknown event");
    const snapshot = parseEventSnapshot(target.detail);
    if (snapshot === null) throw new Error("This event has no restore point");
    writeBoard(tx, snapshot.board);
    const keep = new Set(snapshot.nodes.map((node) => node.id));
    for (const node of listNodes(tx)) {
      if (!keep.has(node.id)) tx.delete(nodes).where(eq(nodes.id, node.id)).run();
    }
    for (const node of snapshot.nodes) writeNode(tx, node);
    for (const event of all) {
      if (event.seq > seq) tx.delete(events).where(eq(events.id, event.id)).run();
    }
  });
}

export function addDevicePair(
  android: DeviceModelId,
  apple: DeviceModelId,
  slice = 0,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const board = currentBoard(tx);
    const { frame, collection } = frameFor(board, collectionId);
    const behind = {
      ...createDeviceNode(android, frame, slice),
      collectionId: collection.id,
      z: nextStackZ(listNodes(tx)),
    };
    writeNode(tx, behind);
    const front = {
      ...createDeviceNode(apple, frame, slice),
      collectionId: collection.id,
      x: behind.x + Math.round(behind.width * 0.28),
      y: behind.y + Math.round(behind.height * 0.08),
      z: behind.z + 1,
      screenColor: behind.screenColor,
      screenAssetId: behind.screenAssetId,
    };
    writeNode(tx, front);
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "add",
          `Stack ${behind.name} + ${front.name}`,
          front,
          JSON.stringify({ android, apple, ids: [behind.id, front.id] }),
        ),
      )
      .run();
  });
}

function revertLastAdd(tx: StudioDb, last: EventRow): void {
  const after = parseEventSnapshot(last.detail);
  const extra = detailObject(last.detail);
  const drop = new Set<string>([last.nodeId]);
  if (Array.isArray(extra.ids)) {
    for (const id of extra.ids) if (typeof id === "string") drop.add(id);
  }
  const source = after?.nodes ?? listNodes(tx);
  if (!Array.isArray(extra.ids) && typeof extra.android === "string") {
    const apple = source.find((node) => node.id === last.nodeId);
    const candidates = source.filter(
      (node) => node.type === "device" && node.model === extra.android && node.id !== last.nodeId,
    );
    const behind =
      apple === undefined
        ? candidates.at(-1)
        : (candidates.find((node) => nodeZ(node) === nodeZ(apple) - 1) ?? candidates.at(-1));
    if (behind !== undefined) drop.add(behind.id);
  }
  const kept = source.filter((node) => !drop.has(node.id));
  if (after?.board !== undefined) writeBoard(tx, after.board);
  for (const node of listNodes(tx)) {
    if (!kept.some((item) => item.id === node.id))
      tx.delete(nodes).where(eq(nodes.id, node.id)).run();
  }
  for (const node of kept) writeNode(tx, node);
  tx.delete(events).where(eq(events.id, last.id)).run();
}

export function applyBoardStore(
  store: StoreName,
  path = defaultDatabasePath(),
  collectionId?: string,
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const snapshot = readSnapshot(tx);
    const collection = findCollection(snapshot.board, collectionId);
    const next = applyStoreToCollection(snapshot.board, snapshot.nodes, collection.id, store);
    writeBoard(tx, next.board);
    const keep = new Set(next.nodes.map((node) => node.id));
    for (const node of listNodes(tx)) {
      if (!keep.has(node.id)) tx.delete(nodes).where(eq(nodes.id, node.id)).run();
    }
    for (const node of next.nodes) writeNode(tx, node);
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          `Apply ${storeLabel(store)} rules to ${collection.name}`,
          { id: next.board.id, x: 0, y: 0 },
          JSON.stringify({ store, collectionId: collection.id }),
        ),
      )
      .run();
  });
}

export function cloneCollection(
  collectionId: string,
  store?: StoreName,
  path = defaultDatabasePath(),
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const snapshot = readSnapshot(tx);
    const source = findCollection(snapshot.board, collectionId);
    const next = cloneSceneCollection(snapshot.board, snapshot.nodes, source.id, store);
    writeBoard(tx, next.board);
    for (const node of next.nodes) writeNode(tx, node);
    const added = boardCollections(next.board).at(-1);
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          store === undefined
            ? `Clone ${source.name}`
            : `Clone ${source.name} for ${storeLabel(store)}`,
          { id: next.board.id, x: 0, y: 0 },
          JSON.stringify({ from: source.id, collectionId: added?.id, store }),
        ),
      )
      .run();
  });
}

export function removeCollection(
  collectionId: string,
  path = defaultDatabasePath(),
): StudioSnapshot {
  const database = openStudio(path);
  return change(database, (tx) => {
    const snapshot = readSnapshot(tx);
    const source = findCollection(snapshot.board, collectionId);
    const next = removeSceneCollection(snapshot.board, snapshot.nodes, source.id);
    writeBoard(tx, next.board);
    const keep = new Set(next.nodes.map((node) => node.id));
    for (const node of snapshot.nodes) {
      if (!keep.has(node.id)) tx.delete(nodes).where(eq(nodes.id, node.id)).run();
    }
    tx.insert(events)
      .values(
        eventFor(
          latestSeq(tx) + 1,
          "board",
          `Delete ${source.name}`,
          { id: next.board.id, x: 0, y: 0 },
          JSON.stringify({ collectionId: source.id }),
        ),
      )
      .run();
  });
}

export function undoLast(path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  const all = listEvents(database);
  if (all.length === 0) return readSnapshot(database);
  if (all.length === 1) {
    return change(database, (tx) => {
      const name = currentBoard(tx).name;
      for (const node of listNodes(tx)) tx.delete(nodes).where(eq(nodes.id, node.id)).run();
      writeBoard(tx, defaultBoard(name));
      for (const event of listEvents(tx)) tx.delete(events).where(eq(events.id, event.id)).run();
    });
  }
  const previous = all[all.length - 2];
  const last = all[all.length - 1];
  if (previous === undefined || last === undefined) return readSnapshot(database);
  if (parseEventSnapshot(previous.detail) !== null) return restoreToSeq(previous.seq, path);
  if (last.kind === "add") return change(database, (tx) => revertLastAdd(tx, last));
  throw new Error("This event has no restore point");
}

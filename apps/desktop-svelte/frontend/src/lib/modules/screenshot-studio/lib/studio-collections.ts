import { createCollection, localOnlyCollectionOptions, queryOnce } from "@tanstack/db";

import {
  defaultBoard,
  type AssetRow,
  type BoardRow,
  type EventRow,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";

export const boardCollection = createCollection(
  localOnlyCollectionOptions<BoardRow, string>({
    id: "studio-board",
    getKey: (board) => board.id,
  }),
);

export const nodesCollection = createCollection(
  localOnlyCollectionOptions<StudioNode, string>({
    id: "studio-nodes",
    getKey: (node) => node.id,
  }),
);

export const eventsCollection = createCollection(
  localOnlyCollectionOptions<EventRow, string>({
    id: "studio-events",
    getKey: (event) => event.id,
  }),
);

export const assetsCollection = createCollection(
  localOnlyCollectionOptions<AssetRow, string>({
    id: "studio-assets",
    getKey: (asset) => asset.id,
  }),
);

type StudioCollection =
  | typeof boardCollection
  | typeof nodesCollection
  | typeof eventsCollection
  | typeof assetsCollection;

async function clear(collection: StudioCollection): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: collection }).select(({ row }) => ({ id: row.id })),
  );
  for (const row of current) await collection.delete(row.id).when("settled");
}

let collectionQueue: Promise<void> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = collectionQueue.then(work);
  collectionQueue = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function clearAll(): Promise<void> {
  await Promise.all([
    clear(boardCollection),
    clear(nodesCollection),
    clear(eventsCollection),
    clear(assetsCollection),
  ]);
}

async function merge(snapshot: StudioSnapshot): Promise<void> {
  await replaceBoardRow(snapshot.board ?? defaultBoard());
  await appendEventRows(snapshot.events);
  await Promise.all(snapshot.assets.map((asset) => replaceAssetRow(asset)));
  await pruneNodeRows(new Set(snapshot.nodes.map((node) => node.id)));
  await Promise.all(snapshot.nodes.map((node) => replaceNodeRow(node)));
}

async function apply(snapshot: StudioSnapshot): Promise<void> {
  await clearAll();
  await boardCollection.insert(snapshot.board ?? defaultBoard()).when("settled");
  await Promise.all([
    ...snapshot.nodes.map((node) => nodesCollection.insert(node).when("settled")),
    ...snapshot.events.map((event) => eventsCollection.insert(event).when("settled")),
    ...snapshot.assets.map((asset) => assetsCollection.insert(asset).when("settled")),
  ]);
}

export function clearStudio(): Promise<void> {
  return enqueue(clearAll);
}

export function mergeSnapshot(snapshot: StudioSnapshot): Promise<void> {
  return enqueue(() => merge(snapshot));
}

export function applySnapshot(snapshot: StudioSnapshot): Promise<void> {
  return enqueue(() => apply(snapshot));
}

async function replaceAssetRow(asset: AssetRow): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: assetsCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.some((row) => row.id === asset.id)) return;
  await assetsCollection.insert(asset).when("settled");
}

async function replaceNodeRow(node: StudioNode): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: nodesCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.some((row) => row.id === node.id)) {
    await nodesCollection
      .update(node.id, (draft) => {
        Object.assign(draft, node);
      })
      .when("settled");
  } else {
    await nodesCollection.insert(node).when("settled");
  }
}

async function pruneNodeRows(keep: Set<string>): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: nodesCollection }).select(({ row }) => ({ id: row.id })),
  );
  for (const row of current) {
    if (!keep.has(row.id)) await nodesCollection.delete(row.id).when("settled");
  }
}

async function replaceBoardRow(board: BoardRow): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: boardCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.length === 1 && current[0]?.id === board.id) {
    await boardCollection
      .update(board.id, (draft) => {
        Object.assign(draft, board);
      })
      .when("settled");
    return;
  }
  for (const row of current) await boardCollection.delete(row.id).when("settled");
  await boardCollection.insert(board).when("settled");
}

async function appendEventRows(all: EventRow[]): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: eventsCollection }).select(({ row }) => ({ id: row.id })),
  );
  const seen = new Set(current.map((row) => row.id));
  for (const event of all) {
    if (seen.has(event.id)) continue;
    await eventsCollection.insert(event).when("settled");
    seen.add(event.id);
  }
}

export function replaceAsset(asset: AssetRow): Promise<void> {
  return enqueue(() => replaceAssetRow(asset));
}

export function replaceNode(node: StudioNode): Promise<void> {
  return enqueue(() => replaceNodeRow(node));
}

export function dropNode(id: string): Promise<void> {
  return enqueue(async () => {
    await nodesCollection.delete(id).when("settled");
  });
}

export function pruneNodes(keep: Set<string>): Promise<void> {
  return enqueue(() => pruneNodeRows(keep));
}

export function replaceBoard(board: BoardRow): Promise<void> {
  return enqueue(() => replaceBoardRow(board));
}

export function appendEvents(all: EventRow[]): Promise<void> {
  return enqueue(() => appendEventRows(all));
}

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

async function clear(
  collection:
    | typeof boardCollection
    | typeof nodesCollection
    | typeof eventsCollection
    | typeof assetsCollection,
): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: collection }).select(({ row }) => ({ id: row.id })),
  );
  for (const row of current) await collection.delete(row.id).when("settled");
}

export async function clearStudio(): Promise<void> {
  await Promise.all([
    clear(boardCollection),
    clear(nodesCollection),
    clear(eventsCollection),
    clear(assetsCollection),
  ]);
}

export async function mergeSnapshot(snapshot: StudioSnapshot): Promise<void> {
  await replaceBoard(snapshot.board ?? defaultBoard());
  await appendEvents(snapshot.events);
  await Promise.all(snapshot.assets.map((asset) => replaceAsset(asset)));
  await pruneNodes(new Set(snapshot.nodes.map((node) => node.id)));
  await Promise.all(snapshot.nodes.map((node) => replaceNode(node)));
}

export async function applySnapshot(snapshot: StudioSnapshot): Promise<void> {
  await clearStudio();
  await boardCollection.insert(snapshot.board ?? defaultBoard()).when("settled");
  await Promise.all([
    ...snapshot.nodes.map((node) => nodesCollection.insert(node).when("settled")),
    ...snapshot.events.map((event) => eventsCollection.insert(event).when("settled")),
    ...snapshot.assets.map((asset) => assetsCollection.insert(asset).when("settled")),
  ]);
}

export async function replaceAsset(asset: AssetRow): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: assetsCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.some((row) => row.id === asset.id)) return;
  await assetsCollection.insert(asset).when("settled");
}

export async function replaceNode(node: StudioNode): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: nodesCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.some((row) => row.id === node.id)) {
    await nodesCollection.update(node.id, (draft) => {
      Object.assign(draft, node);
    }).when("settled");
  } else {
    await nodesCollection.insert(node).when("settled");
  }
}

export async function dropNode(id: string): Promise<void> {
  await nodesCollection.delete(id).when("settled");
}

export async function pruneNodes(keep: Set<string>): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: nodesCollection }).select(({ row }) => ({ id: row.id })),
  );
  for (const row of current) {
    if (!keep.has(row.id)) await nodesCollection.delete(row.id).when("settled");
  }
}

export async function replaceBoard(board: BoardRow): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: boardCollection }).select(({ row }) => ({ id: row.id })),
  );
  if (current.length === 0) {
    await boardCollection.insert(board).when("settled");
    return;
  }
  await boardCollection.update(board.id, (draft) => {
    Object.assign(draft, board);
  }).when("settled");
}

export async function appendEvents(all: EventRow[]): Promise<void> {
  const current = await queryOnce((q) =>
    q.from({ row: eventsCollection }).select(({ row }) => ({ id: row.id })),
  );
  const seen = new Set(current.map((row) => row.id));
  for (const event of all) {
    if (seen.has(event.id)) continue;
    await eventsCollection.insert(event).when("settled");
  }
}

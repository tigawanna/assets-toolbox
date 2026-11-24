import { asc, eq, max } from "drizzle-orm";

import { boardCollections, mirrorBoard, parseCollections } from "@/lib/scenes";
import {
  defaultBoard,
  parseNode,
  type AssetRow,
  type BoardRow,
  type EventRow,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";

import { defaultDatabasePath, openStudio, type StudioDb } from "./connection";
import { assets, boards, events, nodes } from "./schema";

export function serializeBoard(board: BoardRow) {
  const mirrored = mirrorBoard(board);
  return {
    id: mirrored.id,
    name: mirrored.name,
    store: mirrored.store,
    presetId: mirrored.presetId,
    sliceCount: mirrored.sliceCount,
    background: mirrored.background,
    collections: JSON.stringify(boardCollections(mirrored)),
  };
}

function asBoard(row: typeof boards.$inferSelect): BoardRow {
  const name = row.name === "" ? "Untitled" : row.name;
  return mirrorBoard({
    id: row.id,
    name,
    store: row.store as BoardRow["store"],
    presetId: row.presetId,
    sliceCount: row.sliceCount,
    background: row.background,
    collections: parseCollections(row.collections),
  });
}

function asEvent(row: typeof events.$inferSelect): EventRow {
  return {
    id: row.id,
    seq: row.seq,
    ts: row.ts,
    kind: row.kind as EventRow["kind"],
    label: row.label,
    nodeId: row.nodeId,
    x: row.x,
    y: row.y,
    detail: row.detail,
  };
}

export function readBoard(database: StudioDb): BoardRow {
  const row = database.select().from(boards).get();
  return row === undefined ? defaultBoard() : asBoard(row);
}

export function listNodes(database: StudioDb): StudioNode[] {
  return database
    .select()
    .from(nodes)
    .all()
    .map((row) => parseNode(row.body));
}

export function findNode(database: StudioDb, id: string): StudioNode | undefined {
  const row = database.select().from(nodes).where(eq(nodes.id, id)).get();
  return row === undefined ? undefined : parseNode(row.body);
}

export function listEvents(database: StudioDb): EventRow[] {
  return database.select().from(events).orderBy(asc(events.seq)).all().map(asEvent);
}

export function latestSeq(database: StudioDb): number {
  const row = database
    .select({ latest: max(events.seq) })
    .from(events)
    .get();
  return row?.latest ?? 0;
}

export function listAssets(database: StudioDb): AssetRow[] {
  return database
    .select()
    .from(assets)
    .all()
    .map((row) => row as AssetRow);
}

export function readSnapshot(database: StudioDb): StudioSnapshot {
  return {
    board: readBoard(database),
    nodes: listNodes(database),
    events: listEvents(database),
    assets: listAssets(database),
  };
}

export function readStudio(path = defaultDatabasePath()): StudioSnapshot {
  const database = openStudio(path);
  const existing = database.select().from(boards).get();
  if (existing === undefined) {
    const board = defaultBoard();
    database.insert(boards).values(serializeBoard(board)).run();
  }
  return readSnapshot(database);
}

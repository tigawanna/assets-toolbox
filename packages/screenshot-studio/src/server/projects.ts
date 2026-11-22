import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { findPreset, type StoreName } from "@/lib/presets";
import {
  applyStoreToBoard,
  duplicateBoardName,
  storeLabel,
  variantBoardName,
} from "@/lib/store-rules";
import { defaultBoard } from "@/lib/studio";

import {
  closeStudio,
  defaultDatabasePath,
  openStudio,
  projectDatabasePath,
  studioRoot,
} from "./connection";
import { readStudio, serializeBoard } from "./queries";
import { assets, boards, events, nodes } from "./schema";

export interface ProjectSummary {
  id: string;
  name: string;
  store: StoreName;
  updatedAt: string;
  presetLabel: string;
  sliceCount: number;
  eventCount: number;
  nodeCount: number;
}

function summaryFrom(id: string, path: string): ProjectSummary | null {
  if (!existsSync(path)) return null;
  const snapshot = readStudio(path);
  const board = snapshot.board;
  const preset = findPreset(board.store, board.presetId);
  const mtime = statSync(path).mtime.toISOString();
  const latest = snapshot.events[snapshot.events.length - 1];
  return {
    id,
    name: board.name === "" ? "Untitled" : board.name,
    store: board.store,
    updatedAt: latest?.ts ?? mtime,
    presetLabel: preset?.label ?? board.presetId,
    sliceCount: board.sliceCount,
    eventCount: snapshot.events.length,
    nodeCount: snapshot.nodes.length,
  };
}

export function resolveStudioPath(projectId?: string): string {
  if (projectId === undefined || projectId === "") return defaultDatabasePath();
  return projectDatabasePath(projectId);
}

export function listProjects(): ProjectSummary[] {
  const items: ProjectSummary[] = [];
  const legacy = defaultDatabasePath();
  if (existsSync(legacy)) {
    const row = summaryFrom("studio", legacy);
    if (row !== null) items.push(row);
  }
  const folder = join(studioRoot(), "projects");
  if (!existsSync(folder)) return items.sort(byUpdated);
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".sqlite")) continue;
    const id = file.slice(0, -".sqlite".length);
    const row = summaryFrom(id, join(folder, file));
    if (row !== null) items.push(row);
  }
  return items.sort(byUpdated);
}

function byUpdated(a: ProjectSummary, b: ProjectSummary): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function createProject(name: string): ProjectSummary {
  const id = crypto.randomUUID().slice(0, 8);
  const path = projectDatabasePath(id);
  const title = name.trim() === "" ? "Untitled" : name.trim();
  const database = openStudio(path);
  database.insert(boards).values(serializeBoard(defaultBoard(title))).run();
  const row = summaryFrom(id, path);
  if (row === null) throw new Error("Could not create the board");
  return row;
}

export function renameProject(id: string, name: string): ProjectSummary {
  const path = resolveStudioPath(id);
  const title = name.trim() === "" ? "Untitled" : name.trim();
  const database = openStudio(path);
  const current = database.select().from(boards).get();
  if (current === undefined) throw new Error("Unknown board");
  database.update(boards).set({ name: title }).where(eq(boards.id, current.id)).run();
  const row = summaryFrom(id, path);
  if (row === null) throw new Error("Could not rename");
  return row;
}

export function deleteProject(id: string): void {
  const path = resolveStudioPath(id);
  closeStudio(path);
  if (existsSync(path)) unlinkSync(path);
}

export function cloneProject(
  sourceId: string,
  options: { store?: StoreName; name?: string } = {},
): ProjectSummary {
  const source = readStudio(resolveStudioPath(sourceId));
  const adapted =
    options.store === undefined
      ? { board: source.board, nodes: source.nodes }
      : applyStoreToBoard(source.board, source.nodes, options.store);
  const title =
    options.name?.trim() ||
    (options.store === undefined
      ? duplicateBoardName(source.board.name)
      : variantBoardName(source.board.name, options.store));
  const id = crypto.randomUUID().slice(0, 8);
  const path = projectDatabasePath(id);
  const database = openStudio(path);
  const board = { ...adapted.board, name: title };
  database.insert(boards).values(serializeBoard(board)).run();
  for (const node of adapted.nodes) {
    database.insert(nodes).values({ id: node.id, body: JSON.stringify(node) }).run();
  }
  for (const asset of source.assets) {
    database.insert(assets).values(asset).run();
  }
  const label =
    options.store === undefined
      ? `Cloned from ${source.board.name}`
      : `Cloned for ${storeLabel(options.store)} from ${source.board.name}`;
  database
    .insert(events)
    .values({
      id: crypto.randomUUID(),
      seq: 1,
      ts: new Date().toISOString(),
      kind: "board",
      label,
      nodeId: board.id,
      x: 0,
      y: 0,
      detail: JSON.stringify({ board, nodes: adapted.nodes, from: sourceId }),
    })
    .run();
  const row = summaryFrom(id, path);
  if (row === null) throw new Error("Could not clone the board");
  return row;
}

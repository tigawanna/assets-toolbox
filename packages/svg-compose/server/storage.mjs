import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const connections = new Map();

export function workspaceRoot() {
  return process.env.SVG_COMPOSE_DATA ?? join(process.cwd(), ".svg-compose");
}

export function workspaceDatabasePath() {
  return resolve(workspaceRoot(), "workspace.sqlite");
}

function open(path = workspaceDatabasePath()) {
  const cached = connections.get(path);
  if (cached) return cached;
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      svg text NOT NULL,
      viewport text NOT NULL DEFAULT '{}',
      updated_at text NOT NULL
    );
  `);
  connections.set(path, database);
  return database;
}

function parseViewport(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    const zoom = Number(parsed.zoom);
    const tx = Number(parsed.tx);
    const ty = Number(parsed.ty);
    if (![zoom, tx, ty].every(Number.isFinite)) return { zoom: 1, tx: 0, ty: 0 };
    return { zoom, tx, ty };
  } catch {
    return { zoom: 1, tx: 0, ty: 0 };
  }
}

export function loadWorkspace(path = workspaceDatabasePath()) {
  const row = open(path)
    .prepare(
      "SELECT id, name, svg, viewport, updated_at AS updatedAt FROM workspace WHERE id = 'draft'",
    )
    .get();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    svg: row.svg,
    viewport: parseViewport(row.viewport),
    updatedAt: row.updatedAt,
  };
}

export function saveWorkspace(input, path = workspaceDatabasePath()) {
  if (!input || typeof input.svg !== "string") throw new Error("svg must be a string");
  if (Buffer.byteLength(input.svg, "utf8") > 8 * 1024 * 1024) {
    throw new Error("Document is too large to save (8 MB limit)");
  }
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : "Untitled";
  const viewport = parseViewport(JSON.stringify(input.viewport ?? {}));
  const updatedAt = new Date().toISOString();
  open(path)
    .prepare(`
      INSERT INTO workspace (id, name, svg, viewport, updated_at)
      VALUES ('draft', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        svg = excluded.svg,
        viewport = excluded.viewport,
        updated_at = excluded.updated_at
    `)
    .run(name, input.svg, JSON.stringify(viewport), updatedAt);
  return { id: "draft", name, svg: input.svg, viewport, updatedAt };
}

export function closeWorkspace(path = workspaceDatabasePath()) {
  const database = connections.get(path);
  if (!database) return;
  database.close();
  connections.delete(path);
}

import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export type StudioDb = NodeSQLiteDatabase & { $client: DatabaseSync };

const studios = new Map<string, StudioDb>();

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Folder for studio files. Override with `SCREENSHOT_STUDIO_DATA`. */
export function studioRoot(): string {
  return process.env.SCREENSHOT_STUDIO_DATA ?? join(process.cwd(), ".screenshot-studio");
}

/** SQLite file for this studio. Override with `SCREENSHOT_STUDIO_DATA`. */
export function defaultDatabasePath(): string {
  return resolve(studioRoot(), "studio.sqlite");
}

/** One sqlite file per board. */
export function projectDatabasePath(id: string): string {
  if (id === "studio") return defaultDatabasePath();
  return resolve(studioRoot(), "projects", `${id}.sqlite`);
}

/** Open the file with `node:sqlite`, wrap it in Drizzle, and apply migrations from `schema.ts`. */
function openFresh(path: string): StudioDb {
  mkdirSync(dirname(path), { recursive: true });
  const client = new DatabaseSync(path);
  try {
    client.exec("PRAGMA journal_mode = WAL");
    const database = drizzle({ client });
    try {
      migrate(database, { migrationsFolder });
    } catch {
      /* Older studio files already have the init tables. */
    }
    client.exec(`
      CREATE TABLE IF NOT EXISTS boards (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL DEFAULT 'Untitled',
        store text NOT NULL,
        preset_id text NOT NULL,
        slice_count integer NOT NULL,
        background text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nodes (
        id text PRIMARY KEY NOT NULL,
        body text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assets (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        mime text NOT NULL,
        data text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS edit_log (
        id text PRIMARY KEY NOT NULL,
        seq integer NOT NULL,
        ts text NOT NULL,
        kind text NOT NULL,
        label text NOT NULL,
        node_id text NOT NULL,
        x real NOT NULL,
        y real NOT NULL,
        detail text NOT NULL
      );
    `);
    try {
      client.exec("ALTER TABLE boards ADD COLUMN name text NOT NULL DEFAULT 'Untitled'");
    } catch {
      /* Column already exists on newer files. */
    }
    try {
      client.exec("ALTER TABLE boards ADD COLUMN collections text");
    } catch {
      /* Column already exists on newer files. */
    }
    return database;
  } catch (error) {
    client.close();
    throw error;
  }
}

/** Reuse the database for this path. */
export function openStudio(path = defaultDatabasePath()): StudioDb {
  const existing = studios.get(path);
  if (existing) return existing;
  const database = openFresh(path);
  studios.set(path, database);
  return database;
}

/** Drop the cached database and close the file. The next open starts a new connection. */
export function pathOfStudio(database: StudioDb): string {
  for (const [path, open] of studios) {
    if (open === database) return path;
  }
  return defaultDatabasePath();
}

export function closeStudio(path = defaultDatabasePath()): void {
  const database = studios.get(path);
  if (database === undefined) return;
  studios.delete(path);
  database.$client.close();
}

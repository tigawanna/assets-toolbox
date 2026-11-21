import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export type StudioDb = NodeSQLiteDatabase & { $client: DatabaseSync };

const studios = new Map<string, StudioDb>();

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** SQLite file for this studio. Override with `SCREENSHOT_STUDIO_DATA`. */
export function defaultDatabasePath(): string {
  const root = process.env.SCREENSHOT_STUDIO_DATA ?? join(process.cwd(), ".screenshot-studio");
  return resolve(root, "studio.sqlite");
}

/** Open the file with `node:sqlite`, wrap it in Drizzle, and apply migrations from `schema.ts`. */
function openFresh(path: string): StudioDb {
  mkdirSync(dirname(path), { recursive: true });
  const client = new DatabaseSync(path);
  try {
    client.exec("PRAGMA journal_mode = WAL");
    const database = drizzle({ client });
    migrate(database, { migrationsFolder });
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
export function closeStudio(path = defaultDatabasePath()): void {
  const database = studios.get(path);
  if (database === undefined) return;
  studios.delete(path);
  database.$client.close();
}

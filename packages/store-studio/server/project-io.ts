import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import { createDefaultProject, migrateProject } from "../src/model/migrate";
import { StudioProjectSchema, type StudioProject } from "../src/model/schema";

export interface ProjectPaths {
  root: string;
  file: string;
  assets: string;
}

export function projectPaths(projectDir: string): ProjectPaths {
  const root = resolve(projectDir);
  return { root, file: resolve(root, "project.json"), assets: resolve(root, "assets") };
}

/** Refuse any path that escapes the project directory. */
export function safePath(root: string, relative: string): string {
  if (isAbsolute(relative)) throw new Error("Absolute paths are not allowed");
  const resolved = resolve(root, relative);
  const base = resolve(root);
  if (resolved !== base && !resolved.startsWith(`${base}${sep}`)) {
    throw new Error(`Path escapes the project directory: ${relative}`);
  }
  return resolved;
}

export function readProject(paths: ProjectPaths): StudioProject {
  let raw: string;
  try {
    raw = readFileSync(paths.file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const created = createDefaultProject();
    writeFileSync(paths.file, `${JSON.stringify(created, null, 2)}\n`);
    return created;
  }
  return migrateProject(JSON.parse(raw) as unknown);
}

export function writeProject(paths: ProjectPaths, project: unknown): StudioProject {
  const parsed = StudioProjectSchema.parse(project);
  mkdirSync(paths.root, { recursive: true });
  writeFileSync(paths.file, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}

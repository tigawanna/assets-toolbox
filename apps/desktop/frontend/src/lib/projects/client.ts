import { createBrowserProjectClient } from "./browser-client";
import { createNativeProjectClient } from "./native-client";
import type {
  AssetId,
  AssetMoveRequest,
  AssetRecord,
  ModuleRecord,
  ProjectId,
  ProjectManifest,
  ProjectSummary,
  ToolId,
} from "./types";
import { isProjectId } from "./types";

export interface ProjectClient {
  listProjects(): Promise<ProjectSummary[]>;
  createProject(name: string): Promise<ProjectSummary>;
  getProject(id: ProjectId): Promise<ProjectManifest | null>;
  renameProject(id: ProjectId, name: string): Promise<ProjectSummary>;
  deleteProject(id: ProjectId): Promise<void>;
  getDocument<T>(projectId: ProjectId, tool: ToolId): Promise<ModuleRecord<T> | null>;
  saveDocument<T>(projectId: ProjectId, tool: ToolId, data: T): Promise<ModuleRecord<T>>;
  listAssets(projectId: ProjectId): Promise<AssetRecord[]>;
  addAsset(
    projectId: ProjectId,
    input: { name: string; mime: string; base64: string },
  ): Promise<AssetRecord>;
  getAssetBlob(projectId: ProjectId, assetId: AssetId): Promise<string>;
  deleteAsset(projectId: ProjectId, assetId: AssetId): Promise<void>;
  moveAssets(projectId: ProjectId, request: AssetMoveRequest): Promise<AssetRecord[]>;
}

const ACTIVE_KEY = "assets-toolbox-project";

export function getActiveProjectId(): ProjectId | null {
  try {
    const value = localStorage.getItem(ACTIVE_KEY);
    return value && isProjectId(value) ? value : null;
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: ProjectId | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // The in-memory router state still works when storage is unavailable.
  }
}

function hasNativeBackend(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { go?: { main?: { App?: object } } }).go?.main?.App);
}

let cached: ProjectClient | null = null;

export function getProjectClient(): ProjectClient {
  if (!cached) {
    cached = hasNativeBackend() ? createNativeProjectClient() : createBrowserProjectClient();
  }
  return cached;
}

/** Test-only: drop the memoized client so a different backend can be selected. */
export function resetProjectClient(): void {
  cached = null;
}

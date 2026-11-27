import type { ProjectClient } from "./client";
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

function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Fall through to the status text.
  }
  return `Projects API error (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const body = await response.text();
  if (!response.ok) throw new Error(errorMessage(response.status, body));
  return body ? (JSON.parse(body) as T) : ({} as T);
}

interface DocumentEnvelope<T> {
  document: ModuleRecord<T> | null;
}

export function createNativeProjectClient(): ProjectClient {
  return {
    async listProjects() {
      const { projects } = await request<{ projects: ProjectSummary[] }>("/api/projects");
      return projects ?? [];
    },
    async createProject(name) {
      const { project } = await request<{ project: ProjectSummary }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      return project;
    },
    async getProject(id) {
      try {
        const { project } = await request<{ project: ProjectManifest }>(
          `/api/projects/${encodeURIComponent(id)}`,
        );
        return project ?? null;
      } catch (cause) {
        if (cause instanceof Error && cause.message.includes("404")) return null;
        throw cause;
      }
    },
    async renameProject(id, name) {
      const { project } = await request<{ project: ProjectSummary }>(
        `/api/projects/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      return project;
    },
    async deleteProject(id) {
      await request(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async getDocument<T>(projectId: ProjectId, tool: ToolId) {
      const { document } = await request<DocumentEnvelope<T>>(
        `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(tool)}`,
      );
      return document;
    },
    async saveDocument<T>(projectId: ProjectId, tool: ToolId, data: T) {
      const { document } = await request<DocumentEnvelope<T>>(
        `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(tool)}`,
        { method: "PUT", body: JSON.stringify({ data }) },
      );
      if (!document) throw new Error("The projects API did not return the saved document.");
      return document;
    },
    async listAssets(projectId) {
      const { assets } = await request<{ assets: AssetRecord[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/assets`,
      );
      return assets ?? [];
    },
    async addAsset(projectId, input) {
      const { asset } = await request<{ asset: AssetRecord }>(
        `/api/projects/${encodeURIComponent(projectId)}/assets`,
        { method: "POST", body: JSON.stringify(input) },
      );
      return asset;
    },
    async getAssetBlob(projectId, assetId: AssetId) {
      const { base64 } = await request<{ base64: string }>(
        `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/blob`,
      );
      return base64;
    },
    async deleteAsset(projectId, assetId) {
      await request(
        `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
        { method: "DELETE" },
      );
    },
    async moveAssets(projectId, requestBody: AssetMoveRequest) {
      const { assets } = await request<{ assets: AssetRecord[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/assets/move`,
        { method: "POST", body: JSON.stringify(requestBody) },
      );
      return assets ?? [];
    },
  };
}

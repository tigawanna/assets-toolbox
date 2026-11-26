import type { StageSnapshot, StageViewport } from "../canvas/stage";

const LOCAL_KEY = "svg-compose:workspace:v1";

export type WorkspaceDocument = {
  id: string;
  name: string;
  svg: string;
  viewport: StageViewport;
  updatedAt: string;
};

const isViewport = (value: unknown): value is StageViewport => {
  if (!value || typeof value !== "object") return false;
  const viewport = value as Record<string, unknown>;
  return [viewport.zoom, viewport.tx, viewport.ty].every(Number.isFinite);
};

const isDocument = (value: unknown): value is WorkspaceDocument => {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.svg === "string" &&
    typeof document.name === "string" &&
    typeof document.updatedAt === "string" &&
    isViewport(document.viewport)
  );
};

export async function loadWorkspaceFromServer(): Promise<WorkspaceDocument | null> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new Error(`Load failed (${response.status})`);
  const body = (await response.json()) as { document?: unknown };
  return isDocument(body.document) ? body.document : null;
}

export async function saveWorkspaceToServer(
  document: Omit<WorkspaceDocument, "id" | "updatedAt">,
): Promise<WorkspaceDocument> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Save failed (${response.status})`);
  }
  const body = (await response.json()) as { document?: unknown };
  if (!isDocument(body.document)) throw new Error("The server returned an invalid document");
  return body.document;
}

export function loadWorkspaceFromLocal(): WorkspaceDocument | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceToLocal(
  document: Omit<WorkspaceDocument, "id" | "updatedAt">,
  updatedAt?: string,
): WorkspaceDocument {
  const saved: WorkspaceDocument = {
    ...document,
    id: "local",
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(saved));
  } catch {
    // The Node copy remains authoritative when browser storage is unavailable.
  }
  return saved;
}

export const newestWorkspace = (
  server: WorkspaceDocument | null,
  local: WorkspaceDocument | null,
): WorkspaceDocument | null => {
  if (!server) return local;
  if (!local) return server;
  return Date.parse(local.updatedAt) > Date.parse(server.updatedAt) ? local : server;
};

export const documentKey = (snapshot: StageSnapshot) =>
  JSON.stringify([
    snapshot.svg,
    snapshot.viewport.zoom,
    snapshot.viewport.tx,
    snapshot.viewport.ty,
  ]);

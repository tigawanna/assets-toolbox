import type { StageSnapshot, StageViewport } from "../canvas/stage";

const LOCAL_KEY = "svg-compose:workspace:v1";

export type WorkspaceDocument = {
  id: string;
  name: string;
  svg: string;
  viewport: StageViewport;
  updatedAt: string;
};

type WorkspaceInput = Omit<WorkspaceDocument, "id" | "updatedAt">;

type NativeWorkspaceApp = {
  LoadWorkspace?: () => Promise<WorkspaceDocument | null>;
  SaveWorkspace?: (document: WorkspaceDocument) => Promise<WorkspaceDocument>;
};

const nativeWorkspace = (): NativeWorkspaceApp | undefined =>
  (
    window as Window & {
      go?: { main?: { App?: NativeWorkspaceApp } };
    }
  ).go?.main?.App;

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
  const native = nativeWorkspace();
  if (native?.LoadWorkspace) {
    const document = await native.LoadWorkspace();
    return isDocument(document) ? document : null;
  }

  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new Error(`Load failed (${response.status})`);
  const body = (await response.json()) as { document?: unknown };
  return isDocument(body.document) ? body.document : null;
}

export async function saveWorkspaceToServer(document: WorkspaceInput): Promise<WorkspaceDocument> {
  const native = nativeWorkspace();
  if (native?.SaveWorkspace) {
    const saved = await native.SaveWorkspace({ ...document, id: "draft", updatedAt: "" });
    if (!isDocument(saved)) throw new Error("The native bridge returned an invalid document");
    return saved;
  }

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

const localStorageKey = (workspaceId: string) =>
  workspaceId === "" ? LOCAL_KEY : `${LOCAL_KEY}:${workspaceId}`;

export function loadWorkspaceFromLocal(workspaceId = ""): WorkspaceDocument | null {
  try {
    const raw = localStorage.getItem(localStorageKey(workspaceId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceToLocal(
  document: WorkspaceInput,
  options: { workspaceId?: string; updatedAt?: string } = {},
): WorkspaceDocument | null {
  const saved: WorkspaceDocument = {
    ...document,
    id: "local",
    updatedAt: options.updatedAt ?? new Date().toISOString(),
  };
  try {
    localStorage.setItem(localStorageKey(options.workspaceId ?? ""), JSON.stringify(saved));
    return saved;
  } catch {
    return null;
  }
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

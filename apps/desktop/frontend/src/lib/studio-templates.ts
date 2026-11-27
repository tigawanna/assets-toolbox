import { defaultBoard, type StudioSnapshot } from "@assets/screenshot-studio/lib/studio";

import { deleteTemplate, listTemplates, saveTemplate } from "./templates/client";
import type { TemplateRecord } from "./templates/types";

const STUDIO_DB = "assets-toolbox-screenshot-studio";
const STUDIO_STORE = "projects";

interface StoredStudioBoard {
  id: string;
  snapshot: StudioSnapshot;
  updatedAt: string;
}

function openStudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STUDIO_DB, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Studio storage is unavailable."));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Studio write failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Studio write aborted."));
  });
}

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Studio read failed."));
  });
}

export async function loadStudioBoard(projectId: string): Promise<StudioSnapshot | null> {
  const db = await openStudioDatabase();
  const transaction = db.transaction(STUDIO_STORE, "readonly");
  const record = await resultOf(
    transaction.objectStore(STUDIO_STORE).get(projectId) as IDBRequest<
      StoredStudioBoard | undefined
    >,
  );
  await done(transaction);
  db.close();
  return record?.snapshot ?? null;
}

export async function writeStudioBoard(projectId: string, snapshot: StudioSnapshot): Promise<void> {
  const db = await openStudioDatabase();
  const transaction = db.transaction(STUDIO_STORE, "readwrite");
  transaction.objectStore(STUDIO_STORE).put({
    id: projectId,
    snapshot,
    updatedAt: new Date().toISOString(),
  } satisfies StoredStudioBoard);
  await done(transaction);
  db.close();
}

export async function listStudioTemplates(): Promise<Array<TemplateRecord<StudioSnapshot>>> {
  return listTemplates<StudioSnapshot>("studio");
}

export async function saveStudioTemplate(
  projectId: string,
  name: string,
): Promise<TemplateRecord<StudioSnapshot>> {
  const snapshot =
    (await loadStudioBoard(projectId)) ??
    ({ board: defaultBoard("Studio board"), nodes: [], events: [], assets: [] } as StudioSnapshot);
  return saveTemplate<StudioSnapshot>({
    tool: "studio",
    name,
    description: `${snapshot.nodes.length} layers · ${snapshot.board.collections?.length ?? 1} scene strips`,
    data: snapshot,
  });
}

export async function applyStudioTemplate(projectId: string, templateId: string): Promise<void> {
  const templates = await listStudioTemplates();
  const template = templates.find((item) => item.id === templateId);
  if (!template) throw new Error("That template is no longer available.");
  await writeStudioBoard(projectId, template.data);
}

export async function removeStudioTemplate(id: string): Promise<void> {
  await deleteTemplate(id);
}

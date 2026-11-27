import type { TemplateInput, TemplateRecord, TemplateTool } from "./types";

const DB_NAME = "assets-toolbox-templates";
const DB_VERSION = 1;
const STORE = "templates";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open template storage."));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Template transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Template transaction aborted."));
  });
}

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Template request failed."));
  });
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Global templates are shared by every project inside an app install. */
export async function listTemplates<T = unknown>(
  tool: TemplateTool,
): Promise<Array<TemplateRecord<T>>> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, "readonly");
  const all = await resultOf(
    transaction.objectStore(STORE).getAll() as IDBRequest<Array<TemplateRecord<T>>>,
  );
  await done(transaction);
  db.close();
  return all.filter((template) => template.tool === tool);
}

export async function saveTemplate<T = unknown>(
  input: TemplateInput<T>,
): Promise<TemplateRecord<T>> {
  const record: TemplateRecord<T> = {
    id: `t_${randomHex(6)}`,
    tool: input.tool,
    name: input.name,
    description: input.description ?? "",
    data: input.data,
    createdAt: new Date().toISOString(),
  };
  const db = await openDatabase();
  const transaction = db.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put(record);
  await done(transaction);
  db.close();
  return record;
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await done(transaction);
  db.close();
}

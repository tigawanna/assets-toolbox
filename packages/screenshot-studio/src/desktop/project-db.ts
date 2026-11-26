import type { StudioSnapshot } from "@/lib/studio";

export interface StoredProject {
  snapshot: StudioSnapshot;
  updatedAt: string;
}

export interface StoredProjectRecord extends StoredProject {
  id: string;
}

const DATABASE_NAME = "assets-toolbox-screenshot-studio";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";
const LOCK_PREFIX = `${DATABASE_NAME}:project:`;

let databasePromise: Promise<IDBDatabase> | null = null;
const projectQueues = new Map<string, Promise<void>>();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Local board storage is unavailable"));
  }
  if (databasePromise !== null) return databasePromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        if (databasePromise === opening) databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local board storage"));
    request.onblocked = () => reject(new Error("Local board storage upgrade was blocked"));
  });

  databasePromise = opening;
  void opening.catch(() => {
    if (databasePromise === opening) databasePromise = null;
  });
  return opening;
}

function isSnapshot(value: unknown): value is StudioSnapshot {
  if (value === null || typeof value !== "object") return false;
  const snapshot = value as Partial<StudioSnapshot>;
  return (
    snapshot.board !== null &&
    typeof snapshot.board === "object" &&
    Array.isArray(snapshot.nodes) &&
    Array.isArray(snapshot.events) &&
    Array.isArray(snapshot.assets)
  );
}

function isStoredProject(value: unknown): value is StoredProjectRecord {
  if (value === null || typeof value !== "object") return false;
  const project = value as Partial<StoredProjectRecord>;
  return (
    typeof project.id === "string" &&
    typeof project.updatedAt === "string" &&
    isSnapshot(project.snapshot)
  );
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local board transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Local board transaction failed"));
  });
}

export async function readProject(projectId: string): Promise<StoredProject | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const request = transaction.objectStore(PROJECT_STORE).get(projectId);
    let value: unknown = null;
    request.onsuccess = () => {
      value = request.result;
    };
    void transactionComplete(transaction).then(() => {
      if (!isStoredProject(value) || value.id !== projectId) {
        resolve(null);
        return;
      }
      resolve({ snapshot: value.snapshot, updatedAt: value.updatedAt });
    }, reject);
  });
}

export async function listProjects(): Promise<StoredProjectRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    let value: unknown = [];
    request.onsuccess = () => {
      value = request.result;
    };
    void transactionComplete(transaction).then(
      () => resolve(Array.isArray(value) ? value.filter(isStoredProject) : []),
      reject,
    );
  });
}

export async function writeProject(
  projectId: string,
  snapshot: StudioSnapshot,
  updatedAt = new Date().toISOString(),
): Promise<StoredProject> {
  const database = await openDatabase();
  const stored: StoredProjectRecord = { id: projectId, snapshot, updatedAt };
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).put(stored);
    void transactionComplete(transaction).then(
      () => resolve({ snapshot: stored.snapshot, updatedAt: stored.updatedAt }),
      reject,
    );
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).delete(projectId);
    void transactionComplete(transaction).then(resolve, reject);
  });
}

function enqueueProject<T>(projectId: string, work: () => Promise<T>): Promise<T> {
  const previous = projectQueues.get(projectId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(work);
  const settled = run.then(
    () => {},
    () => {},
  );
  projectQueues.set(projectId, settled);
  void settled.then(() => {
    if (projectQueues.get(projectId) === settled) projectQueues.delete(projectId);
  });
  return run;
}

export async function withProjectLock<T>(projectId: string, work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && typeof navigator.locks?.request === "function") {
    let entered = false;
    try {
      return await navigator.locks.request(`${LOCK_PREFIX}${projectId}`, async () => {
        entered = true;
        return await work();
      });
    } catch (cause) {
      // A failure inside the critical section must not run the mutation twice.
      if (entered) throw cause;
    }
  }
  return enqueueProject(projectId, work);
}

/** Test helper: close the cached connection before replacing the IndexedDB factory. */
export async function resetProjectStorage(): Promise<void> {
  const opening = databasePromise;
  databasePromise = null;
  if (opening !== null) {
    try {
      (await opening).close();
    } catch {
      // A failed open has no connection to close.
    }
  }
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Could not reset local board storage"));
    request.onblocked = () => reject(new Error("Could not reset local board storage"));
  });
}

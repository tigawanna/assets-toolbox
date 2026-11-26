/** Minimal IndexedDB test double for the browser adapter's get/getAll/put/delete transactions. */
type RecordValue = { id: string };
type MutableRequest<T> = {
  result: T;
  error: Error | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
};

const databases = new Map<string, Map<string, RecordValue>>();

function recordKey(id: IDBValidKey): string {
  if (typeof id === "string") return id;
  if (typeof id === "number") return String(id);
  throw new Error("Unsupported IndexedDB test key");
}

function request<T>(run: () => T): IDBRequest<T> {
  const value = {
    result: undefined as T,
    error: null as Error | null,
    onsuccess: null,
    onerror: null,
  } as MutableRequest<T>;
  queueMicrotask(() => {
    try {
      value.result = run();
    } catch (cause) {
      value.error = cause instanceof Error ? cause : new Error(String(cause));
    }
    value.onsuccess?.(new Event("success"));
  });
  return value as unknown as IDBRequest<T>;
}

function objectStore(name: string): IDBObjectStore {
  const records = () => {
    let current = databases.get(name);
    if (current === undefined) {
      current = new Map();
      databases.set(name, current);
    }
    return current;
  };
  return {
    get: (id: IDBValidKey) => request(() => structuredClone(records().get(recordKey(id)) ?? null)),
    getAll: () => request(() => structuredClone(Array.from(records().values()))),
    put: (value: RecordValue) =>
      request(() => {
        records().set(value.id, structuredClone(value));
        return value.id;
      }),
    delete: (id: IDBValidKey) =>
      request(() => {
        records().delete(recordKey(id));
        return undefined;
      }),
  } as IDBObjectStore;
}

function transaction(): IDBTransaction {
  const value = {
    error: null,
    objectStore: () => objectStore("assets-toolbox-screenshot-studio"),
  } as unknown as IDBTransaction;
  queueMicrotask(() => {
    queueMicrotask(() => value.oncomplete?.(new Event("complete")));
  });
  return value;
}

function database(): IDBDatabase {
  return {
    name: "assets-toolbox-screenshot-studio",
    objectStoreNames: {
      contains: (name: string) => databases.has(name),
    } as DOMStringList,
    createObjectStore: (name: string) => {
      if (!databases.has(name)) databases.set(name, new Map());
      return objectStore(name);
    },
    transaction,
    close: () => {},
    onversionchange: null,
  } as unknown as IDBDatabase;
}

export function installIndexedDB(): void {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open: (_name: string, _version?: number) => {
        const value = {
          result: undefined as unknown as IDBDatabase,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null,
        } as MutableRequest<IDBDatabase> & {
          onupgradeneeded: ((event: Event) => void) | null;
          onblocked: ((event: Event) => void) | null;
        };
        queueMicrotask(() => {
          const db = database();
          value.result = db;
          if (!databases.has("assets-toolbox-screenshot-studio")) {
            value.onupgradeneeded?.(new Event("upgradeneeded"));
          }
          value.onsuccess?.(new Event("success"));
        });
        return value as unknown as IDBOpenDBRequest;
      },
      deleteDatabase: () =>
        request(() => {
          databases.clear();
          return undefined;
        }),
    },
  });
}

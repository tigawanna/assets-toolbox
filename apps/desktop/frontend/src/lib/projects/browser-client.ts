import type { ProjectClient } from "./client";
import type {
  AssetId,
  AssetKind,
  AssetMoveRequest,
  AssetRecord,
  ModuleRecord,
  ProjectId,
  ProjectManifest,
  ProjectSummary,
  ToolId,
} from "./types";

const DB_NAME = "assets-toolbox-projects";
const DB_VERSION = 1;

type StoredProject = ProjectManifest & {
  lastOpenedAt?: string;
  counts: { assets: number; tools: number };
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("documents")) db.createObjectStore("documents");
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the projects database."));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Project transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Project transaction aborted."));
  });
}

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project request failed."));
  });
}

function keyText(key: unknown): string {
  if (typeof key === "string") return key;
  if (typeof key === "number") return String(key);
  if (key instanceof Date) return key.toISOString();
  return "";
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? (reader.result.split(",").at(-1) ?? "") : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the asset blob."));
    reader.readAsDataURL(blob);
  });
}

function toSummary(project: StoredProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    lastOpenedAt: project.lastOpenedAt,
    counts: project.counts,
  };
}

function toManifest(project: StoredProject): ProjectManifest {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    schemaVersion: project.schemaVersion,
    settings: project.settings,
  };
}

function documentKey(projectId: ProjectId, tool: ToolId): string {
  return `${projectId}:${tool}`;
}

function assetKey(projectId: ProjectId, assetId: AssetId): string {
  return `${projectId}:${assetId}`;
}

export function createBrowserProjectClient(): ProjectClient {
  return {
    async listProjects() {
      const db = await openDatabase();
      const transaction = db.transaction("projects", "readonly");
      const projects = await resultOf(
        transaction.objectStore("projects").getAll() as IDBRequest<StoredProject[]>,
      );
      await done(transaction);
      db.close();
      return projects
        .map(toSummary)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async createProject(name) {
      const now = new Date().toISOString();
      const project: StoredProject = {
        id: `p_${randomHex(6)}` as ProjectId,
        name,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
        settings: { defaultOutDir: "out" },
        counts: { assets: 0, tools: 0 },
      };
      const db = await openDatabase();
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(project);
      await done(transaction);
      db.close();
      return toSummary(project);
    },

    async getProject(id) {
      const db = await openDatabase();
      const transaction = db.transaction("projects", "readonly");
      const project = await resultOf(
        transaction.objectStore("projects").get(id) as IDBRequest<StoredProject | undefined>,
      );
      await done(transaction);
      db.close();
      return project ? toManifest(project) : null;
    },

    async renameProject(id, name) {
      const db = await openDatabase();
      const transaction = db.transaction("projects", "readwrite");
      const store = transaction.objectStore("projects");
      const project = await resultOf(store.get(id) as IDBRequest<StoredProject | undefined>);
      if (!project) {
        transaction.abort();
        db.close();
        throw new Error("Project not found.");
      }
      const updated: StoredProject = { ...project, name, updatedAt: new Date().toISOString() };
      store.put(updated);
      await done(transaction);
      db.close();
      return toSummary(updated);
    },

    async deleteProject(id) {
      const db = await openDatabase();
      const transaction = db.transaction(["projects", "documents", "assets"], "readwrite");
      transaction.objectStore("projects").delete(id);
      const documents = transaction.objectStore("documents");
      const documentKeys = await resultOf(documents.getAllKeys());
      for (const key of documentKeys) {
        if (keyText(key).startsWith(`${id}:`)) documents.delete(key);
      }
      const assets = transaction.objectStore("assets");
      const assetKeys = await resultOf(assets.getAllKeys());
      for (const key of assetKeys) {
        if (keyText(key).startsWith(`${id}:`)) assets.delete(key);
      }
      await done(transaction);
      db.close();
    },

    async getDocument<T>(projectId: ProjectId, tool: ToolId) {
      const db = await openDatabase();
      const transaction = db.transaction("documents", "readonly");
      const document = await resultOf(
        transaction.objectStore("documents").get(documentKey(projectId, tool)) as IDBRequest<
          ModuleRecord<T> | undefined
        >,
      );
      await done(transaction);
      db.close();
      return document ?? null;
    },

    async saveDocument<T>(projectId: ProjectId, tool: ToolId, data: T) {
      const document: ModuleRecord<T> = {
        projectId,
        tool,
        data,
        updatedAt: new Date().toISOString(),
      };
      const db = await openDatabase();
      const transaction = db.transaction(["documents", "projects"], "readwrite");
      transaction.objectStore("documents").put(document, documentKey(projectId, tool));
      const projects = transaction.objectStore("projects");
      const project = await resultOf(
        projects.get(projectId) as IDBRequest<StoredProject | undefined>,
      );
      if (project) {
        const documentKeys = await resultOf(transaction.objectStore("documents").getAllKeys());
        const tools = new Set(
          documentKeys
            .map((key) => keyText(key).split(":").at(-1))
            .filter((value): value is ToolId => Boolean(value)),
        );
        projects.put({
          ...project,
          updatedAt: document.updatedAt,
          counts: { ...project.counts, tools: tools.size },
        });
      }
      await done(transaction);
      db.close();
      return document;
    },

    async listAssets(projectId) {
      const db = await openDatabase();
      const transaction = db.transaction("assets", "readonly");
      const range = IDBKeyRange.bound(`${projectId}:`, `${projectId};\uffff`);
      const assets = await resultOf(
        transaction.objectStore("assets").getAll(range) as IDBRequest<AssetRecord[]>,
      );
      await done(transaction);
      db.close();
      return assets;
    },

    async addAsset(projectId, input) {
      const bytes = base64ToBytes(input.base64);
      const hash = await sha256(bytes);
      const asset: AssetRecord = {
        id: `a_${randomHex(8)}` as AssetId,
        projectId,
        name: input.name,
        mime: input.mime,
        bytes: bytes.length,
        hash,
        kind: "source" as AssetKind,
        tags: [],
        refs: [],
        createdAt: new Date().toISOString(),
      };
      const db = await openDatabase();
      const transaction = db.transaction(["assets", "blobs", "projects"], "readwrite");
      const blobs = transaction.objectStore("blobs");
      const existing = await resultOf(blobs.get(hash));
      if (!existing) blobs.put(new Blob([bytes as BlobPart]), hash);
      transaction.objectStore("assets").put(asset, assetKey(projectId, asset.id));
      const projects = transaction.objectStore("projects");
      const project = await resultOf(
        projects.get(projectId) as IDBRequest<StoredProject | undefined>,
      );
      if (project) {
        projects.put({
          ...project,
          updatedAt: asset.createdAt,
          counts: { ...project.counts, assets: project.counts.assets + 1 },
        });
      }
      await done(transaction);
      db.close();
      return asset;
    },

    async getAssetBlob(projectId, assetId) {
      const db = await openDatabase();
      const transaction = db.transaction(["assets", "blobs"], "readonly");
      const asset = await resultOf(
        transaction.objectStore("assets").get(assetKey(projectId, assetId)) as IDBRequest<
          AssetRecord | undefined
        >,
      );
      if (!asset) {
        transaction.abort();
        db.close();
        throw new Error("Asset not found.");
      }
      const blob = await resultOf(
        transaction.objectStore("blobs").get(asset.hash) as IDBRequest<Blob | undefined>,
      );
      await done(transaction);
      db.close();
      if (!blob) throw new Error("Asset blob is missing.");
      return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    },

    async deleteAsset(projectId, assetId) {
      const db = await openDatabase();
      const transaction = db.transaction(["assets", "projects"], "readwrite");
      transaction.objectStore("assets").delete(assetKey(projectId, assetId));
      const projects = transaction.objectStore("projects");
      const project = await resultOf(
        projects.get(projectId) as IDBRequest<StoredProject | undefined>,
      );
      if (project) {
        projects.put({
          ...project,
          counts: { ...project.counts, assets: Math.max(0, project.counts.assets - 1) },
        });
      }
      await done(transaction);
      db.close();
    },

    async moveAssets(projectId, request: AssetMoveRequest) {
      const db = await openDatabase();
      const transaction = db.transaction(["assets", "documents", "projects"], "readwrite");
      const assets = transaction.objectStore("assets");
      const range = IDBKeyRange.bound(`${projectId}:`, `${projectId};\uffff`);
      const list = await resultOf(assets.getAll(range) as IDBRequest<AssetRecord[]>);
      const selected = list.filter((asset) => request.assetIds.includes(asset.id));
      if (request.includeDerived) {
        for (const asset of list) {
          const parent = asset.origin?.derivedFrom;
          if (parent && request.assetIds.includes(parent) && !selected.includes(asset)) {
            selected.push(asset);
          }
        }
      }
      if (selected.length === 0) {
        transaction.abort();
        db.close();
        return [];
      }
      if (request.mode === "move") {
        const documents = await resultOf(
          transaction.objectStore("documents").getAll() as IDBRequest<ModuleRecord[]>,
        );
        const used = new Set<string>();
        for (const document of documents) {
          if (document.projectId !== projectId) continue;
          const text = JSON.stringify(document.data);
          for (const asset of selected) {
            if (text.includes(asset.id)) used.add(asset.id);
          }
        }
        if (used.size > 0) {
          transaction.abort();
          db.close();
          throw new Error(
            `Still referenced in this project: ${[...used].join(", ")}. Use Copy instead.`,
          );
        }
      }
      const moved: AssetRecord[] = selected.map((asset) => ({
        ...asset,
        id: `a_${randomHex(8)}` as AssetId,
        projectId: request.targetProjectId,
        refs: [],
        createdAt: new Date().toISOString(),
      }));
      for (const asset of moved) {
        assets.put(asset, assetKey(request.targetProjectId, asset.id));
        if (request.mode === "move") {
          assets.delete(assetKey(projectId, selected.find((item) => item.hash === asset.hash)!.id));
        }
      }
      const projects = transaction.objectStore("projects");
      const target = await resultOf(
        projects.get(request.targetProjectId) as IDBRequest<StoredProject | undefined>,
      );
      if (target) {
        projects.put({
          ...target,
          updatedAt: new Date().toISOString(),
          counts: { ...target.counts, assets: target.counts.assets + moved.length },
        });
      }
      await done(transaction);
      db.close();
      return moved;
    },
  };
}

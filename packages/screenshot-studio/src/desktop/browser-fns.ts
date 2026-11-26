import type { DeviceModelId } from "@/devices/catalog";
import { duplicateSliceRange, removeSliceRange } from "@/lib/bands";
import { findPreset, type StoreName } from "@/lib/presets";
import {
  boardCollections,
  collectionAsBoard,
  collectionFrame,
  findCollection,
  nodesInCollection,
  patchCollection,
  removeSceneCollection,
  writeCollectionFill,
} from "@/lib/scenes";
import {
  boardFillFor,
  cloneNode,
  createAsset,
  createDeviceNode,
  createLineNode,
  createOverlayNode,
  createTextNode,
  defaultBoard,
  MAX_SLICES,
  nextStackZ,
  parseEventSnapshot,
  writeBoardFill,
  type AssetRow,
  type BoardRow,
  type EventKind,
  type EventRow,
  type ShapeKind,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";
import {
  applyStoreToBoard,
  applyStoreToCollection,
  cloneSceneCollection,
  duplicateBoardName,
  storeLabel,
  variantBoardName,
} from "@/lib/store-rules";

import {
  deleteProject as deleteStoredProject,
  listProjects,
  readProject as readStoredProject,
  withProjectLock,
  writeProject as writeStoredProject,
  type StoredProject,
} from "./project-db";

export interface ProjectSummary {
  id: string;
  name: string;
  store: StoreName;
  updatedAt: string;
  presetLabel: string;
  sliceCount: number;
  eventCount: number;
  nodeCount: number;
}

export interface StudioSettings {
  dataRoot: string;
  projectsDir: string;
  dataRootEnv: string;
  dataRootOverridden: boolean;
  origin: string;
  mcpUrl: string;
  mcpConfig: { mcpServers: { "screenshot-studio": { url: string } } };
  boardFile: string | undefined;
}

type ProjectRef = { projectId?: string };
type Fn<Input, Output> = (options: { data: Input }) => Promise<Output>;

const STORAGE_PREFIX = "assets-toolbox:screenshot-studio:";
const LEGACY_INDEX_KEY = `${STORAGE_PREFIX}index`;
const LEGACY_PROJECT_PREFIX = `${STORAGE_PREFIX}project:`;
const FOCUS_KEY = `${STORAGE_PREFIX}focused`;
const DEFAULT_PROJECT_ID = "studio";
let legacyMigration: Promise<void> | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function storage(): Storage {
  if (typeof localStorage === "undefined") {
    throw new Error("Local board storage is unavailable");
  }
  return localStorage;
}

function isLegacyProject(value: unknown): value is StoredProject {
  if (value === null || typeof value !== "object") return false;
  const project = value as Partial<StoredProject>;
  const snapshot = project.snapshot as Partial<StudioSnapshot> | undefined;
  return (
    typeof project.updatedAt === "string" &&
    snapshot !== undefined &&
    snapshot.board !== null &&
    typeof snapshot.board === "object" &&
    Array.isArray(snapshot.nodes) &&
    Array.isArray(snapshot.events) &&
    Array.isArray(snapshot.assets)
  );
}

function migrateLegacyProjects(): Promise<void> {
  if (legacyMigration !== null) return legacyMigration;
  legacyMigration = (async () => {
    if (typeof localStorage === "undefined") return;
    let legacy: Storage;
    try {
      legacy = storage();
    } catch {
      return;
    }
    let failed = false;
    let ids: string[] = [];
    try {
      const parsed: unknown = JSON.parse(legacy.getItem(LEGACY_INDEX_KEY) ?? "[]");
      if (Array.isArray(parsed)) {
        ids = parsed.filter((id): id is string => typeof id === "string");
      }
    } catch {
      ids = [];
    }

    for (const id of new Set(ids)) {
      const key = `${LEGACY_PROJECT_PREFIX}${id}`;
      const raw = legacy.getItem(key);
      if (raw === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!isLegacyProject(parsed)) continue;
      try {
        await withProjectLock(id, async () => {
          if ((await readProject(id)) === null) {
            await writeStoredProject(id, clone(parsed.snapshot), parsed.updatedAt);
          }
        });
        legacy.removeItem(key);
      } catch {
        failed = true;
      }
    }
    if (!failed) legacy.removeItem(LEGACY_INDEX_KEY);
    if (failed) throw new Error("Some legacy boards could not be migrated");
  })().catch(() => {
    // Keep the legacy records so a later operation can retry the failed projects.
    legacyMigration = null;
  });
  return legacyMigration;
}

async function withSerializedProject<T>(projectId: string, work: () => Promise<T>): Promise<T> {
  await migrateLegacyProjects();
  return withProjectLock(projectId, work);
}

function resolveProjectId(projectId?: string | null): string {
  return projectId === undefined || projectId === null || projectId === ""
    ? DEFAULT_PROJECT_ID
    : projectId;
}

async function readProject(projectId?: string | null): Promise<StoredProject | null> {
  return readStoredProject(resolveProjectId(projectId));
}

async function writeProject(projectId: string, snapshot: StudioSnapshot): Promise<StoredProject> {
  return writeStoredProject(projectId, clone(snapshot));
}

async function deleteProject(projectId: string): Promise<void> {
  await deleteStoredProject(projectId);
}

function emptySnapshot(name = "Untitled"): StudioSnapshot {
  return {
    board: defaultBoard(name),
    nodes: [],
    events: [],
    assets: [],
  };
}

async function loadSnapshot(projectId?: string | null): Promise<StudioSnapshot> {
  return clone((await readProject(projectId))?.snapshot ?? emptySnapshot());
}

function summaryFrom(projectId: string, stored: StoredProject): ProjectSummary {
  const snapshot = stored.snapshot;
  const board = snapshot.board;
  const preset = findPreset(board.store, board.presetId);
  return {
    id: projectId,
    name: board.name === "" ? "Untitled" : board.name,
    store: board.store,
    updatedAt: stored.updatedAt,
    presetLabel: preset?.label ?? board.presetId,
    sliceCount: board.sliceCount,
    eventCount: snapshot.events.length,
    nodeCount: snapshot.nodes.length,
  };
}

function detailObject(detail: string): Record<string, unknown> {
  if (detail === "") return {};
  try {
    const parsed = JSON.parse(detail) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function ensurePreviousSnapshot(snapshot: StudioSnapshot): void {
  const last = snapshot.events.at(-1);
  if (!last || parseEventSnapshot(last.detail) !== null) return;
  last.detail = JSON.stringify({
    ...detailObject(last.detail),
    board: snapshot.board,
    nodes: snapshot.nodes,
  });
}

async function commit(
  projectId: string | undefined,
  options: {
    kind: EventKind;
    label: string;
    node: { id: string; x: number; y: number };
    detail?: Record<string, unknown>;
  },
  mutate: (snapshot: StudioSnapshot) => void,
): Promise<StudioSnapshot> {
  const id = resolveProjectId(projectId);
  return withSerializedProject(id, async () => {
    const snapshot = await loadSnapshot(id);
    ensurePreviousSnapshot(snapshot);
    const seq = (snapshot.events.at(-1)?.seq ?? 0) + 1;
    const event: EventRow = {
      id: crypto.randomUUID(),
      seq,
      ts: new Date().toISOString(),
      kind: options.kind,
      label: options.label,
      nodeId: options.node.id,
      x: options.node.x,
      y: options.node.y,
      detail: "",
    };
    snapshot.events.push(event);
    mutate(snapshot);
    event.detail = JSON.stringify({
      ...options.detail,
      ...detailObject(event.detail),
      board: snapshot.board,
      nodes: snapshot.nodes,
    });
    await writeProject(id, snapshot);
    return clone(snapshot);
  });
}

function frameFor(board: BoardRow, collectionId?: string) {
  const collection = findCollection(board, collectionId);
  return { collection, frame: collectionAsBoard(board, collection) };
}

function findNode(snapshot: StudioSnapshot, id: string): StudioNode | undefined {
  return snapshot.nodes.find((node) => node.id === id);
}

export async function listBoards(): Promise<ProjectSummary[]> {
  await migrateLegacyProjects();
  const projects = await listProjects();
  return projects
    .map(({ id, ...stored }) => summaryFrom(id, stored))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const loadSettings: Fn<{ projectId?: string }, StudioSettings> = async ({ data }) => {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const projectId = resolveProjectId(data.projectId);
  return {
    dataRoot: "IndexedDB",
    projectsDir: "Assets Toolbox · Screenshot Studio",
    dataRootEnv: "SCREENSHOT_STUDIO_DATA",
    dataRootOverridden: false,
    origin,
    mcpUrl: "",
    mcpConfig: { mcpServers: { "screenshot-studio": { url: "" } } },
    boardFile: `assets-toolbox-screenshot-studio/${projectId}`,
  };
};

export const focusBoard: Fn<
  { projectId?: string | null },
  { projectId: string | null; focusedAt: string }
> = async ({ data }) => {
  const focusedAt = new Date().toISOString();
  try {
    storage().setItem(FOCUS_KEY, JSON.stringify({ projectId: data.projectId ?? null, focusedAt }));
  } catch {
    // Focus tracking is optional when browser storage is unavailable.
  }
  return { projectId: data.projectId ?? null, focusedAt };
};

export const createBoard: Fn<{ name?: string }, ProjectSummary> = async ({ data }) => {
  const id = crypto.randomUUID().slice(0, 8);
  const name = data.name?.trim() || "Untitled";
  return withSerializedProject(id, async () => {
    const stored = await writeProject(id, emptySnapshot(name));
    return summaryFrom(id, stored);
  });
};

export const deleteBoard: Fn<{ projectId: string }, { ok: true }> = async ({ data }) => {
  await withSerializedProject(data.projectId, () => deleteProject(data.projectId));
  return { ok: true };
};

export const cloneBoard: Fn<
  { projectId: string; store?: StoreName; name?: string },
  ProjectSummary
> = async ({ data }) =>
  withSerializedProject(data.projectId, async () => {
    const source = await loadSnapshot(data.projectId);
    const adapted =
      data.store === undefined
        ? { board: source.board, nodes: source.nodes }
        : applyStoreToBoard(source.board, source.nodes, data.store);
    const name =
      data.name?.trim() ||
      (data.store === undefined
        ? duplicateBoardName(source.board.name)
        : variantBoardName(source.board.name, data.store));
    const id = crypto.randomUUID().slice(0, 8);
    const board = { ...adapted.board, name };
    const snapshot: StudioSnapshot = {
      board,
      nodes: clone(adapted.nodes),
      assets: clone(source.assets),
      events: [
        {
          id: crypto.randomUUID(),
          seq: 1,
          ts: new Date().toISOString(),
          kind: "board",
          label:
            data.store === undefined
              ? `Cloned from ${source.board.name}`
              : `Cloned for ${storeLabel(data.store)} from ${source.board.name}`,
          nodeId: board.id,
          x: 0,
          y: 0,
          detail: JSON.stringify({ board, nodes: adapted.nodes, from: data.projectId }),
        },
      ],
    };
    const stored = await writeProject(id, snapshot);
    return summaryFrom(id, stored);
  });

export const loadStudio: Fn<ProjectRef, StudioSnapshot> = async ({ data }) => {
  await migrateLegacyProjects();
  return loadSnapshot(data.projectId);
};

export const addAsset: Fn<
  ProjectRef & { name: string; mime: string; data: string },
  StudioSnapshot & { assetId: string }
> = async ({ data }) => {
  if (!data.data.startsWith("data:")) throw new Error("Assets must be data URLs");
  const asset = createAsset(data.name, data.mime, data.data);
  const snapshot = await commit(
    data.projectId,
    { kind: "edit", label: `Import ${data.name}`, node: { id: asset.id, x: 0, y: 0 } },
    (current) => current.assets.push(asset),
  );
  return { ...snapshot, assetId: asset.id };
};

export const addDevice: Fn<
  ProjectRef & { model: DeviceModelId; slice?: number; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "add", label: "Add device", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const { collection, frame } = frameFor(snapshot.board, data.collectionId);
      const node = {
        ...createDeviceNode(data.model, frame, data.slice ?? 0),
        collectionId: collection.id,
        z: nextStackZ(snapshot.nodes),
      };
      snapshot.nodes.push(node);
      const event = snapshot.events.at(-1);
      if (event) {
        event.label = `Add ${node.name}`;
        event.nodeId = node.id;
        event.x = node.x;
        event.y = node.y;
      }
    },
  );

export const addDevicePair: Fn<
  ProjectRef & {
    android: DeviceModelId;
    apple: DeviceModelId;
    slice?: number;
    collectionId?: string;
  },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "add", label: "Add device pair", node: { id: "", x: 0, y: 0 } },
    (current) => {
      const { collection, frame } = frameFor(current.board, data.collectionId);
      const behind = {
        ...createDeviceNode(data.android, frame, data.slice ?? 0),
        collectionId: collection.id,
        z: nextStackZ(current.nodes),
      };
      const front = {
        ...createDeviceNode(data.apple, frame, data.slice ?? 0),
        collectionId: collection.id,
        x: behind.x + Math.round(behind.width * 0.28),
        y: behind.y + Math.round(behind.height * 0.08),
        z: behind.z + 1,
        screenColor: behind.screenColor,
        screenAssetId: behind.screenAssetId,
      };
      current.nodes.push(behind, front);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Stack ${behind.name} + ${front.name}`;
        event.nodeId = front.id;
        event.x = front.x;
        event.y = front.y;
        event.detail = JSON.stringify({
          android: data.android,
          apple: data.apple,
          ids: [behind.id, front.id],
        });
      }
    },
  );

export const addText: Fn<
  ProjectRef & { role: "headline" | "subtext"; slice?: number; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "add", label: "Add text", node: { id: "", x: 0, y: 0 } },
    (current) => {
      const { collection, frame } = frameFor(current.board, data.collectionId);
      const node = {
        ...createTextNode(frame, data.role, data.slice ?? 0),
        collectionId: collection.id,
        z: nextStackZ(current.nodes),
      };
      current.nodes.push(node);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Add ${node.name}`;
        event.nodeId = node.id;
        event.x = node.x;
        event.y = node.y;
      }
    },
  );

export const addOverlay: Fn<
  ProjectRef & {
    kind: "shape" | "image";
    slice?: number;
    collectionId?: string;
    targetId?: string;
    imageId?: string;
    assetName?: string;
    shape?: ShapeKind;
  },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "add", label: "Add overlay", node: { id: "", x: 0, y: 0 } },
    (current) => {
      const { collection, frame } = frameFor(current.board, data.collectionId);
      const target = data.targetId === undefined ? undefined : findNode(current, data.targetId);
      const node = {
        ...createOverlayNode(frame, {
          kind: data.kind,
          slice: data.slice ?? 0,
          imageId: data.imageId,
          assetName: data.assetName,
          shape: data.shape,
          target: target ?? null,
        }),
        collectionId: collection.id,
        z: nextStackZ(current.nodes),
      };
      current.nodes.push(node);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Add ${node.name}`;
        event.nodeId = node.id;
        event.x = node.x;
        event.y = node.y;
      }
    },
  );

export const addShape: Fn<
  ProjectRef & { slice?: number; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  addOverlay({
    data: { ...data, kind: "shape" },
  });

export const addLine: Fn<
  ProjectRef & {
    smooth?: boolean;
    slice?: number;
    collectionId?: string;
    targetId?: string;
  },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "add", label: "Add line", node: { id: "", x: 0, y: 0 } },
    (current) => {
      const { collection, frame } = frameFor(current.board, data.collectionId);
      const target = data.targetId === undefined ? undefined : findNode(current, data.targetId);
      const node = {
        ...createLineNode(frame, {
          smooth: data.smooth ?? false,
          slice: data.slice ?? 0,
          target: target ?? null,
        }),
        collectionId: collection.id,
        z: nextStackZ(current.nodes),
      };
      current.nodes.push(node);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Add ${node.name}`;
        event.nodeId = node.id;
        event.x = node.x;
        event.y = node.y;
      }
    },
  );

export const patchNode: Fn<
  ProjectRef & {
    id: string;
    patch: Record<string, unknown>;
    label: string;
    kind?: EventKind;
  },
  StudioSnapshot
> = async ({ data }) => {
  const snapshot = commit(
    data.projectId,
    { kind: data.kind ?? "edit", label: data.label, node: { id: data.id, x: 0, y: 0 } },
    (current) => {
      const existing = findNode(current, data.id);
      if (!existing) throw new Error(`Unknown node ${data.id}`);
      const node = {
        ...existing,
        ...data.patch,
        id: existing.id,
        type: existing.type,
      } as StudioNode;
      current.nodes = current.nodes.map((item) => (item.id === data.id ? node : item));
      const event = current.events.at(-1);
      if (event) {
        event.x = node.x;
        event.y = node.y;
        event.detail = JSON.stringify({ patch: data.patch });
      }
    },
  );
  return snapshot;
};

export const removeNode: Fn<ProjectRef & { id: string }, StudioSnapshot> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "remove", label: "Remove node", node: { id: data.id, x: 0, y: 0 } },
    (current) => {
      const node = findNode(current, data.id);
      if (!node) throw new Error(`Unknown node ${data.id}`);
      current.nodes = current.nodes.filter((item) => item.id !== data.id);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Remove ${node.name}`;
        event.x = node.x;
        event.y = node.y;
      }
    },
  );

export const cloneSelectedNode: Fn<
  ProjectRef & { id: string },
  StudioSnapshot & { nodeId: string }
> = async ({ data }) => {
  let nodeId = "";
  const snapshot = await commit(
    data.projectId,
    { kind: "add", label: "Duplicate node", node: { id: data.id, x: 0, y: 0 } },
    (current) => {
      const existing = findNode(current, data.id);
      if (!existing) throw new Error(`Unknown node ${data.id}`);
      const { collection } = frameFor(current.board, existing.collectionId);
      const preset = collectionFrame(collection);
      const nextX = existing.x + preset.width;
      const fits =
        nextX + Math.min(existing.width, preset.width) <= preset.width * collection.sliceCount;
      const copy = {
        ...cloneNode(existing, fits ? preset.width : 48, fits ? 0 : 48),
        z: nextStackZ(current.nodes),
      };
      nodeId = copy.id;
      current.nodes.push(copy);
      const event = current.events.at(-1);
      if (event) {
        event.label = `Duplicate ${copy.name}`;
        event.nodeId = copy.id;
        event.x = copy.x;
        event.y = copy.y;
      }
    },
  );
  return { ...snapshot, nodeId };
};

export const reorderStack: Fn<ProjectRef & { ids: string[] }, StudioSnapshot> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "edit", label: "Stack layers", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      snapshot.nodes = snapshot.nodes.map((node) => {
        const index = data.ids.indexOf(node.id);
        return index === -1 ? node : { ...node, z: data.ids.length - 1 - index };
      });
      const last = snapshot.events.at(-1);
      if (last) last.nodeId = snapshot.board.id;
    },
  );

export const patchBoard: Fn<
  ProjectRef & Partial<BoardRow> & { collectionId?: string; x?: number; y?: number },
  StudioSnapshot
> = async ({ data }) => {
  const { projectId, ...patch } = data;
  return commit(
    projectId,
    { kind: "board", label: "Update board", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const current = snapshot.board;
      const collectionId = patch.collectionId;
      const { collectionId: _omit, x, y, ...rest } = patch;
      let board = current;
      if (collectionId !== undefined && collectionId !== "") {
        const collection = findCollection(current, collectionId);
        const next = writeCollectionFill({
          ...collection,
          name:
            rest.name !== undefined && rest.name.trim() !== "" ? rest.name.trim() : collection.name,
          store: rest.store ?? collection.store,
          presetId: rest.presetId ?? collection.presetId,
          sliceCount: rest.sliceCount ?? collection.sliceCount,
          background: rest.background ?? collection.background,
          ...(x === undefined ? {} : { x }),
          ...(y === undefined ? {} : { y }),
        });
        if (findPreset(next.store, next.presetId) === undefined) {
          throw new Error(`Unknown preset ${next.store}/${next.presetId}`);
        }
        board = patchCollection(current, collection.id, next);
      } else {
        board = { ...current, ...rest };
        if (findPreset(board.store, board.presetId) === undefined) {
          throw new Error(`Unknown preset ${board.store}/${board.presetId}`);
        }
        if (
          rest.store !== undefined ||
          rest.presetId !== undefined ||
          rest.sliceCount !== undefined ||
          rest.background !== undefined
        ) {
          const collection = findCollection(board);
          board = patchCollection(
            board,
            collection.id,
            writeCollectionFill({
              ...collection,
              store: rest.store ?? collection.store,
              presetId: rest.presetId ?? collection.presetId,
              sliceCount: rest.sliceCount ?? collection.sliceCount,
              background: rest.background ?? collection.background,
            }),
          );
        }
        board.name = board.name.trim() === "" ? "Untitled" : board.name.trim();
      }
      snapshot.board = board;
      const last = snapshot.events.at(-1);
      if (last) {
        const moved = x !== undefined || y !== undefined;
        const renamed = rest.name !== undefined && !moved && Object.keys(rest).length === 1;
        const collectionName =
          collectionId === undefined ? "strip" : findCollection(board, collectionId).name;
        if (moved) last.label = `Move ${collectionName}`;
        else if (renamed) {
          last.label = `Rename ${collectionId === undefined ? board.name : collectionName}`;
        } else last.label = "Update board";
        last.nodeId = board.id;
        last.detail = JSON.stringify({
          ...detailObject(last.detail),
          patch,
          board,
          nodes: snapshot.nodes,
        });
      }
    },
  );
};

export const renameBoard: Fn<
  ProjectRef & { name: string; collectionId?: string },
  StudioSnapshot
> = async ({ data }) => {
  const id = resolveProjectId(data.projectId);
  return withSerializedProject(id, async () => {
    const snapshot = await loadSnapshot(id);
    const collection =
      data.collectionId === undefined || data.collectionId === ""
        ? undefined
        : findCollection(snapshot.board, data.collectionId);
    const name = data.name.trim() === "" ? (collection?.name ?? "Untitled") : data.name.trim();
    if (name === (collection?.name ?? snapshot.board.name)) return snapshot;

    const rename = (board: BoardRow): BoardRow =>
      collection === undefined
        ? { ...board, name }
        : patchCollection(board, collection.id, { name });

    snapshot.board = rename(snapshot.board);

    // Renames sit outside undo history, so every existing restore point keeps
    // the current name instead of silently reverting it on a later undo.
    for (const event of snapshot.events) {
      const restore = parseEventSnapshot(event.detail);
      if (restore === null) continue;
      if (
        collection !== undefined &&
        !boardCollections(restore.board).some((item) => item.id === collection.id)
      ) {
        continue;
      }
      event.detail = JSON.stringify({
        ...detailObject(event.detail),
        board: rename(restore.board),
        nodes: restore.nodes,
      });
    }

    await writeProject(id, snapshot);
    return clone(snapshot);
  });
};

export const cloneSlices: Fn<
  ProjectRef & { start: number; count?: number; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "board", label: "Duplicate slices", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const board = snapshot.board;
      const { collection } = frameFor(board, data.collectionId);
      const srcStart = Math.max(0, Math.min(collection.sliceCount - 1, Math.floor(data.start)));
      const srcCount = Math.max(
        1,
        Math.min(Math.floor(data.count ?? 1), collection.sliceCount - srcStart),
      );
      if (collection.sliceCount + srcCount > MAX_SLICES) {
        throw new Error(`At most ${MAX_SLICES} slices`);
      }
      const filled = writeCollectionFill(collection);
      const fill = boardFillFor({ ...board, ...filled });
      const preset = collectionFrame(collection);
      const insertAt = srcStart + srcCount;
      const originalCount = collection.sliceCount;
      const nextCollection = writeCollectionFill({
        ...collection,
        sliceCount: originalCount + srcCount,
        background: writeBoardFill({
          ...fill,
          bands: duplicateSliceRange(fill.bands, srcStart, srcCount, originalCount),
        }),
      });
      snapshot.board = patchCollection(board, collection.id, nextCollection);
      const shift = srcCount * preset.width;
      const fallback = boardCollections(board)[0]?.id ?? collection.id;
      let z = nextStackZ(snapshot.nodes);
      snapshot.nodes = snapshot.nodes.flatMap((node) => {
        if (!nodesInCollection([node], collection.id, fallback).length) return [node];
        const index = Math.floor((node.x + node.width / 2) / preset.width);
        const next = index >= insertAt ? [{ ...node, x: node.x + shift }] : [node];
        if (index >= srcStart && index < insertAt) {
          next.push({
            ...cloneNode(node, shift, 0),
            collectionId: collection.id,
            z: z++,
          });
        }
        return next;
      });
      const last = snapshot.events.at(-1);
      if (last) {
        last.nodeId = board.id;
        last.label =
          srcCount === 1
            ? `Duplicate slice ${srcStart + 1}`
            : `Duplicate slices ${srcStart + 1}–${srcStart + srcCount}`;
        last.detail = JSON.stringify({
          ...detailObject(last.detail),
          start: srcStart,
          count: srcCount,
          board: snapshot.board,
          nodes: snapshot.nodes,
        });
      }
    },
  );

export const deleteSlices: Fn<
  ProjectRef & { start: number; count?: number; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "board", label: "Delete slices", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const board = snapshot.board;
      const { collection } = frameFor(board, data.collectionId);
      const delStart = Math.max(0, Math.min(collection.sliceCount - 1, Math.floor(data.start)));
      const delCount = Math.max(
        1,
        Math.min(Math.floor(data.count ?? 1), collection.sliceCount - delStart),
      );
      const remaining = collection.sliceCount - delCount;
      if (remaining < 1) throw new Error("Keep at least one slice");
      const filled = writeCollectionFill(collection);
      const fill = boardFillFor({ ...board, ...filled });
      const preset = collectionFrame(collection);
      const originalCount = collection.sliceCount;
      const nextCollection = writeCollectionFill({
        ...collection,
        sliceCount: remaining,
        background: writeBoardFill({
          ...fill,
          bands: removeSliceRange(fill.bands, delStart, delCount, originalCount),
        }),
      });
      snapshot.board = patchCollection(board, collection.id, nextCollection);
      const delEnd = delStart + delCount;
      const shift = delCount * preset.width;
      const fallback = boardCollections(board)[0]?.id ?? collection.id;
      snapshot.nodes = snapshot.nodes.flatMap((node) => {
        if (!nodesInCollection([node], collection.id, fallback).length) return [node];
        const index = Math.floor((node.x + node.width / 2) / preset.width);
        if (index >= delStart && index < delEnd) return [];
        return index >= delEnd ? [{ ...node, x: node.x - shift }] : [node];
      });
      const last = snapshot.events.at(-1);
      if (last) {
        last.nodeId = board.id;
        last.label =
          delCount === 1
            ? `Delete slice ${delStart + 1}`
            : `Delete slices ${delStart + 1}–${delStart + delCount}`;
        last.detail = JSON.stringify({
          ...detailObject(last.detail),
          start: delStart,
          count: delCount,
          board: snapshot.board,
          nodes: snapshot.nodes,
        });
      }
    },
  );

export const applyStore: Fn<
  ProjectRef & { store: StoreName; collectionId?: string },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "board", label: "Apply store rules", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const collection = findCollection(snapshot.board, data.collectionId);
      const next = applyStoreToCollection(
        snapshot.board,
        snapshot.nodes,
        collection.id,
        data.store,
      );
      snapshot.board = next.board;
      snapshot.nodes = next.nodes;
      const last = snapshot.events.at(-1);
      if (last) {
        last.nodeId = next.board.id;
        last.label = `Apply ${storeLabel(data.store)} rules to ${collection.name}`;
      }
    },
  );

export const cloneCollection: Fn<
  ProjectRef & { collectionId: string; store?: StoreName },
  StudioSnapshot
> = async ({ data }) =>
  commit(
    data.projectId,
    { kind: "board", label: "Clone collection", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const source = findCollection(snapshot.board, data.collectionId);
      const next = cloneSceneCollection(snapshot.board, snapshot.nodes, source.id, data.store);
      snapshot.board = next.board;
      snapshot.nodes = next.nodes;
      const added = boardCollections(next.board).at(-1);
      const last = snapshot.events.at(-1);
      if (last) {
        last.nodeId = next.board.id;
        last.label =
          data.store === undefined
            ? `Clone ${source.name}`
            : `Clone ${source.name} for ${storeLabel(data.store)}`;
        last.detail = JSON.stringify({
          ...detailObject(last.detail),
          from: source.id,
          collectionId: added?.id,
          store: data.store,
        });
      }
    },
  );

export const removeCollection: Fn<ProjectRef & { collectionId: string }, StudioSnapshot> = async ({
  data,
}) =>
  commit(
    data.projectId,
    { kind: "board", label: "Delete collection", node: { id: "", x: 0, y: 0 } },
    (snapshot) => {
      const source = findCollection(snapshot.board, data.collectionId);
      const next = removeSceneCollection(snapshot.board, snapshot.nodes, source.id);
      snapshot.board = next.board;
      snapshot.nodes = next.nodes;
      const last = snapshot.events.at(-1);
      if (last) {
        last.nodeId = next.board.id;
        last.label = `Delete ${source.name}`;
      }
    },
  );

async function restoreSnapshot(
  projectId: string,
  snapshot: StudioSnapshot,
  seq: number,
): Promise<StudioSnapshot> {
  const target = snapshot.events.find((event) => event.seq === seq);
  if (!target) throw new Error("Unknown event");
  const restore = parseEventSnapshot(target.detail);
  if (!restore) throw new Error("This event has no restore point");
  snapshot.board = restore.board;
  snapshot.nodes = clone(restore.nodes);
  snapshot.events = snapshot.events.filter((event) => event.seq <= seq);
  await writeProject(projectId, snapshot);
  return clone(snapshot);
}

export const restoreHistory: Fn<ProjectRef & { seq: number }, StudioSnapshot> = async ({
  data,
}) => {
  const id = resolveProjectId(data.projectId);
  return withSerializedProject(id, async () => {
    const snapshot = await loadSnapshot(id);
    return restoreSnapshot(id, snapshot, data.seq);
  });
};

export const undoEvent: Fn<ProjectRef, StudioSnapshot> = async ({ data }) => {
  const id = resolveProjectId(data.projectId);
  return withSerializedProject(id, async () => {
    const snapshot = await loadSnapshot(id);
    if (snapshot.events.length === 0) return snapshot;
    if (snapshot.events.length === 1) {
      const name = snapshot.board.name;
      const next = emptySnapshot(name);
      next.assets = snapshot.assets;
      await writeProject(id, next);
      return clone(next);
    }

    const previous = snapshot.events.at(-2);
    const last = snapshot.events.at(-1);
    if (!previous || !last) return snapshot;
    if (parseEventSnapshot(previous.detail) !== null) {
      return restoreSnapshot(id, snapshot, previous.seq);
    }
    if (last.kind !== "add") throw new Error("This event has no restore point");

    const after = parseEventSnapshot(last.detail);
    const extra = detailObject(last.detail);
    const drop = new Set<string>([last.nodeId]);
    if (Array.isArray(extra.ids)) {
      for (const id of extra.ids) if (typeof id === "string") drop.add(id);
    }
    const source = after?.nodes ?? snapshot.nodes;
    if (!Array.isArray(extra.ids) && typeof extra.android === "string") {
      const apple = source.find((node) => node.id === last.nodeId);
      const candidates = source.filter(
        (node) => node.type === "device" && node.model === extra.android && node.id !== last.nodeId,
      );
      const behind =
        apple === undefined
          ? candidates.at(-1)
          : (candidates.find((node) => node.z === (apple.z ?? 0) - 1) ?? candidates.at(-1));
      if (behind) drop.add(behind.id);
    }
    snapshot.board = after?.board ?? snapshot.board;
    snapshot.nodes = source.filter((node) => !drop.has(node.id));
    snapshot.events = snapshot.events.filter((event) => event.id !== last.id);
    await writeProject(id, snapshot);
    return clone(snapshot);
  });
};

export type { AssetRow, BoardRow, EventRow, StudioNode, StudioSnapshot };

import { createServerFn } from "@tanstack/react-start";

import type { DeviceModelId } from "@/devices/catalog";
import { DEVICE_MODEL_IDS } from "@/devices/catalog";
import type { BoardRow, EventKind, StoreName } from "@/lib/studio";
import { readStudio } from "./queries";
import {
  addAsset as addAssetFn,
  addDevice as addDeviceFn,
  addDevicePair as addDevicePairFn,
  addShape as addShapeFn,
  addText as addTextFn,
  applyBoardStore as applyBoardStoreFn,
  cloneCollection as cloneCollectionFn,
  removeCollection as removeCollectionFn,
  duplicateNode as duplicateNodeFn,
  duplicateSlices as duplicateSlicesFn,
  removeNode as removeNodeFn,
  removeSlices as removeSlicesFn,
  reorderNodes as reorderNodesFn,
  restoreToSeq as restoreToSeqFn,
  undoLast as undoLastFn,
  updateBoard as updateBoardFn,
  updateNode as updateNodeFn,
} from "./mutations";
import {
  cloneProject as cloneProjectFn,
  createProject as createProjectFn,
  deleteProject as deleteProjectFn,
  listProjects as listProjectsFn,
  renameProject as renameProjectFn,
  resolveStudioPath,
} from "./projects";
import { writeOpenBoard } from "./open-board";
import { studioSettings } from "./settings";

function isStore(value: unknown): value is StoreName {
  return value === "play" || value === "app-store";
}

function isModel(value: unknown): value is DeviceModelId {
  return typeof value === "string" && (DEVICE_MODEL_IDS as string[]).includes(value);
}

function pathOf(projectId?: string): string {
  return resolveStudioPath(projectId);
}

export const listBoards = createServerFn({ method: "GET" }).handler(async () => {
  return listProjectsFn();
});

export const focusBoard = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string | null } = {}) => data)
  .handler(async ({ data }) => writeOpenBoard(data.projectId ?? null));

export const loadSettings = createServerFn({ method: "GET" })
  .validator((data: { projectId?: string } = {}) => data)
  .handler(async ({ data }) => studioSettings(data.projectId));

export const createBoard = createServerFn({ method: "POST" })
  .validator((data: { name?: string }) => data)
  .handler(async ({ data }) => createProjectFn(data.name ?? "Untitled"));

export const renameBoard = createServerFn({ method: "POST" })
  .validator((data: { projectId: string; name: string }) => {
    if (data.projectId.trim() === "") throw new Error("A board id is required");
    return data;
  })
  .handler(async ({ data }) => renameProjectFn(data.projectId, data.name));

export const deleteBoard = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => {
    if (data.projectId.trim() === "") throw new Error("A board id is required");
    return data;
  })
  .handler(async ({ data }) => {
    deleteProjectFn(data.projectId);
    return { ok: true };
  });

export const cloneBoard = createServerFn({ method: "POST" })
  .validator((data: { projectId: string; store?: StoreName; name?: string }) => {
    if (data.projectId.trim() === "") throw new Error("A board id is required");
    if (data.store !== undefined && !isStore(data.store)) throw new Error("Unknown store");
    return data;
  })
  .handler(async ({ data }) =>
    cloneProjectFn(data.projectId, { store: data.store, name: data.name }),
  );

export const applyStore = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; store: StoreName; collectionId?: string }) => {
    if (!isStore(data.store)) throw new Error("Unknown store");
    return data;
  })
  .handler(async ({ data }) =>
    applyBoardStoreFn(data.store, pathOf(data.projectId), data.collectionId),
  );

export const cloneCollection = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; collectionId: string; store?: StoreName }) => {
    if (data.collectionId.trim() === "") throw new Error("A collection id is required");
    if (data.store !== undefined && !isStore(data.store)) throw new Error("Unknown store");
    return data;
  })
  .handler(async ({ data }) =>
    cloneCollectionFn(data.collectionId, data.store, pathOf(data.projectId)),
  );

export const removeCollection = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; collectionId: string }) => {
    if (data.collectionId.trim() === "") throw new Error("A collection id is required");
    return data;
  })
  .handler(async ({ data }) =>
    removeCollectionFn(data.collectionId, pathOf(data.projectId)),
  );

export const loadStudio = createServerFn({ method: "GET" })
  .validator((data: { projectId?: string } = {}) => data)
  .handler(async ({ data }) => readStudio(pathOf(data.projectId)));

export const addDevice = createServerFn({ method: "POST" })
  .validator(
    (data: { projectId?: string; model: DeviceModelId; slice?: number; collectionId?: string }) => {
      if (!isModel(data.model)) throw new Error("Unknown device");
      return data;
    },
  )
  .handler(async ({ data }) =>
    addDeviceFn(data.model, data.slice ?? 0, pathOf(data.projectId), data.collectionId),
  );

export const addDevicePair = createServerFn({ method: "POST" })
  .validator(
    (data: {
      projectId?: string;
      android: DeviceModelId;
      apple: DeviceModelId;
      slice?: number;
      collectionId?: string;
    }) => {
      if (!isModel(data.android) || !isModel(data.apple)) throw new Error("Unknown device");
      return data;
    },
  )
  .handler(async ({ data }) =>
    addDevicePairFn(
      data.android,
      data.apple,
      data.slice ?? 0,
      pathOf(data.projectId),
      data.collectionId,
    ),
  );

export const addText = createServerFn({ method: "POST" })
  .validator(
    (data: {
      projectId?: string;
      role: "headline" | "subtext";
      slice?: number;
      collectionId?: string;
    }) => {
      if (data.role !== "headline" && data.role !== "subtext") throw new Error("Unknown text role");
      return data;
    },
  )
  .handler(async ({ data }) =>
    addTextFn(data.role, data.slice ?? 0, pathOf(data.projectId), data.collectionId),
  );

export const addShape = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; slice?: number; collectionId?: string }) => data)
  .handler(async ({ data }) =>
    addShapeFn(data.slice ?? 0, pathOf(data.projectId), data.collectionId),
  );

export const patchNode = createServerFn({ method: "POST" })
  .validator(
    (data: {
      projectId?: string;
      id: string;
      patch: Record<string, unknown>;
      label: string;
      kind?: EventKind;
    }) => {
      if (data.id.trim() === "") throw new Error("A node id is required");
      return data;
    },
  )
  .handler(async ({ data }) =>
    updateNodeFn(data.id, data.patch, data.label, data.kind ?? "edit", pathOf(data.projectId)),
  );

export const removeNode = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; id: string }) => {
    if (data.id.trim() === "") throw new Error("A node id is required");
    return data;
  })
  .handler(async ({ data }) => removeNodeFn(data.id, pathOf(data.projectId)));

export const addAsset = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; name: string; mime: string; data: string }) => {
    if (data.name.trim() === "" || !data.data.startsWith("data:")) {
      throw new Error("A named image data URL is required");
    }
    return data;
  })
  .handler(async ({ data }) => addAssetFn(data.name, data.mime, data.data, pathOf(data.projectId)));

export const patchBoard = createServerFn({ method: "POST" })
  .validator(
    (data: Partial<BoardRow> & { projectId?: string; collectionId?: string; x?: number; y?: number }) => {
      if (data.store !== undefined && !isStore(data.store)) throw new Error("Unknown store");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { projectId, ...patch } = data;
    return updateBoardFn(patch, pathOf(projectId));
  });

export const deleteSlices = createServerFn({ method: "POST" })
  .validator(
    (data: { projectId?: string; start: number; count?: number; collectionId?: string }) => {
      if (!Number.isFinite(data.start) || data.start < 0) throw new Error("A slice index is required");
      return data;
    },
  )
  .handler(async ({ data }) =>
    removeSlicesFn(data.start, data.count ?? 1, pathOf(data.projectId), data.collectionId),
  );

export const cloneSelectedNode = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; id: string }) => {
    if (data.id.trim() === "") throw new Error("A node id is required");
    return data;
  })
  .handler(async ({ data }) => duplicateNodeFn(data.id, pathOf(data.projectId)));

export const cloneSlices = createServerFn({ method: "POST" })
  .validator(
    (data: { projectId?: string; start: number; count?: number; collectionId?: string }) => {
      if (!Number.isFinite(data.start) || data.start < 0) throw new Error("A slice index is required");
      return data;
    },
  )
  .handler(async ({ data }) =>
    duplicateSlicesFn(data.start, data.count ?? 1, pathOf(data.projectId), data.collectionId),
  );

export const reorderStack = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; ids: string[] }) => {
    if (!Array.isArray(data.ids) || data.ids.some((id) => id.trim() === "")) {
      throw new Error("Layer ids are required");
    }
    return data;
  })
  .handler(async ({ data }) => reorderNodesFn(data.ids, pathOf(data.projectId)));

export const restoreHistory = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string; seq: number }) => {
    if (!Number.isInteger(data.seq) || data.seq < 1) throw new Error("An event number is required");
    return data;
  })
  .handler(async ({ data }) => restoreToSeqFn(data.seq, pathOf(data.projectId)));

export const undoEvent = createServerFn({ method: "POST" })
  .validator((data: { projectId?: string } = {}) => data)
  .handler(async ({ data }) => undoLastFn(pathOf(data.projectId)));

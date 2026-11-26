import { DEVICE_PAIRS, deviceFamily, type DeviceModelId } from "@/devices/catalog";
import { findPreset, type StoreName } from "@/lib/presets";
import {
  boardCollections,
  collectionAsBoard,
  collectionBottom,
  collectionOrigin,
  COLLECTION_GAP,
  DEFAULT_COLLECTION_ID,
  findCollection,
  mirrorBoard,
  nodeCollectionId,
  nodesInCollection,
  patchCollection,
  remintCollectionFill,
  type SceneCollection,
} from "@/lib/scenes";
import {
  boardFillFor,
  boardSize,
  cloneNode,
  deviceAspectLocked,
  restoreDeviceAspect,
  retargetDevice,
  writeBoardFill,
  type BoardRow,
  type DeviceNode,
  type StudioNode,
  type StudioSnapshot,
} from "@/lib/studio";

/** Play listing caps at 8 phone screenshots. App Store allows 10. */
export const STORE_SLICE_LIMIT: Record<StoreName, number> = {
  play: 8,
  "app-store": 10,
};

const PLAY_TO_APP: Record<string, string> = {
  "phone-portrait": "iphone-6-9",
  "phone-tall": "iphone-6-9",
  "phone-landscape": "iphone-6-9-landscape",
  "tablet-portrait": "ipad-13",
  "tablet-landscape": "ipad-13-landscape",
  "foldable-square": "iphone-6-9",
  "foldable-wide": "iphone-6-9-landscape",
  "foldable-cover": "iphone-6-9",
  chromebook: "iphone-6-9-landscape",
  wear: "iphone-6-9",
  tv: "iphone-6-9-landscape",
  "tv-banner": "iphone-6-9-landscape",
  xr: "iphone-6-9",
  "auto-portrait": "iphone-6-9",
  "auto-landscape": "iphone-6-9-landscape",
  "feature-graphic": "iphone-6-9-landscape",
};

const APP_TO_PLAY: Record<string, string> = {
  "iphone-6-9": "phone-portrait",
  "iphone-6-5": "phone-portrait",
  "iphone-6-9-landscape": "phone-landscape",
  "iphone-6-5-landscape": "phone-landscape",
  "ipad-13": "tablet-portrait",
  "ipad-12-9": "tablet-portrait",
  "ipad-13-landscape": "tablet-landscape",
  "ipad-12-9-landscape": "tablet-landscape",
};

const DEFAULT_PRESET: Record<StoreName, string> = {
  play: "phone-portrait",
  "app-store": "iphone-6-9",
};

export function storeLabel(store: StoreName): string {
  return store === "app-store" ? "Apple" : "Android";
}

const VARIANT_SUFFIX = / · (Apple|Android|Play|iOS|App Store)$/i;

export function boardBaseName(name: string): string {
  return (
    name
      .replace(VARIANT_SUFFIX, "")
      .replace(/ copy$/i, "")
      .trim() || "Untitled"
  );
}

export function variantBoardName(name: string, store: StoreName): string {
  return `${boardBaseName(name)} · ${storeLabel(store)}`;
}

export function duplicateBoardName(name: string): string {
  const base = name.trim() === "" ? "Untitled" : name.trim();
  return base.endsWith(" copy") ? base : `${base} copy`;
}

export function fileSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "board" : slug;
}

export function presetForStore(board: BoardRow, store: StoreName): string {
  if (board.store === store && findPreset(store, board.presetId) !== undefined) {
    return board.presetId;
  }
  const mapped = board.store === "play" ? PLAY_TO_APP[board.presetId] : APP_TO_PLAY[board.presetId];
  if (mapped !== undefined && findPreset(store, mapped) !== undefined) return mapped;
  return DEFAULT_PRESET[store];
}

function pairMate(model: DeviceModelId, store: StoreName): DeviceModelId | undefined {
  const pair = DEVICE_PAIRS.find((item) => item.android === model || item.apple === model);
  if (pair === undefined) return undefined;
  return store === "app-store" ? pair.apple : pair.android;
}

export function deviceForStore(model: DeviceModelId, store: StoreName): DeviceModelId {
  const family = deviceFamily(model);
  if (family === "desktop") return model;
  if (store === "app-store") {
    if (family === "apple") return model;
    return pairMate(model, store) ?? "iphone-island";
  }
  if (family === "android") return model;
  return pairMate(model, store) ?? "phone-punch";
}

function sliceOf(x: number, sliceWidth: number): number {
  if (sliceWidth <= 0) return 0;
  return Math.floor(x / sliceWidth + 1e-6);
}

function scaleNode(
  node: StudioNode,
  from: { width: number; height: number },
  to: { width: number; height: number },
  sliceCount: number,
  store: StoreName,
): StudioNode | null {
  const originSlice = sliceOf(node.x, from.width);
  if (originSlice >= sliceCount) return null;
  const localX = node.x - originSlice * from.width;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const x = originSlice * to.width + localX * sx;
  const y = node.y * sy;
  const width = Math.max(24, node.width * sx);
  const height = Math.max(24, node.height * sy);
  if (node.type === "text") {
    return {
      ...node,
      x,
      y,
      width,
      height,
      fontSize: Math.max(8, Math.round(node.fontSize * sy)),
    };
  }
  if (node.type === "line") {
    return {
      ...node,
      x,
      y,
      width,
      height,
      points: node.points.map((point) => ({
        x: Math.round(point.x * sx),
        y: Math.round(point.y * sy),
      })),
    };
  }
  if (node.type === "shape") {
    return { ...node, x, y, width, height, radius: Math.max(0, Math.round(node.radius * sx)) };
  }
  const scaled: DeviceNode = {
    ...node,
    x,
    y,
    width,
    height,
    frameRadius:
      node.frameRadius === undefined ? undefined : Math.max(0, Math.round(node.frameRadius * sx)),
    screenRadius:
      node.screenRadius === undefined ? undefined : Math.max(0, Math.round(node.screenRadius * sx)),
  };
  const target = deviceForStore(node.model, store);
  const swapped = { ...scaled, ...retargetDevice(scaled, target) };
  if (!deviceAspectLocked(node)) return swapped;
  return { ...swapped, ...restoreDeviceAspect(swapped) };
}

/** Fit a board to one store: listing size, slice cap, and matching device frames. */
export function applyStoreRules(
  snapshot: Pick<StudioSnapshot, "board" | "nodes">,
  store: StoreName,
): { board: BoardRow; nodes: StudioNode[] } {
  const from = boardSize(snapshot.board);
  const presetId = presetForStore(snapshot.board, store);
  const to = findPreset(store, presetId) ?? {
    store,
    id: presetId,
    label: presetId,
    width: from.width,
    height: from.height,
  };
  const sliceCount = Math.min(snapshot.board.sliceCount, STORE_SLICE_LIMIT[store]);
  const board: BoardRow = {
    ...snapshot.board,
    store,
    presetId,
    sliceCount,
    name: snapshot.board.name,
  };
  board.background = writeBoardFill(boardFillFor(board));
  const nodes = snapshot.nodes
    .map((node) => scaleNode(node, from, to, sliceCount, store))
    .filter((node): node is StudioNode => node !== null);
  return { board, nodes };
}

/** Apply listing rules to every scene strip on a board. */
export function applyStoreToBoard(
  board: BoardRow,
  nodes: StudioNode[],
  store: StoreName,
): { board: BoardRow; nodes: StudioNode[] } {
  let nextBoard = board;
  let nextNodes = nodes;
  for (const collection of boardCollections(board)) {
    const applied = applyStoreToCollection(nextBoard, nextNodes, collection.id, store);
    nextBoard = applied.board;
    nextNodes = applied.nodes;
  }
  return { board: nextBoard, nodes: nextNodes };
}

export function applyStoreToCollection(
  board: BoardRow,
  nodes: StudioNode[],
  collectionId: string,
  store: StoreName,
): { board: BoardRow; nodes: StudioNode[] } {
  const collection = findCollection(board, collectionId);
  const fallback = boardCollections(board)[0]?.id ?? DEFAULT_COLLECTION_ID;
  const local = nodesInCollection(nodes, collection.id, fallback);
  const others = nodes.filter((node) => nodeCollectionId(node, fallback) !== collection.id);
  const applied = applyStoreRules(
    { board: collectionAsBoard(board, collection), nodes: local },
    store,
  );
  const nextCollection: SceneCollection = {
    ...collection,
    name: collection.store === store ? collection.name : variantBoardName(collection.name, store),
    store: applied.board.store,
    presetId: applied.board.presetId,
    sliceCount: applied.board.sliceCount,
    background: applied.board.background,
  };
  return {
    board: patchCollection(board, collection.id, nextCollection),
    nodes: [...others, ...applied.nodes.map((node) => ({ ...node, collectionId: collection.id }))],
  };
}

export function cloneSceneCollection(
  board: BoardRow,
  nodes: StudioNode[],
  collectionId: string,
  store?: StoreName,
): { board: BoardRow; nodes: StudioNode[] } {
  const source = findCollection(board, collectionId);
  const fallback = boardCollections(board)[0]?.id ?? DEFAULT_COLLECTION_ID;
  const id = `col-${crypto.randomUUID().slice(0, 8)}`;
  let collection: SceneCollection = remintCollectionFill({
    ...source,
    id,
    name:
      store === undefined ? duplicateBoardName(source.name) : variantBoardName(source.name, store),
  });
  let copies = nodesInCollection(nodes, source.id, fallback).map((node) => ({
    ...cloneNode(node),
    collectionId: id,
  }));
  if (store !== undefined) {
    const applied = applyStoreRules(
      { board: collectionAsBoard(board, collection), nodes: copies },
      store,
    );
    collection = {
      ...collection,
      store: applied.board.store,
      presetId: applied.board.presetId,
      sliceCount: applied.board.sliceCount,
      background: applied.board.background,
    };
    copies = applied.nodes.map((node) => ({ ...node, collectionId: id }));
  }
  const sourceOrigin = collectionOrigin(board, source.id);
  collection = {
    ...collection,
    x: sourceOrigin.x,
    y: collectionBottom(board) + COLLECTION_GAP,
  };
  return {
    board: mirrorBoard({ ...board, collections: [...boardCollections(board), collection] }),
    nodes: [...nodes, ...copies],
  };
}

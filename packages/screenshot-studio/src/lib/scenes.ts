import { findPreset, type PresetChoice, type StoreName } from "@/lib/presets";
import {
  parseBoardFill,
  writeBoardFill,
  type BoardFill,
  type BoardRow,
  type StudioNode,
} from "@/lib/studio";
import { normalizeBands, parseBandSelection, parseSliceSelection } from "@/lib/bands";

export interface SceneCollection {
  id: string;
  name: string;
  store: StoreName;
  presetId: string;
  sliceCount: number;
  background: string;
  /** Canvas position of this filmstrip. Missing means stacked under the previous strip. */
  x?: number;
  y?: number;
}

export const DEFAULT_COLLECTION_ID = "col-main";
export const COLLECTION_GAP = 220;
export const COLLECTION_HANDLE = 120;
export const COLLECTION_PREFIX = "collection:";

export function collectionSelectionId(id: string): string {
  return `${COLLECTION_PREFIX}${id}`;
}

export function parseCollectionSelection(id: string | null): string | null {
  if (id === null || !id.startsWith(COLLECTION_PREFIX)) return null;
  const value = id.slice(COLLECTION_PREFIX.length);
  return value === "" ? null : value;
}

export function defaultCollection(name = "Scenes"): SceneCollection {
  return {
    id: DEFAULT_COLLECTION_ID,
    name,
    store: "play",
    presetId: "phone-portrait",
    sliceCount: 5,
    background: "#2a332c",
  };
}

function isStore(value: unknown): value is StoreName {
  return value === "play" || value === "app-store";
}

function asCollection(value: unknown, fallback: SceneCollection): SceneCollection {
  if (value === null || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id !== "" ? row.id : fallback.id;
  const name = typeof row.name === "string" && row.name !== "" ? row.name : fallback.name;
  const store = isStore(row.store) ? row.store : fallback.store;
  const presetId = typeof row.presetId === "string" && row.presetId !== "" ? row.presetId : fallback.presetId;
  const sliceCount =
    typeof row.sliceCount === "number" && row.sliceCount > 0 ? Math.floor(row.sliceCount) : fallback.sliceCount;
  const background = typeof row.background === "string" ? row.background : fallback.background;
  const x = typeof row.x === "number" && Number.isFinite(row.x) ? row.x : fallback.x;
  const y = typeof row.y === "number" && Number.isFinite(row.y) ? row.y : fallback.y;
  return {
    id,
    name,
    store,
    presetId,
    sliceCount,
    background,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  };
}

export function parseCollections(raw: unknown): SceneCollection[] {
  if (typeof raw === "string" && raw.startsWith("[")) {
    try {
      return parseCollections(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const fallback = defaultCollection();
  return raw.map((item, index) =>
    asCollection(item, { ...fallback, id: index === 0 ? DEFAULT_COLLECTION_ID : `col-${index}` }),
  );
}

export function boardCollections(board: BoardRow): SceneCollection[] {
  if (Array.isArray(board.collections) && board.collections.length > 0) {
    return board.collections;
  }
  return [
    {
      id: DEFAULT_COLLECTION_ID,
      name: "Scenes",
      store: board.store,
      presetId: board.presetId,
      sliceCount: board.sliceCount,
      background: board.background,
    },
  ];
}

export function mirrorBoard(board: BoardRow): BoardRow {
  const collections = boardCollections(board);
  const first = collections[0] ?? defaultCollection();
  return {
    ...board,
    collections,
    store: first.store,
    presetId: first.presetId,
    sliceCount: first.sliceCount,
    background: first.background,
  };
}

export function collectionFrame(collection: SceneCollection): PresetChoice {
  return (
    findPreset(collection.store, collection.presetId) ?? {
      store: collection.store,
      id: collection.presetId,
      label: collection.presetId,
      width: 1080,
      height: 1920,
    }
  );
}

export function collectionFill(collection: SceneCollection): BoardFill {
  const fill = parseBoardFill(collection.background);
  return { ...fill, bands: normalizeBands(fill.bands, collection.sliceCount) };
}

export function collectionAsBoard(board: BoardRow, collection: SceneCollection): BoardRow {
  return {
    ...board,
    id: collection.id,
    name: collection.name,
    store: collection.store,
    presetId: collection.presetId,
    sliceCount: collection.sliceCount,
    background: collection.background,
    collections: [collection],
  };
}

export function findCollection(board: BoardRow, id?: string | null): SceneCollection {
  const collections = boardCollections(board);
  if (id !== undefined && id !== null && id !== "") {
    const match = collections.find((collection) => collection.id === id);
    if (match !== undefined) return match;
  }
  return collections[0] ?? defaultCollection();
}

export function findCollectionForBand(board: BoardRow, bandId: string): SceneCollection | undefined {
  return boardCollections(board).find((collection) =>
    collectionFill(collection).bands.some((band) => band.id === bandId),
  );
}

/** Resolve which scene strip a canvas selection belongs to. */
export function selectionCollection(
  board: BoardRow,
  nodes: StudioNode[],
  selectedId: string | null,
): SceneCollection {
  const fromCollection = parseCollectionSelection(selectedId);
  if (fromCollection !== null) return findCollection(board, fromCollection);
  const slice = parseSliceSelection(selectedId);
  if (slice !== null) {
    return findCollection(board, slice.collectionId === "" ? undefined : slice.collectionId);
  }
  const bandId = parseBandSelection(selectedId);
  if (bandId !== null) {
    const match = findCollectionForBand(board, bandId);
    if (match !== undefined) return match;
  }
  const node = selectedId === null ? undefined : nodes.find((item) => item.id === selectedId);
  return findCollection(board, node?.collectionId);
}

export function remintCollectionFill(collection: SceneCollection): SceneCollection {
  const fill = collectionFill(collection);
  return {
    ...collection,
    background: writeBoardFill({
      ...fill,
      bands: fill.bands.map((band) => ({
        ...band,
        id: `band-${crypto.randomUUID().slice(0, 8)}`,
      })),
    }),
  };
}

export function patchCollection(
  board: BoardRow,
  id: string,
  patch: Partial<SceneCollection>,
): BoardRow {
  const collections = boardCollections(board).map((collection) =>
    collection.id === id ? { ...collection, ...patch, id: collection.id } : collection,
  );
  return mirrorBoard({ ...board, collections });
}

/** Fold a title-bar drag into the filmstrip group, then park the handle. */
export function applyCollectionHandleDrag(
  group: { x: number; y: number },
  handle: { x: number; y: number },
  restY = -COLLECTION_HANDLE,
): { group: { x: number; y: number }; handle: { x: number; y: number } } {
  return {
    group: { x: group.x + handle.x, y: group.y + handle.y - restY },
    handle: { x: 0, y: restY },
  };
}

export function collectionOrigin(board: BoardRow, collectionId: string): { x: number; y: number } {
  let stackedY = COLLECTION_HANDLE;
  for (const collection of boardCollections(board)) {
    const origin = {
      x: collection.x ?? 0,
      y: collection.y ?? stackedY,
    };
    if (collection.id === collectionId) return origin;
    stackedY = origin.y + collectionFrame(collection).height + COLLECTION_GAP;
  }
  return { x: 0, y: COLLECTION_HANDLE };
}

export function collectionBottom(board: BoardRow): number {
  let bottom = 0;
  for (const collection of boardCollections(board)) {
    const origin = collectionOrigin(board, collection.id);
    bottom = Math.max(bottom, origin.y + collectionFrame(collection).height);
  }
  return bottom;
}

export interface BoardBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export function boardBounds(board: BoardRow): BoardBounds {
  const collections = boardCollections(board);
  if (collections.length === 0) {
    return { minX: 0, minY: 0, width: 1080, height: 1920 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const collection of collections) {
    const origin = collectionOrigin(board, collection.id);
    const size = collectionFrame(collection);
    minX = Math.min(minX, origin.x);
    minY = Math.min(minY, origin.y - COLLECTION_HANDLE);
    maxX = Math.max(maxX, origin.x + size.width * collection.sliceCount);
    maxY = Math.max(maxY, origin.y + size.height);
  }
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/** Zoom and pan so every filmstrip sits in the viewport. */
export function fitCamera(
  bounds: BoardBounds,
  viewport: { width: number; height: number },
  padding = 48,
): { zoom: number; pan: { x: number; y: number } } {
  const availW = Math.max(64, viewport.width - padding * 2);
  const availH = Math.max(64, viewport.height - padding * 2);
  const zoom = Math.min(2.5, Math.max(0.08, Math.min(availW / bounds.width, availH / bounds.height)));
  return {
    zoom,
    pan: {
      x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
    },
  };
}

export const FIT_CAMERA_EVENT = "screenshot-studio:fit-camera";

export function nodeCollectionId(node: StudioNode, fallback: string): string {
  return node.collectionId === undefined || node.collectionId === "" ? fallback : node.collectionId;
}

export function nodesInCollection(
  nodes: StudioNode[],
  collectionId: string,
  fallbackId: string,
): StudioNode[] {
  return nodes.filter((node) => nodeCollectionId(node, fallbackId) === collectionId);
}

export function removeSceneCollection(
  board: BoardRow,
  nodes: StudioNode[],
  collectionId: string,
): { board: BoardRow; nodes: StudioNode[] } {
  const collections = boardCollections(board);
  if (collections.length <= 1) throw new Error("Keep at least one scene strip");
  const fallback = collections[0]?.id ?? DEFAULT_COLLECTION_ID;
  if (collections.every((collection) => collection.id !== collectionId)) {
    throw new Error("Unknown scene strip");
  }
  return {
    board: mirrorBoard({
      ...board,
      collections: collections.filter((collection) => collection.id !== collectionId),
    }),
    nodes: nodes.filter((node) => nodeCollectionId(node, fallback) !== collectionId),
  };
}

export function writeCollectionFill(collection: SceneCollection): SceneCollection {
  return { ...collection, background: writeBoardFill(collectionFill(collection)) };
}

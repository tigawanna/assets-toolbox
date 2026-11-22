import { deviceModel, type DeviceModelId } from "@/devices/catalog";
import { normalizeBands, type SliceBand } from "@/lib/bands";
import { findPreset, type PresetChoice, type StoreName } from "@/lib/presets";

export type { StoreName };
export type { SliceBand };
export type EventKind = "add" | "move" | "transform" | "edit" | "remove" | "board";
export type NodeType = "device" | "text" | "shape";

export interface BoardFill {
  color: string;
  imageId?: string;
  bands: SliceBand[];
}

export interface BoardRow {
  id: string;
  name: string;
  store: StoreName;
  presetId: string;
  sliceCount: number;
  background: string;
  /** Scene strips stacked on this board. Missing means one collection from the fields above. */
  collections?: import("@/lib/scenes").SceneCollection[];
}

export interface AssetRow {
  id: string;
  name: string;
  mime: string;
  data: string;
}

interface BaseNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  z?: number;
  /** Scene strip this node sits on. Missing means the first collection. */
  collectionId?: string;
}

export interface DeviceNode extends BaseNode {
  type: "device";
  model: DeviceModelId;
  color: "black" | "white" | "silver";
  screenColor?: string;
  screenAssetId?: string;
  /** When false, width and height can change independently. Missing means locked. */
  aspectLocked?: boolean;
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
  align: "left" | "center" | "right";
  color: string;
}

export interface ShapeNode extends BaseNode {
  type: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  radius: number;
}

export type StudioNode = DeviceNode | TextNode | ShapeNode;

export interface EventRow {
  id: string;
  seq: number;
  ts: string;
  kind: EventKind;
  label: string;
  nodeId: string;
  x: number;
  y: number;
  detail: string;
}

export interface StudioSnapshot {
  board: BoardRow;
  nodes: StudioNode[];
  events: EventRow[];
  assets: AssetRow[];
}

function parseBands(value: unknown): SliceBand[] {
  if (!Array.isArray(value)) return [];
  const bands: SliceBand[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id === "") continue;
    if (typeof row.start !== "number" || typeof row.count !== "number") continue;
    if (typeof row.color !== "string" || row.color === "") continue;
    const imageId = typeof row.imageId === "string" && row.imageId !== "" ? row.imageId : undefined;
    bands.push({
      id: row.id,
      start: row.start,
      count: row.count,
      color: row.color,
      ...(imageId === undefined ? {} : { imageId }),
    });
  }
  return bands;
}

export function parseBoardFill(raw: string): BoardFill {
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.color === "string" && parsed.color !== "") {
        const imageId =
          typeof parsed.imageId === "string" && parsed.imageId !== "" ? parsed.imageId : undefined;
        return {
          color: parsed.color,
          ...(imageId === undefined ? {} : { imageId }),
          bands: parseBands(parsed.bands),
        };
      }
    } catch {
      /* fall through to a solid color */
    }
  }
  return { color: raw === "" ? "#2a332c" : raw, bands: [] };
}

export function writeBoardFill(fill: BoardFill): string {
  const bands = fill.bands ?? [];
  const imageId = fill.imageId === undefined || fill.imageId === "" ? undefined : fill.imageId;
  if (imageId === undefined && bands.length === 0) return fill.color;
  return JSON.stringify({
    color: fill.color,
    ...(imageId === undefined ? {} : { imageId }),
    ...(bands.length === 0 ? {} : { bands }),
  });
}

export function boardFillFor(board: BoardRow): BoardFill {
  const fill = parseBoardFill(board.background);
  return { ...fill, bands: normalizeBands(fill.bands, board.sliceCount) };
}

export function assetUrl(assets: AssetRow[], id: string | undefined): string {
  if (id === undefined || id === "") return "";
  return assets.find((asset) => asset.id === id)?.data ?? "";
}

export const DEFAULT_BOARD_ID = "board";

export function defaultBoard(name = "Untitled"): BoardRow {
  const collection = {
    id: "col-main",
    name: "Scenes",
    store: "play" as const,
    presetId: "phone-portrait",
    sliceCount: 5,
    background: "#2a332c",
  };
  return {
    id: DEFAULT_BOARD_ID,
    name,
    store: collection.store,
    presetId: collection.presetId,
    sliceCount: collection.sliceCount,
    background: collection.background,
    collections: [collection],
  };
}

export function boardSize(board: BoardRow): PresetChoice {
  return (
    findPreset(board.store, board.presetId) ?? {
      store: board.store,
      id: board.presetId,
      label: board.presetId,
      width: 1080,
      height: 1920,
    }
  );
}

export const MAX_SLICES = 10;

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function cloneNode(node: StudioNode, dx = 0, dy = 0): StudioNode {
  const name = node.name.endsWith(" copy") ? node.name : `${node.name} copy`;
  return { ...node, id: uid(node.type), name, x: node.x + dx, y: node.y + dy };
}

export function nodeZ(node: StudioNode, fallback = 0): number {
  return typeof node.z === "number" ? node.z : fallback;
}

/** Painter order: lowest z is behind. */
export function stackNodes(nodes: StudioNode[]): StudioNode[] {
  const ranked = nodes.some((node) => typeof node.z === "number");
  if (!ranked) return [...nodes];
  return [...nodes].sort((a, b) => nodeZ(a) - nodeZ(b) || a.id.localeCompare(b.id));
}

/** Layers list order: front of the stack first. */
export function layerOrder(nodes: StudioNode[]): string[] {
  return [...stackNodes(nodes)].reverse().map((node) => node.id);
}

export function nextStackZ(nodes: StudioNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((node, index) => nodeZ(node, index))) + 1;
}

export function moveLayer(order: string[], id: string, toIndex: number): string[] {
  const without = order.filter((item) => item !== id);
  if (without.length === order.length) return order;
  const index = Math.max(0, Math.min(without.length, toIndex));
  return [...without.slice(0, index), id, ...without.slice(index)];
}

export function stackPatches(nodes: StudioNode[], order: string[]): { id: string; z: number }[] {
  const count = order.length;
  return order
    .map((id, index) => ({ id, z: count - 1 - index }))
    .filter((item) => {
      const node = nodes.find((entry) => entry.id === item.id);
      return node !== undefined && nodeZ(node) !== item.z;
    });
}

export function createAsset(name: string, mime: string, data: string): AssetRow {
  return { id: uid("asset"), name, mime, data };
}

export function createDeviceNode(modelId: DeviceModelId, board: BoardRow, slice = 0): DeviceNode {
  const preset = boardSize(board);
  const model = deviceModel(modelId);
  const height = Math.round(preset.height * 0.62);
  const width = Math.round(height * (model.frame.w / model.frame.h));
  const index = Math.max(0, Math.min(board.sliceCount - 1, slice));
  return {
    id: uid("device"),
    name: model.label,
    type: "device",
    model: modelId,
    color: "black",
    x: index * preset.width + Math.round((preset.width - width) / 2),
    y: Math.round(preset.height * 0.22),
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    aspectLocked: true,
    collectionId: board.collections?.some((collection) => collection.id === board.id)
      ? board.id
      : board.collections?.[0]?.id,
  };
}

export function deviceFrameRatio(modelId: DeviceModelId): number {
  const frame = deviceModel(modelId).frame;
  return frame.w / frame.h;
}

/** Old nodes without the flag stay locked. */
export function deviceAspectLocked(node: DeviceNode): boolean {
  return node.aspectLocked !== false;
}

export function deviceLooksStretched(node: DeviceNode): boolean {
  const expected = deviceFrameRatio(node.model);
  const current = node.width / Math.max(1, node.height);
  return Math.abs(current - expected) / expected > 0.02;
}

/** Keep height, fix width to the catalog ratio, and re-lock. */
export function restoreDeviceAspect(node: DeviceNode): Partial<DeviceNode> {
  const height = Math.max(24, node.height);
  const width = Math.max(24, Math.round(height * deviceFrameRatio(node.model)));
  return {
    width,
    height,
    x: node.x + Math.round((node.width - width) / 2),
    aspectLocked: true,
  };
}

export function resizeDevice(
  node: DeviceNode,
  dim: "width" | "height",
  value: number,
): Partial<DeviceNode> {
  const size = Math.max(24, value);
  if (!deviceAspectLocked(node)) return { [dim]: size };
  const ratio = deviceFrameRatio(node.model);
  if (dim === "width") {
    return { width: size, height: Math.max(24, Math.round(size / ratio)) };
  }
  return { height: size, width: Math.max(24, Math.round(size * ratio)) };
}

function deviceNameAfterRetarget(name: string, previousLabel: string, nextLabel: string): string {
  if (name === `${previousLabel} copy`) return `${nextLabel} copy`;
  if (name === previousLabel) return nextLabel;
  return name;
}

/** Swap a device's model, keep height, and recentre if the aspect changes. */
export function retargetDevice(node: DeviceNode, modelId: DeviceModelId): Partial<DeviceNode> {
  if (node.model === modelId) return {};
  const previous = deviceModel(node.model);
  const next = deviceModel(modelId);
  const width = Math.max(24, Math.round(node.height * (next.frame.w / next.frame.h)));
  return {
    model: modelId,
    name: deviceNameAfterRetarget(node.name, previous.label, next.label),
    width,
    x: node.x + Math.round((node.width - width) / 2),
  };
}

export function createTextNode(board: BoardRow, role: "headline" | "subtext", slice = 0): TextNode {
  const preset = boardSize(board);
  const index = Math.max(0, Math.min(board.sliceCount - 1, slice));
  const headline = role === "headline";
  return {
    id: uid("text"),
    name: headline ? "Headline" : "Subtext",
    type: "text",
    text: headline ? "A feature that sells the shot" : "One line under the headline.",
    fontSize: headline ? 72 : 36,
    fontWeight: headline ? 700 : 400,
    align: "center",
    color: "#f4f6f2",
    x: index * preset.width + 64,
    y: headline ? 72 : 220,
    width: preset.width - 128,
    height: headline ? 160 : 96,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    collectionId: board.collections?.[0]?.id,
  };
}

export function createShapeNode(board: BoardRow, slice = 0): ShapeNode {
  const preset = boardSize(board);
  const index = Math.max(0, Math.min(board.sliceCount - 1, slice));
  return {
    id: uid("shape"),
    name: "Fill",
    type: "shape",
    shape: "rect",
    fill: "#1f8a4c",
    radius: 0,
    x: index * preset.width,
    y: 0,
    width: preset.width,
    height: preset.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    collectionId: board.collections?.[0]?.id,
  };
}

export function parseNode(value: string): StudioNode {
  return JSON.parse(value) as StudioNode;
}

export interface EventSnapshot {
  board: BoardRow;
  nodes: StudioNode[];
}

export function parseEventSnapshot(detail: string): EventSnapshot | null {
  if (detail === "") return null;
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (!Array.isArray(parsed.nodes)) return null;
    if (parsed.board === null || typeof parsed.board !== "object") return null;
    return { board: parsed.board as BoardRow, nodes: parsed.nodes as StudioNode[] };
  } catch {
    return null;
  }
}

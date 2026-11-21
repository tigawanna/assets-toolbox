import type {
  DeviceModelId,
  DeviceNode,
  FadeNode,
  GlowNode,
  ImageNode,
  Node,
  ShapeNode,
  TextNode,
} from "../model/schema";

let counter = 0;
export function uid(prefix = "node"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

interface Base {
  x: number;
  y: number;
  name?: string;
  rotation?: number;
  opacity?: number;
  width: number;
  height: number;
}

export function deviceNode(
  base: Base,
  model: DeviceModelId,
  assetId: string,
  overrides: Partial<DeviceNode> = {},
): DeviceNode {
  return {
    id: overrides.id ?? uid("device"),
    name: base.name ?? "Device",
    type: "device",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: base.rotation ?? 0,
    opacity: base.opacity ?? 1,
    model,
    color: "black",
    screenAspect: "match",
    statusBar: "hidden",
    content: {
      assetId,
      fit: "cover",
      offset: { x: 0, y: 0 },
      zoom: 1,
      trim: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    ...overrides,
  };
}

export function textNode(
  base: Base,
  text: string,
  size: number,
  color: string,
  overrides: Partial<TextNode> = {},
): TextNode {
  return {
    id: overrides.id ?? uid("text"),
    name: base.name ?? "Text",
    type: "text",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: base.rotation ?? 0,
    opacity: base.opacity ?? 1,
    text,
    font: { family: "Inter", weight: 700, size },
    color,
    align: "left",
    lineHeight: 1.15,
    role: "headline",
    ...overrides,
  };
}

export function glowNode(base: Base, color: string, overrides: Partial<GlowNode> = {}): GlowNode {
  return {
    id: overrides.id ?? uid("glow"),
    name: base.name ?? "Glow",
    type: "glow",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: 0,
    opacity: 1,
    color,
    core: 0,
    ...overrides,
  };
}

export function shapeNode(
  base: Base,
  fill: ShapeNode["fill"],
  overrides: Partial<ShapeNode> = {},
): ShapeNode {
  return {
    id: overrides.id ?? uid("shape"),
    name: base.name ?? "Shape",
    type: "shape",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: 0,
    opacity: 1,
    shape: "rect",
    fill,
    radius: 0,
    ...overrides,
  };
}

export function fadeNode(base: Base, color: string, overrides: Partial<FadeNode> = {}): FadeNode {
  return {
    id: overrides.id ?? uid("fade"),
    name: base.name ?? "Fade",
    type: "fade",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: 0,
    opacity: 1,
    color,
    angle: 90,
    strength: 1,
    ...overrides,
  };
}

export function imageNode(
  base: Base,
  assetId: string,
  overrides: Partial<ImageNode> = {},
): ImageNode {
  return {
    id: overrides.id ?? uid("image"),
    name: base.name ?? "Image",
    type: "image",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: 0,
    opacity: 1,
    assetId,
    fit: "contain",
    mask: "rect",
    radius: 0,
    ...overrides,
  };
}

export function nodes(...items: Node[]): Node[] {
  return items;
}

import type { DeviceModelId } from "../model/schema";

export type OverlayKind =
  | "punch-hole"
  | "notch"
  | "island"
  | "hinge"
  | "camera"
  | "browser-chrome"
  | "buttons"
  | "laptop-deck"
  | "stand";

export interface OverlaySpec {
  kind: OverlayKind;
  /** Position in frame-local units (0..frame.w, 0..frame.h). */
  x: number;
  y: number;
  size: number;
}

export interface DeviceModel {
  id: DeviceModelId;
  label: string;
  formFactor: "phone" | "tablet" | "foldable" | "desktop";
  /** Frame size in device-local units; the node transform scales it. */
  frame: { w: number; h: number; radius: number; bezel: number };
  /** Screen rect inside the frame; the capture clips to this. */
  screen: { x: number; y: number; w: number; h: number; radius: number };
  overlays: OverlaySpec[];
  /** Default screen aspect; "match" lets the capture decide. */
  screenAspect: number | "match";
  colours: Record<"black" | "white" | "silver", { frame: string; edge: string; screenBg: string }>;
}

const COLOURS: DeviceModel["colours"] = {
  black: { frame: "#161718", edge: "#3a3c3d", screenBg: "#050505" },
  white: { frame: "#f2f2ef", edge: "#c9c9c4", screenBg: "#0a0a0a" },
  silver: { frame: "#c8c9c6", edge: "#9b9d99", screenBg: "#080808" },
};

function model(
  id: DeviceModelId,
  label: string,
  formFactor: DeviceModel["formFactor"],
  aspect: number,
  bezelRatio: number,
  overlays: OverlaySpec[] = [],
): DeviceModel {
  const w = 1000;
  const h = Math.round(w / aspect);
  const bezel = Math.round(w * bezelRatio);
  return {
    id,
    label,
    formFactor,
    frame: { w, h, radius: Math.round(w * 0.12), bezel },
    screen: {
      x: bezel,
      y: bezel,
      w: w - bezel * 2,
      h: h - bezel * 2,
      radius: Math.round(w * 0.095),
    },
    overlays,
    screenAspect: aspect,
    colours: COLOURS,
  };
}

export const DEVICE_MODELS: Record<DeviceModelId, DeviceModel> = {
  "phone-punch": model("phone-punch", "Phone · punch hole", "phone", 9 / 20, 0.03, [
    { kind: "punch-hole", x: 500, y: 48, size: 28 },
    { kind: "buttons", x: 1000, y: 320, size: 70 },
  ]),
  "phone-flat": model("phone-flat", "Phone · flat", "phone", 9 / 19.5, 0.035, [
    { kind: "camera", x: 500, y: 50, size: 12 },
  ]),
  tablet: model("tablet", "Tablet", "tablet", 16 / 10, 0.022, [
    { kind: "camera", x: 500, y: 24, size: 10 },
  ]),
  "foldable-open": model("foldable-open", "Foldable · open", "foldable", 6 / 5, 0.02, [
    { kind: "hinge", x: 500, y: 0, size: 10 },
    { kind: "punch-hole", x: 500, y: 36, size: 22 },
  ]),
  "foldable-cover": model("foldable-cover", "Foldable · cover", "foldable", 10 / 21, 0.03, [
    { kind: "punch-hole", x: 500, y: 46, size: 24 },
  ]),
  laptop: model("laptop", "Laptop / Chromebook", "desktop", 16 / 10, 0.025, [
    { kind: "camera", x: 500, y: 20, size: 8 },
    { kind: "laptop-deck", x: 0, y: 0, size: 0 },
  ]),
  browser: model("browser", "Browser window", "desktop", 16 / 10, 0.02, [
    { kind: "browser-chrome", x: 0, y: 0, size: 48 },
  ]),
  monitor: model("monitor", "Monitor", "desktop", 16 / 9, 0.018, [
    { kind: "stand", x: 0, y: 0, size: 0 },
  ]),
  "iphone-island": model("iphone-island", "iPhone · Dynamic Island", "phone", 9 / 19.5, 0.025, [
    { kind: "island", x: 500, y: 46, size: 120 },
  ]),
  "iphone-notch": model("iphone-notch", "iPhone · notch", "phone", 9 / 19.5, 0.025, [
    { kind: "notch", x: 500, y: 0, size: 110 },
  ]),
  ipad: model("ipad", "iPad", "tablet", 3 / 4, 0.022, [
    { kind: "camera", x: 500, y: 24, size: 10 },
  ]),
};

export const DEVICE_MODEL_IDS = Object.keys(DEVICE_MODELS) as DeviceModelId[];

export function deviceModel(id: DeviceModelId): DeviceModel {
  return DEVICE_MODELS[id];
}

/** Pick a device model from a capture's aspect ratio (PLAN 4.4). */
export function autoPickModel(
  width: number,
  height: number,
  store: "play" | "app-store",
): DeviceModelId {
  const ratio = height / width;
  if (store === "app-store") return ratio > 1.5 ? "iphone-island" : "ipad";
  if (ratio > 1.75) return "phone-punch";
  if (ratio > 1.3) return "tablet";
  return "foldable-open";
}

export type DeviceModelId =
  | "phone-punch"
  | "phone-flat"
  | "tablet"
  | "foldable-open"
  | "foldable-cover"
  | "laptop"
  | "browser"
  | "iphone-island"
  | "iphone-notch"
  | "ipad";

export type OverlayKind =
  | "punch-hole"
  | "notch"
  | "island"
  | "hinge"
  | "camera"
  | "browser-chrome"
  | "buttons"
  | "laptop-deck";

export interface OverlaySpec {
  kind: OverlayKind;
  x: number;
  y: number;
  size: number;
}

export interface DeviceModel {
  id: DeviceModelId;
  label: string;
  formFactor: "phone" | "tablet" | "foldable" | "desktop";
  frame: { w: number; h: number; radius: number; bezel: number };
  screen: { x: number; y: number; w: number; h: number; radius: number };
  overlays: OverlaySpec[];
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

export type DeviceFamily = "android" | "apple" | "desktop";

export function deviceFamily(id: DeviceModelId): DeviceFamily {
  if (id.startsWith("iphone") || id === "ipad") return "apple";
  if (id === "laptop" || id === "browser") return "desktop";
  return "android";
}

export const DEVICE_GROUPS: { id: DeviceFamily; label: string; ids: DeviceModelId[] }[] = [
  {
    id: "android",
    label: "Android",
    ids: DEVICE_MODEL_IDS.filter((id) => deviceFamily(id) === "android"),
  },
  {
    id: "apple",
    label: "Apple",
    ids: DEVICE_MODEL_IDS.filter((id) => deviceFamily(id) === "apple"),
  },
  {
    id: "desktop",
    label: "Desktop",
    ids: DEVICE_MODEL_IDS.filter((id) => deviceFamily(id) === "desktop"),
  },
];

export const DEVICE_PAIRS = [
  {
    id: "phones",
    label: "Phones · both stores",
    android: "phone-punch",
    apple: "iphone-island",
  },
  { id: "tablets", label: "Tablets · both stores", android: "tablet", apple: "ipad" },
] as const;

export function deviceModel(id: DeviceModelId): DeviceModel {
  return DEVICE_MODELS[id];
}

export type StoreName = "play" | "app-store";

export interface PresetChoice {
  store: StoreName;
  id: string;
  label: string;
  width: number;
  height: number;
}

interface FrameSize {
  id: string;
  width: number;
  height: number;
}

/** Google Play listing frames. The icon is a store asset, not a screenshot holder. */
const PLAY_FRAMES: FrameSize[] = [
  { id: "phone-portrait", width: 1080, height: 1920 },
  { id: "phone-landscape", width: 1920, height: 1080 },
  { id: "phone-tall", width: 1080, height: 2400 },
  { id: "tablet-portrait", width: 1600, height: 2560 },
  { id: "tablet-landscape", width: 2560, height: 1600 },
  { id: "foldable-square", width: 2106, height: 2106 },
  { id: "foldable-wide", width: 2688, height: 2016 },
  { id: "foldable-cover", width: 1260, height: 2016 },
  { id: "chromebook", width: 1920, height: 1080 },
  { id: "wear", width: 384, height: 384 },
  { id: "tv", width: 1920, height: 1080 },
  { id: "tv-banner", width: 1280, height: 720 },
  { id: "xr", width: 3840, height: 2400 },
  { id: "auto-portrait", width: 800, height: 1280 },
  { id: "auto-landscape", width: 1024, height: 768 },
  { id: "feature-graphic", width: 1024, height: 500 },
];

/** App Store Connect screenshot frames. */
const APP_STORE_FRAMES: FrameSize[] = [
  { id: "iphone-6-9", width: 1320, height: 2868 },
  { id: "iphone-6-5", width: 1284, height: 2778 },
  { id: "ipad-13", width: 2064, height: 2752 },
  { id: "ipad-12-9", width: 2048, height: 2732 },
  { id: "iphone-6-9-landscape", width: 2868, height: 1320 },
  { id: "iphone-6-5-landscape", width: 2778, height: 1284 },
  { id: "ipad-13-landscape", width: 2752, height: 2064 },
  { id: "ipad-12-9-landscape", width: 2732, height: 2048 },
];

function title(id: string): string {
  const text = id.replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function choices(store: StoreName, frames: FrameSize[]): PresetChoice[] {
  return frames.map((frame) => ({
    store,
    id: frame.id,
    label: title(frame.id),
    width: frame.width,
    height: frame.height,
  }));
}

/** Listing sizes the canvas can place. */
export function listPresets(): PresetChoice[] {
  return [...choices("play", PLAY_FRAMES), ...choices("app-store", APP_STORE_FRAMES)];
}

export function findPreset(store: StoreName, id: string): PresetChoice | undefined {
  return listPresets().find((preset) => preset.store === store && preset.id === id);
}

/** On-canvas size. Device pixels stay on the frame; the board shows a readable stand-in. */
export function displaySize(width: number, height: number): { width: number; height: number } {
  const scale = 280 / 1080;
  return {
    width: Math.max(96, Math.round(width * scale)),
    height: Math.max(64, Math.round(height * scale)),
  };
}

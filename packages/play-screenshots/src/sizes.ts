import type { PlayStorePreset } from "./types";

export type { PlayStorePreset, PlayStoreSection } from "./types";

/**
 * Official-ish Google Play listing sizes.
 *
 * Phone / tablet / feature-graphic numbers follow Play Console Help
 * (JPEG or 24-bit PNG, no alpha; long side ≤ 2.3× short side).
 * Foldable / desktop / wear numbers follow the Android CLI capture guide.
 *
 * @see https://support.google.com/googleplay/android-developer/answer/9866151
 * @see https://developer.android.com/google/play/requirements/screenshots-android-cli
 */
export const PLAY_STORE_PRESETS = {
  "phone-portrait": {
    id: "phone-portrait",
    section: "phone",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    flatten: true,
    notes: "Recommended phone portrait for promotion (min 1080×1920).",
  },
  "phone-landscape": {
    id: "phone-landscape",
    section: "phone",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    flatten: true,
    notes: "Recommended phone landscape for promotion (min 1920×1080).",
  },
  "phone-tall": {
    id: "phone-tall",
    section: "phone",
    width: 1080,
    height: 2400,
    ratio: "20:9",
    flatten: true,
    notes: "medium_phone emulator capture size. Within the 2.3:1 long-side cap.",
  },
  "tablet-portrait": {
    id: "tablet-portrait",
    section: "tablet-10",
    width: 1600,
    height: 2560,
    ratio: "10:16",
    flatten: true,
    notes: "Fits 7-inch and 10-inch tablet slots. Duplicate into both sections.",
  },
  "tablet-landscape": {
    id: "tablet-landscape",
    section: "tablet-10",
    width: 2560,
    height: 1600,
    ratio: "16:10",
    flatten: true,
    notes: "medium_tablet emulator capture size. Upload to 7-inch and 10-inch.",
  },
  "foldable-square": {
    id: "foldable-square",
    section: "foldable",
    width: 2106,
    height: 2106,
    ratio: "1:1",
    flatten: true,
    notes: "Unfolded 1:1 inner display. Required if you upload foldable shots.",
  },
  "foldable-wide": {
    id: "foldable-wide",
    section: "foldable",
    width: 2688,
    height: 2016,
    ratio: "4:3",
    flatten: true,
    notes: "Unfolded 4:3 inner display.",
  },
  "foldable-cover": {
    id: "foldable-cover",
    section: "foldable",
    width: 1260,
    height: 2016,
    ratio: "10:16",
    flatten: true,
    notes: "Folded 4:3 outer display portrait. Do not put 9:16 folds here.",
  },
  chromebook: {
    id: "chromebook",
    section: "chromebook",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    flatten: true,
    notes: "large_desktop / Chromebook slot. 4–8 shots recommended.",
  },
  wear: {
    id: "wear",
    section: "wear",
    width: 384,
    height: 384,
    ratio: "1:1",
    flatten: true,
    notes: "Wear OS forbids device frames, extra text, and transparent masking.",
  },
  tv: {
    id: "tv",
    section: "tv",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    flatten: true,
    notes: "At least one TV screenshot is required to publish a TV app.",
  },
  "tv-banner": {
    id: "tv-banner",
    section: "tv-banner",
    width: 1280,
    height: 720,
    ratio: "16:9",
    flatten: true,
    notes: "Required TV banner. JPEG or 24-bit PNG, no alpha.",
  },
  xr: {
    id: "xr",
    section: "xr",
    width: 3840,
    height: 2400,
    ratio: "8:5",
    flatten: true,
    notes: "Android XR. 4–8 shots, min 1920×1200.",
  },
  "auto-portrait": {
    id: "auto-portrait",
    section: "automotive",
    width: 800,
    height: 1280,
    ratio: "5:8",
    flatten: true,
    notes: "Automotive Portrait hardware profile. No OEM-specific chrome.",
  },
  "auto-landscape": {
    id: "auto-landscape",
    section: "automotive",
    width: 1024,
    height: 768,
    ratio: "4:3",
    flatten: true,
    notes: "Automotive (1024p landscape) hardware profile.",
  },
  "feature-graphic": {
    id: "feature-graphic",
    section: "feature-graphic",
    width: 1024,
    height: 500,
    ratio: "1024:500",
    flatten: true,
    notes: "Required to publish. Keep focal point centered; avoid cutoff zones.",
  },
  "play-icon": {
    id: "play-icon",
    section: "play-icon",
    width: 512,
    height: 512,
    ratio: "1:1",
    flatten: false,
    notes: "32-bit PNG with alpha, max 1024 KB. Not a screenshot.",
  },
} as const satisfies Record<string, PlayStorePreset>;

export type PlayStorePresetId = keyof typeof PLAY_STORE_PRESETS;

export const PLAY_STORE_PRESET_IDS = Object.keys(PLAY_STORE_PRESETS) as PlayStorePresetId[];

export function getPreset(id: string): PlayStorePreset {
  if (id in PLAY_STORE_PRESETS) return PLAY_STORE_PRESETS[id as PlayStorePresetId];
  throw new Error(`Unknown preset "${id}". Valid: ${PLAY_STORE_PRESET_IDS.join(", ")}`);
}

/** Long side may not exceed 2.3× the short side for standard phone/tablet shots. */
export function assertPlayBounds(preset: PlayStorePreset): void {
  const long = Math.max(preset.width, preset.height);
  const short = Math.min(preset.width, preset.height);
  if (short < 320)
    throw new Error(`${preset.id}: short side ${short}px is below the 320px minimum`);
  if (long > 7680) throw new Error(`${preset.id}: long side ${long}px exceeds the 7680px maximum`);
  if (
    (preset.section === "phone" ||
      preset.section === "tablet-7" ||
      preset.section === "tablet-10") &&
    long > short * 2.3
  ) {
    throw new Error(`${preset.id}: ${long}/${short} exceeds the 2.3:1 Play Console cap`);
  }
}

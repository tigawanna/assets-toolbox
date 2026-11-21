import type { AppStorePreset } from "./types";

/**
 * App Store Connect screenshot sizes. Apple accepts these and scales down from
 * them for smaller devices of the same display class.
 *
 * VERIFY — every number marked "verify" below must be re-checked against
 * https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
 * before release. Apple adds display sizes over time; keep all numbers here.
 *
 *   iphone-6-9          1320 verify × 2868 verify  (portrait)
 *   iphone-6-5          1284 verify × 2778 verify  (portrait; 1242×2688 verify also accepted)
 *   ipad-13             2064 verify × 2752 verify  (portrait)
 *   ipad-12-9           2048 verify × 2732 verify  (portrait)
 *   landscape variants  sides swapped, same verify numbers
 *
 * Flatten is always true: App Store Connect rejects transparency (verify).
 * App previews (video) and a feature-graphic equivalent are out of scope:
 * neither exists in this package (verify that no new asset type is required).
 */
export const APP_STORE_PRESETS = {
  "iphone-6-9": {
    id: "iphone-6-9",
    section: "iphone",
    width: 1320, // verify
    height: 2868, // verify
    ratio: "1320:2868",
    flatten: true, // verify
    notes: "Largest iPhone slot. Supplying this covers the smaller iPhones (verify).",
  },
  "iphone-6-5": {
    id: "iphone-6-5",
    section: "iphone",
    width: 1284, // verify
    height: 2778, // verify
    ratio: "1284:2778",
    flatten: true, // verify
    notes: 'Also accepts 1242×2688 (verify). Only needed if the app does not run on 6.9".',
  },
  "ipad-13": {
    id: "ipad-13",
    section: "ipad",
    width: 2064, // verify
    height: 2752, // verify
    ratio: "2064:2752",
    flatten: true, // verify
    notes: "Largest iPad slot. Supplying this covers the smaller iPads (verify).",
  },
  "ipad-12-9": {
    id: "ipad-12-9",
    section: "ipad",
    width: 2048, // verify
    height: 2732, // verify
    ratio: "2048:2732",
    flatten: true, // verify
    notes: "Older iPad slot, still accepted (verify).",
  },
  "iphone-6-9-landscape": {
    id: "iphone-6-9-landscape",
    section: "iphone",
    width: 2868, // verify
    height: 1320, // verify
    ratio: "2868:1320",
    flatten: true, // verify
    notes: "Landscape counterpart of iphone-6-9 (verify).",
  },
  "iphone-6-5-landscape": {
    id: "iphone-6-5-landscape",
    section: "iphone",
    width: 2778, // verify
    height: 1284, // verify
    ratio: "2778:1284",
    flatten: true, // verify
    notes: "Landscape counterpart of iphone-6-5 (verify).",
  },
  "ipad-13-landscape": {
    id: "ipad-13-landscape",
    section: "ipad",
    width: 2752, // verify
    height: 2064, // verify
    ratio: "2752:2064",
    flatten: true, // verify
    notes: "Landscape counterpart of ipad-13 (verify).",
  },
  "ipad-12-9-landscape": {
    id: "ipad-12-9-landscape",
    section: "ipad",
    width: 2732, // verify
    height: 2048, // verify
    ratio: "2732:2048",
    flatten: true, // verify
    notes: "Landscape counterpart of ipad-12-9 (verify).",
  },
} as const satisfies Record<string, AppStorePreset>;

export type AppStorePresetId = keyof typeof APP_STORE_PRESETS;

export const APP_STORE_PRESET_IDS = Object.keys(APP_STORE_PRESETS) as AppStorePresetId[];

export function getPreset(id: string): AppStorePreset {
  if (id in APP_STORE_PRESETS) return APP_STORE_PRESETS[id as AppStorePresetId];
  throw new Error(`Unknown preset "${id}". Valid: ${APP_STORE_PRESET_IDS.join(", ")}`);
}

/**
 * Sanity bounds for preset definitions. The numbers are advisory, not policy:
 * Apple scales submissions down, but absurdly small or huge files are a bug.
 * All bounds marked "verify" — re-check them with the specifications above.
 */
export function assertAppStoreBounds(preset: AppStorePreset): void {
  const long = Math.max(preset.width, preset.height);
  const short = Math.min(preset.width, preset.height);
  if (!Number.isInteger(preset.width) || !Number.isInteger(preset.height)) {
    throw new Error(`${preset.id}: dimensions must be whole pixels`);
  }
  if (short < 320) {
    throw new Error(`${preset.id}: short side ${short}px is below the 320px verify floor`);
  }
  if (long > 7680) {
    throw new Error(`${preset.id}: long side ${long}px exceeds the 7680px verify ceiling`);
  }
  if (preset.section !== "iphone" && preset.section !== "ipad") {
    throw new Error(`${preset.id}: unsupported section`);
  }
}

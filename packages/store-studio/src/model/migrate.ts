import { PLAY_STORE_PRESETS, getPreset } from "@tigawanna/play-screenshots/sizes";

import { SCHEMA_VERSION, StudioProjectSchema, type BoardKind, type StudioProject } from "./schema";

/** Board kind → the store preset it is based on. */
export const PLAY_BOARD_PRESETS: Record<BoardKind, string> = {
  phone: "phone-portrait",
  tablet: "tablet-landscape",
  foldable: "foldable-square",
  chromebook: "chromebook",
  feature: "feature-graphic",
  iphone: "iphone-6-9",
  ipad: "ipad-13",
};

export function presetForKind(kind: BoardKind, store: StudioProject["store"]): string {
  if (store === "app-store") return kind === "ipad" ? "ipad-13" : "iphone-6-9";
  return PLAY_BOARD_PRESETS[kind];
}

export function boardSize(presetId: string): { width: number; height: number } {
  const preset = getPreset(presetId);
  return { width: preset.width, height: preset.height };
}

export function createDefaultProject(store: StudioProject["store"] = "play"): StudioProject {
  const kind: BoardKind = store === "play" ? "phone" : "iphone";
  const preset = presetForKind(kind, store);
  return StudioProjectSchema.parse({
    version: SCHEMA_VERSION,
    store,
    app: { name: "My App" },
    theme: {
      tokens: {
        primary: "#635bff",
        accent: "#ffb86b",
        background: "#0f100f",
        surface: "#1b1d1b",
        text: "#f7f7f3",
        muted: "#a8ada3",
      },
      fonts: {
        heading: { family: "Inter", weight: 700, size: 84 },
        body: { family: "Inter", weight: 400, size: 36 },
      },
    },
    assets: {},
    boards: [
      {
        id: "board-phone-1",
        kind,
        preset,
        sliceCount: 1,
        background: { type: "solid", color: { token: "background" } },
        nodes: [],
        sliceMeta: [{}],
      },
    ],
    export: {
      outDir: store === "play" ? "store/google" : "store/appstore",
      format: "png",
      layout: "flat",
      locale: "en-US",
      zip: false,
    },
  });
}

/** Accept older/partial documents and bring them up to the current schema. */
export function migrateProject(value: unknown): StudioProject {
  if (typeof value !== "object" || value === null) throw new Error("Project must be an object");
  const input = value as Record<string, unknown>;
  const store = input.store === "app-store" ? "app-store" : "play";
  const normalized = {
    ...input,
    version: SCHEMA_VERSION,
    store,
    app: input.app ?? { name: "My App" },
    theme: input.theme ?? createDefaultProject(store).theme,
    assets: input.assets ?? {},
    export: input.export ?? createDefaultProject(store).export,
  };
  return StudioProjectSchema.parse(normalized);
}

export { PLAY_STORE_PRESETS };

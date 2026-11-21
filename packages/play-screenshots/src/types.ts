export type PlayStoreSection =
  | "phone"
  | "tablet-7"
  | "tablet-10"
  | "foldable"
  | "chromebook"
  | "wear"
  | "tv"
  | "automotive"
  | "xr"
  | "feature-graphic"
  | "tv-banner"
  | "play-icon";

export interface PlayStorePreset {
  id: string;
  /** Play Console Graphics section this file belongs to. */
  section: PlayStoreSection;
  width: number;
  height: number;
  ratio: string;
  /** Flatten onto an opaque background. Screenshots and the feature graphic must. */
  flatten: boolean;
  notes: string;
}

export type OutputFormat = "png" | "jpeg";
export type RenderMode = "fit" | "frame";
export type ExportLayout = "flat" | "fastlane";

export interface GeneratedAsset {
  name: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
  section: PlayStoreSection;
  preset: string;
  format: OutputFormat;
  /** Relative path used in the JSON inventory (differs from `path` under fastlane). */
  inventoryPath?: string;
  alt?: string;
}

export interface PlayScreenshotShot {
  /** Path to a raw capture (PNG, JPEG, or SVG). */
  file: string;
  /** Alt text for Play Console. Max 140 characters. */
  alt?: string | undefined;
  /** Frame-mode headline for this shot (overrides the top-level `title`). */
  title?: string | undefined;
  /** Frame-mode subtitle for this shot (overrides the top-level `subtitle`). */
  subtitle?: string | undefined;
}

export interface PlayScreenshotOptions {
  shots: PlayScreenshotShot[];
  /** Output directory. Default `store/google` relative to the cwd. */
  outDir?: string | undefined;
  /** Letterbox / flatten color. Default `#0f100f`. */
  brandColor?: string | undefined;
  /** Target sizes. Default `["phone-portrait"]`. */
  presets?: string[] | undefined;
  /** Also emit `feature-graphic.png` (1024×500) from the first shot or `featureSource`. */
  featureGraphic?: boolean | undefined;
  /** Optional dedicated source for the feature graphic. */
  featureSource?: string | undefined;
  /** Write the JSON inventory. Default true. */
  writeConfig?: boolean | undefined;
  /** Where to write the inventory. Default `<outDir>/play-screenshots.config.json`. */
  configOut?: string | undefined;
  /** Output encoding. Default `png`. */
  format?: OutputFormat | undefined;
  /** `fit` letterboxes raw captures; `frame` composes a marketing layout. Default `fit`. */
  mode?: RenderMode | undefined;
  /** Frame-mode headline applied to every shot unless the shot overrides it. */
  title?: string | undefined;
  /** Frame-mode subtitle applied to every shot unless the shot overrides it. */
  subtitle?: string | undefined;
  /** Path to a `.ts/.tsx` React component used as the frame in `frame` mode. */
  component?: string | undefined;
  /** Named export to use from `component`. */
  exportName?: string | undefined;
  /** App-store locale used by the fastlane layout. Default `en-US`. */
  locale?: string | undefined;
  /** `flat` writes everything into `outDir`; `fastlane` writes the metadata tree. */
  layout?: ExportLayout | undefined;
  /** Font family used by the built-in Takumi templates. Default `Inter`. */
  fontFamily?: string | undefined;
  /** Extra props forwarded to a custom frame component. */
  props?: Record<string, unknown> | undefined;
}

export interface PlayScreenshotsConfig {
  version: 1;
  store: "play";
  layout: ExportLayout;
  locale: string;
  format: OutputFormat;
  play: {
    phone: string[];
    tablet7: string[];
    tablet10: string[];
    foldable: string[];
    chromebook: string[];
    wear: string[];
    tv: string[];
    automotive: string[];
    xr: string[];
    featureGraphic?: string;
    tvBanner?: string;
    playIcon?: string;
  };
  assets: Array<{
    name: string;
    path: string;
    width: number;
    height: number;
    section: PlayStoreSection;
    preset: string;
    format: OutputFormat;
    alt?: string;
  }>;
}

export interface PlayScreenshotsResult {
  outDir: string;
  assets: GeneratedAsset[];
  config: PlayScreenshotsConfig;
  configPath?: string;
  /** One-line instruction an agent can follow to upload the files. */
  agentPrompt: string;
  /** Non-fatal policy notes (counts, contrast, tagline coverage). */
  warnings: string[];
}

export const PLAY_SCREENSHOT_DEFAULTS = {
  outDir: "store/google",
  brandColor: "#0f100f",
  presets: ["phone-portrait"] as const,
  format: "png" as const,
  mode: "fit" as const,
  locale: "en-US",
  layout: "flat" as const,
  fontFamily: "Inter",
} as const;

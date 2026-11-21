/** The two App Store screenshot sections in scope (Mac is out of scope). */
export type AppStoreSection = "iphone" | "ipad";

export type OutputFormat = "png" | "jpeg";

/** `flat` writes into outDir; `deliver` writes fastlane's screenshots tree. */
export type ExportLayout = "flat" | "deliver";

export interface AppStorePreset {
  id: string;
  /** App Store Connect display-size section this file belongs to. */
  section: AppStoreSection;
  width: number;
  height: number;
  ratio: string;
  /** App Store Connect rejects transparency: always flatten onto the brand color. */
  flatten: boolean;
  notes: string;
}

export interface GeneratedAsset {
  name: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
  section: AppStoreSection;
  preset: string;
  format: OutputFormat;
  /** Relative path used in the JSON inventory (differs from `path` under deliver). */
  inventoryPath?: string;
  alt?: string;
}

export interface AppStoreScreenshotShot {
  /** Path to a raw simulator capture (PNG or JPEG). */
  file: string;
  /** Alt text for the listing. Max 140 characters. */
  alt?: string | undefined;
}

export interface AppStoreScreenshotOptions {
  shots: AppStoreScreenshotShot[];
  /** Output directory. Default `store/appstore` relative to the cwd. */
  outDir?: string | undefined;
  /** Letterbox / flatten color. Default `#0f100f`. */
  brandColor?: string | undefined;
  /** Target preset ids. Default `["iphone-6-9"]`. */
  presets?: string[] | undefined;
  /** Output encoding. Default `png`. */
  format?: OutputFormat | undefined;
  /** Write the JSON inventory. Default true. */
  writeConfig?: boolean | undefined;
  /** Where to write the inventory. Default `<outDir>/appstore-screenshots.config.json`. */
  configOut?: string | undefined;
  /** App Store locale used by the deliver layout. Default `en-US`. */
  locale?: string | undefined;
  /** `flat` writes everything into `outDir`; `deliver` writes the fastlane tree. */
  layout?: ExportLayout | undefined;
}

export interface AppStoreScreenshotsConfig {
  version: 1;
  store: "app-store";
  layout: ExportLayout;
  locale: string;
  format: OutputFormat;
  iphone: string[];
  ipad: string[];
  assets: Array<{
    name: string;
    path: string;
    width: number;
    height: number;
    section: AppStoreSection;
    preset: string;
    format: OutputFormat;
    alt?: string;
  }>;
}

export interface AppStoreScreenshotsResult {
  outDir: string;
  assets: GeneratedAsset[];
  config: AppStoreScreenshotsConfig;
  configPath?: string;
  /** One-line instruction an agent can follow to upload the files. */
  agentPrompt: string;
  /** Non-fatal policy notes (empty sections, alt text). */
  warnings: string[];
}

export const APP_STORE_SCREENSHOT_DEFAULTS = {
  outDir: "store/appstore",
  brandColor: "#0f100f",
  presets: ["iphone-6-9"] as const,
  format: "png" as const,
  locale: "en-US",
  layout: "flat" as const,
} as const;

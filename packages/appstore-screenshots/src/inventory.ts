import { resolve } from "node:path";

import type {
  AppStoreSection,
  AppStoreScreenshotsConfig,
  ExportLayout,
  GeneratedAsset,
  OutputFormat,
} from "./types";
import { configPath, displayLabel, padIndex } from "./utils";

export interface InventoryOptions {
  outDir: string;
  layout?: ExportLayout | undefined;
  locale?: string | undefined;
  format?: OutputFormat | undefined;
}

export interface OutputTarget {
  /** Relative to the cwd, for the JSON inventory. */
  rel: string;
  /** Absolute destination for `writeAsset`. */
  abs: string;
}

/**
 * fastlane deliver expects `fastlane/screenshots/<locale>/<display label>-<NN>.png`
 * (check the exact labels against the deliver docs before release).
 */
export function deliverRel(
  preset: string,
  index: number,
  locale: string,
  format: OutputFormat,
): string {
  const ext = format === "jpeg" ? "jpg" : "png";
  return `./fastlane/screenshots/${locale}/${displayLabel(preset)}-${padIndex(index)}.${ext}`;
}

function shotIndex(name: string): number {
  // Flat names start with the index (`01-...`); deliver names end in it
  // (`iPhone 6.9-01.png`). Both forms reach buildInventory.
  const match = /^(\d+)-/.exec(name) ?? /-(\d+)\.(?:png|jpg)$/.exec(name);
  const value = Number.parseInt(match?.[1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value - 1 : 0;
}

/** Where each asset must be written, and the path that goes in the inventory. */
export function outputTargetsFor(
  asset: Pick<GeneratedAsset, "section" | "preset" | "name">,
  options: InventoryOptions,
): OutputTarget[] {
  const layout = options.layout ?? "flat";
  const locale = options.locale ?? "en-US";
  if (layout === "flat") {
    const rel = configPath(options.outDir, asset.name);
    return [{ rel, abs: resolve(options.outDir, asset.name) }];
  }
  const rel = deliverRel(asset.preset, shotIndex(asset.name), locale, options.format ?? "png");
  return [{ rel, abs: resolve(options.outDir, rel.replace(/^\.\//, "")) }];
}

function pushPath(config: AppStoreScreenshotsConfig, section: AppStoreSection, rel: string): void {
  config[section].push(rel);
}

/** Build the App Store inventory shared by the CLI and the Studio editor. */
export function buildInventory(
  assets: GeneratedAsset[],
  options: InventoryOptions,
): AppStoreScreenshotsConfig {
  const config: AppStoreScreenshotsConfig = {
    version: 1,
    store: "app-store",
    layout: options.layout ?? "flat",
    locale: options.locale ?? "en-US",
    format: options.format ?? "png",
    iphone: [],
    ipad: [],
    assets: [],
  };

  for (const asset of assets) {
    const targets = outputTargetsFor(asset, options);
    for (const target of targets) pushPath(config, asset.section, target.rel);
    config.assets.push({
      name: asset.name,
      path: targets[0]?.rel ?? configPath(options.outDir, asset.name),
      width: asset.width,
      height: asset.height,
      section: asset.section,
      preset: asset.preset,
      format: asset.format,
      ...(asset.alt === undefined ? {} : { alt: asset.alt }),
    });
  }
  return config;
}

export function agentPromptFor(configFile: string): string {
  return (
    `Upload the files listed in ${configFile} to App Store Connect → My Apps → ` +
    "App Information → Screenshots. Keep the 01, 02, … order per display size, " +
    "supply at most 10 per display size per localization, and use the same set for every " +
    "localization. App previews (video) and a feature graphic are out of scope."
  );
}

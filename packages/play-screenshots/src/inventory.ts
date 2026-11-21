import { resolve } from "node:path";

import { configPath } from "./utils";
import type {
  ExportLayout,
  GeneratedAsset,
  OutputFormat,
  PlayScreenshotsConfig,
  PlayStoreSection,
} from "./types";

const SECTION_TO_CONFIG: Record<PlayStoreSection, keyof PlayScreenshotsConfig["play"]> = {
  phone: "phone",
  "tablet-7": "tablet7",
  "tablet-10": "tablet10",
  foldable: "foldable",
  chromebook: "chromebook",
  wear: "wear",
  tv: "tv",
  automotive: "automotive",
  xr: "xr",
  "feature-graphic": "featureGraphic",
  "tv-banner": "tvBanner",
  "play-icon": "playIcon",
};

/** Single-file sections in fastlane's `images/` tree (all others are folders). */
const FASTLANE_FILES: Partial<Record<PlayStoreSection, string>> = {
  "feature-graphic": "featureGraphic",
  "tv-banner": "tvBanner",
  "play-icon": "icon",
};

/** Fastlane's conventional folder names; sections without one keep their own name. */
const FASTLANE_FOLDERS: Partial<Record<PlayStoreSection, string>> = {
  phone: "phoneScreenshots",
  "tablet-7": "sevenInchScreenshots",
  "tablet-10": "tenInchScreenshots",
  wear: "wearScreenshots",
  tv: "tvScreenshots",
  automotive: "automotiveScreenshots",
};

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

function fastlaneRel(
  section: PlayStoreSection,
  name: string,
  locale: string,
  format: OutputFormat,
): string {
  const prefix = `./metadata/android/${locale}/images/`;
  const ext = format === "jpeg" ? "jpg" : "png";
  const file = FASTLANE_FILES[section];
  if (file !== undefined) return `${prefix}${file}.${ext}`;
  const folder = FASTLANE_FOLDERS[section] ?? `${section}Screenshots`;
  return `${prefix}${folder}/${name}`;
}

/**
 * Where an asset must be written, and the path(s) that go in the inventory.
 * Tablet assets are duplicated into both the 7" and 10" fastlane folders.
 */
export function outputTargetsFor(
  asset: Pick<GeneratedAsset, "section" | "name">,
  options: InventoryOptions,
): OutputTarget[] {
  const layout = options.layout ?? "flat";
  const locale = options.locale ?? "en-US";
  if (layout === "flat") {
    const rel = configPath(options.outDir, asset.name);
    return [{ rel, abs: resolve(options.outDir, asset.name) }];
  }
  let sections: PlayStoreSection[];
  if (asset.section === "tablet-10") sections = ["tablet-10", "tablet-7"];
  else if (asset.section === "tablet-7") sections = ["tablet-7", "tablet-10"];
  else sections = [asset.section];
  return sections.map((section) => {
    const rel = fastlaneRel(section, asset.name, locale, options.format ?? "png");
    return { rel, abs: resolve(options.outDir, rel.replace(/^\.\//, "")) };
  });
}

function pushPath(config: PlayScreenshotsConfig, section: PlayStoreSection, rel: string): void {
  const key = SECTION_TO_CONFIG[section];
  if (key === "featureGraphic" || key === "tvBanner" || key === "playIcon") {
    config.play[key] = rel;
    return;
  }
  config.play[key].push(rel);
  if (section === "tablet-10" && !config.play.tablet7.includes(rel)) config.play.tablet7.push(rel);
  if (section === "tablet-7" && !config.play.tablet10.includes(rel)) config.play.tablet10.push(rel);
}

/** Extracted from `generate.ts` so the editor and any other host can build an inventory. */
export function buildInventory(
  assets: GeneratedAsset[],
  options: InventoryOptions,
): PlayScreenshotsConfig {
  const config: PlayScreenshotsConfig = {
    version: 1,
    store: "play",
    layout: options.layout ?? "flat",
    locale: options.locale ?? "en-US",
    format: options.format ?? "png",
    play: {
      phone: [],
      tablet7: [],
      tablet10: [],
      foldable: [],
      chromebook: [],
      wear: [],
      tv: [],
      automotive: [],
      xr: [],
    },
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
    `Upload the files listed in ${configFile} to Play Console → Grow users → ` +
    "Store presence → Main store listing → Graphics. Keep phone order 01, 02, … " +
    "Feature graphic is required to publish. Do not add ranking, price, or CTA copy."
  );
}

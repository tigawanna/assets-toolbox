import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { fitToPreset } from "./fit";
import { agentPromptFor, buildInventory, outputTargetsFor } from "./inventory";
import { assertScreenshotCounts, checkScreenshotCounts, isCountError } from "./policy";
import { assertAppStoreBounds, getPreset } from "./sizes";
import {
  APP_STORE_SCREENSHOT_DEFAULTS,
  type AppStorePreset,
  type AppStoreScreenshotsConfig,
  type AppStoreScreenshotsResult,
  type AppStoreScreenshotOptions,
  type GeneratedAsset,
  type OutputFormat,
} from "./types";
import { hexToColor, padIndex, writeAsset } from "./utils";
import { validateOutputFile } from "./validate";

function fileName(index: number, preset: AppStorePreset, format: OutputFormat): string {
  return `${padIndex(index)}-${preset.id}.${format === "jpeg" ? "jpg" : "png"}`;
}

/**
 * Fit raw simulator captures to App Store Connect sizes and write an inventory.
 * Fit mode only: no device frames, no status-bar drawing, no video previews,
 * no feature graphic. The Studio editor produces designed output separately.
 */
export async function generateAppStoreScreenshots(
  options: AppStoreScreenshotOptions,
): Promise<AppStoreScreenshotsResult> {
  if (options.shots.length === 0) throw new Error("At least one shot is required");

  const outDir = resolve(options.outDir ?? APP_STORE_SCREENSHOT_DEFAULTS.outDir);
  const brand = hexToColor(options.brandColor ?? APP_STORE_SCREENSHOT_DEFAULTS.brandColor);
  const format = options.format ?? APP_STORE_SCREENSHOT_DEFAULTS.format;
  const locale = options.locale ?? APP_STORE_SCREENSHOT_DEFAULTS.locale;
  const layout = options.layout ?? APP_STORE_SCREENSHOT_DEFAULTS.layout;
  const presetIds = options.presets ?? [...APP_STORE_SCREENSHOT_DEFAULTS.presets];
  const presets = presetIds.map((id) => {
    const preset = getPreset(id);
    assertAppStoreBounds(preset);
    return preset;
  });

  const assets: GeneratedAsset[] = [];

  async function emit(
    preset: AppStorePreset,
    bytes: Buffer,
    index: number,
    alt?: string,
  ): Promise<void> {
    const name = fileName(index, preset, format);
    const targets = outputTargetsFor(
      { section: preset.section, preset: preset.id, name },
      { outDir, layout, locale, format },
    );
    const first = targets[0];
    if (first === undefined) throw new Error(`No output target for ${preset.id}`);

    let asset: GeneratedAsset | undefined;
    for (const target of targets) {
      const written = writeAsset(
        target.abs,
        bytes,
        preset.width,
        preset.height,
        preset.section,
        preset.id,
        format,
      );
      await validateOutputFile({
        path: target.abs,
        expectedWidth: preset.width,
        expectedHeight: preset.height,
        format,
      });
      if (asset === undefined) {
        asset = {
          ...written,
          format,
          inventoryPath: target.rel,
          ...(alt === undefined ? {} : { alt }),
        };
      }
    }
    if (asset === undefined) throw new Error(`Failed to write ${preset.id}`);
    assets.push(asset);
  }

  for (const [index, shot] of options.shots.entries()) {
    const source = resolve(shot.file);
    for (const preset of presets) {
      const bytes = await fitToPreset(
        source,
        preset.width,
        preset.height,
        brand,
        preset.flatten,
        format,
      );
      await emit(preset, bytes, index, shot.alt);
    }
  }

  const config: AppStoreScreenshotsConfig = buildInventory(assets, {
    outDir,
    layout,
    locale,
    format,
  });
  const countIssues = checkScreenshotCounts(config);
  assertScreenshotCounts(config);

  const configFile = options.configOut ?? resolve(outDir, "appstore-screenshots.config.json");
  const result: AppStoreScreenshotsResult = {
    outDir,
    assets,
    config,
    agentPrompt: agentPromptFor(configFile),
    warnings: countIssues.filter((message) => !isCountError(message)),
  };

  if (options.writeConfig !== false) {
    mkdirSync(dirname(configFile), { recursive: true });
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    result.configPath = configFile;
  }

  return result;
}

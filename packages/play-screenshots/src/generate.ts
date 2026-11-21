import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp, { type Color } from "sharp";

import { fitToPreset } from "./fit";
import { buildInventory, agentPromptFor, outputTargetsFor } from "./inventory";
import {
  assertFrameAllowed,
  assertNoBannedWords,
  checkCaptureAspectMismatch,
  checkScreenshotCounts,
  checkTaglineCoverage,
  isLowContrastFill,
} from "./policy";
import { renderFrame, shotToDataUrl } from "./render";
import { assertPlayBounds, getPreset, PLAY_STORE_PRESETS } from "./sizes";
import {
  PLAY_SCREENSHOT_DEFAULTS,
  type GeneratedAsset,
  type PlayScreenshotsConfig,
  type PlayScreenshotsResult,
  type PlayScreenshotOptions,
  type PlayStorePreset,
  type OutputFormat,
} from "./types";
import { hexToColor, padIndex, writeAsset } from "./utils";
import { validateOutputFile } from "./validate";

function orientationFor(preset: PlayStorePreset): "square" | "landscape" | "portrait" {
  if (Math.abs(preset.width - preset.height) / Math.max(preset.width, preset.height) < 0.1)
    return "square";
  if (preset.width > preset.height) return "landscape";
  return "portrait";
}

function fileName(index: number, preset: PlayStorePreset, format: OutputFormat): string {
  const base =
    preset.id === "feature-graphic" ? "feature-graphic" : `${padIndex(index)}-${preset.id}`;
  return `${base}.${format === "jpeg" ? "jpg" : "png"}`;
}

/** Rough tagline-area estimate for the built-in frame (≤ 3 title lines, 20% cap). */
function estimateTaglineRatio(title: string, subtitle: string | undefined, height: number): number {
  const lines = Math.max(1, Math.ceil(title.length / 18));
  const titlePx = Math.min(lines, 3) * 78 * 1.03;
  const subtitlePx = subtitle ? 18 + 34 * 1.3 : 0;
  const topPad = 72;
  return (topPad + titlePx + subtitlePx) / height;
}

async function encodeFrame(
  bytes: Buffer,
  format: OutputFormat,
  background: Color,
  flatten: boolean,
): Promise<Buffer> {
  if (format === "png") return bytes;
  let pipeline = sharp(bytes);
  if (flatten) pipeline = pipeline.flatten({ background });
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

/**
 * Render Play-ready screenshots. `fit` letterboxes raw captures; `frame`
 * composes the built-in marketing layout (or a user React component).
 */
export async function generatePlayScreenshots(
  options: PlayScreenshotOptions,
): Promise<PlayScreenshotsResult> {
  if (options.shots.length === 0) throw new Error("At least one shot is required");

  const outDir = resolve(options.outDir ?? PLAY_SCREENSHOT_DEFAULTS.outDir);
  const brandHex = options.brandColor ?? PLAY_SCREENSHOT_DEFAULTS.brandColor;
  const brand = hexToColor(brandHex);
  const format = options.format ?? PLAY_SCREENSHOT_DEFAULTS.format;
  const mode = options.mode ?? PLAY_SCREENSHOT_DEFAULTS.mode;
  const locale = options.locale ?? PLAY_SCREENSHOT_DEFAULTS.locale;
  const layout = options.layout ?? PLAY_SCREENSHOT_DEFAULTS.layout;
  const fontFamily = options.fontFamily ?? PLAY_SCREENSHOT_DEFAULTS.fontFamily;
  const presetIds = options.presets ?? [...PLAY_SCREENSHOT_DEFAULTS.presets];
  const presets = presetIds.map((id) => {
    const preset = getPreset(id);
    assertPlayBounds(preset);
    return preset;
  });

  if (mode === "frame") {
    const text = [
      options.title,
      options.subtitle,
      ...options.shots.flatMap((s) => [s.title, s.subtitle]),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    if (text) assertNoBannedWords(text, "Frame copy");
  }

  const warnings: string[] = [];
  if (isLowContrastFill(brandHex)) {
    warnings.push(
      `Brand color ${brandHex} is near-white or near-black and may vanish on Play chrome.`,
    );
  }

  const assets: GeneratedAsset[] = [];
  const inventoryAssets: GeneratedAsset[] = [];

  async function emit(
    preset: PlayStorePreset,
    bytes: Buffer,
    index: number,
    alt?: string,
  ): Promise<void> {
    const name = fileName(index, preset, format);
    const allowAlpha = preset.id === "play-icon";
    const targets = outputTargetsFor(
      { section: preset.section, name },
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
        allowAlpha,
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
    inventoryAssets.push(asset);
  }

  for (const [index, shot] of options.shots.entries()) {
    const source = resolve(shot.file);
    const sourceMeta = await sharp(source).metadata();
    for (const preset of presets) {
      if (preset.id === "feature-graphic") continue;
      const mismatch = checkCaptureAspectMismatch(
        sourceMeta.width ?? 0,
        sourceMeta.height ?? 0,
        preset.width,
        preset.height,
      );
      if (mismatch !== null) warnings.push(`${preset.id}: ${mismatch}`);
      let bytes: Buffer;
      const frameMode = mode === "frame" && preset.id !== "play-icon";
      if (mode === "frame" && !frameMode) {
        warnings.push(
          `${preset.id}: frame mode does not apply to icons — keeping the alpha channel.`,
        );
      }
      if (frameMode) {
        assertFrameAllowed(preset.section);
        const title = shot.title ?? options.title ?? "";
        const subtitle = shot.subtitle ?? options.subtitle;
        if (!title) throw new Error("Frame mode requires a --title (or a per-shot title).");
        checkTaglineCoverage(estimateTaglineRatio(title, subtitle, preset.height));
        const screenshotDataUrl = await shotToDataUrl(source);
        bytes = await renderFrame({
          width: preset.width,
          height: preset.height,
          props: {
            title,
            ...(subtitle === undefined ? {} : { subtitle }),
            screenshotDataUrl,
            appName: options.props?.appName,
            brandColor: brandHex,
            fontFamily,
            orientation: orientationFor(preset),
            ...options.props,
          },
          component: options.component,
          exportName: options.exportName,
          fontFamily,
        });
        bytes = await encodeFrame(bytes, format, brand, preset.flatten);
      } else {
        bytes = await fitToPreset(
          source,
          preset.width,
          preset.height,
          brand,
          preset.flatten,
          format,
        );
      }
      await emit(preset, bytes, index, shot.alt);
    }
  }

  if (options.featureGraphic) {
    const preset = PLAY_STORE_PRESETS["feature-graphic"];
    const source = resolve(options.featureSource ?? options.shots[0]?.file ?? "");
    let bytes: Buffer;
    if (mode === "frame") {
      const slogan = options.subtitle ?? (options.props?.slogan as string | undefined);
      const title = (options.props?.appName as string | undefined) ?? options.title ?? "";
      if (!title) throw new Error("Feature graphic requires an app name (--title or --app-name).");
      assertNoBannedWords(`${title} ${slogan ?? ""}`, "Feature-graphic copy");
      const iconProp = options.props?.iconDataUrl;
      const iconDataUrl = typeof iconProp === "string" ? iconProp : await shotToDataUrl(source);
      bytes = await renderFrame({
        width: preset.width,
        height: preset.height,
        feature: true,
        props: {
          appName: title,
          ...(slogan === undefined ? {} : { slogan }),
          iconDataUrl,
          brandColor: brandHex,
          fontFamily,
          ...options.props,
        },
        fontFamily,
      });
      bytes = await encodeFrame(bytes, format, brand, preset.flatten);
    } else {
      bytes = await fitToPreset(source, preset.width, preset.height, brand, preset.flatten, format);
    }
    await emit(preset, bytes, 0);
  }

  const config: PlayScreenshotsConfig = buildInventory(inventoryAssets, {
    outDir,
    layout,
    locale,
    format,
  });
  warnings.push(...checkScreenshotCounts(config));

  const configFile = options.configOut ?? resolve(outDir, "play-screenshots.config.json");
  const result: PlayScreenshotsResult = {
    outDir,
    assets,
    config,
    agentPrompt: agentPromptFor(configFile),
    warnings,
  };

  if (options.writeConfig !== false) {
    mkdirSync(dirname(configFile), { recursive: true });
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    result.configPath = configFile;
  }

  return result;
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp, { type Color } from "sharp";

import {
  EXPO_ASSET_DEFAULTS,
  type ExpoAssetsResult,
  type ExpoAssetOptions,
  type ExpoConfigSnippet,
} from "./types";
import { configPath, hexToColor, writeAsset } from "./utils";

const SIZE = 1024;
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE: Color = { r: 255, g: 255, b: 255, alpha: 1 };

function rasterize(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source, { density: 300 })
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
}

async function canvas(
  size: number,
  logo: Buffer,
  logoSize: number,
  background: Color,
): Promise<Buffer> {
  const raster = await rasterize(logo, logoSize);
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: raster, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** White silhouette derived from the source alpha — Android 13+ themed icons. */
async function silhouette(size: number, logo: Buffer, logoSize: number): Promise<Buffer> {
  const raster = await rasterize(logo, logoSize);
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: raster, gravity: "centre", blend: "dest-in" }])
    .png()
    .toBuffer();
}

function buildConfig(
  outDir: string,
  splashBackground: string,
  imageWidth: number,
): ExpoConfigSnippet {
  return {
    expo: {
      icon: configPath(outDir, "icon.png"),
      android: {
        adaptiveIcon: {
          foregroundImage: configPath(outDir, "adaptive-icon.png"),
          backgroundImage: configPath(outDir, "android-icon-background.png"),
          monochromeImage: configPath(outDir, "android-icon-monochrome.png"),
        },
      },
      web: { favicon: configPath(outDir, "favicon.png") },
      plugins: [
        [
          "expo-splash-screen",
          {
            image: configPath(outDir, "splash-icon.png"),
            backgroundColor: splashBackground,
            imageWidth,
          },
        ],
      ],
    },
  };
}

/**
 * Generate the Expo asset set from a single source logo. Paths in the returned
 * config are relative to the current working directory, ready to paste into
 * app.json.
 */
export async function generateExpoAssets(options: ExpoAssetOptions): Promise<ExpoAssetsResult> {
  const outDir = resolve(options.outDir ?? EXPO_ASSET_DEFAULTS.outDir);
  const brand = hexToColor(options.brandColor ?? EXPO_ASSET_DEFAULTS.brandColor);
  const splashBackground = options.splashBackground ?? EXPO_ASSET_DEFAULTS.splashBackground;
  const imageWidth = options.imageWidth ?? EXPO_ASSET_DEFAULTS.imageWidth;
  const foregroundSize = options.foregroundSize ?? EXPO_ASSET_DEFAULTS.foregroundSize;
  const splashLogoSize = options.splashLogoSize ?? EXPO_ASSET_DEFAULTS.splashLogoSize;

  const logo = readFileSync(resolve(options.icon));
  const darkLogo = options.darkIcon ? readFileSync(resolve(options.darkIcon)) : undefined;
  const tintedLogo = options.tintedIcon ? readFileSync(resolve(options.tintedIcon)) : undefined;

  const assets: ExpoAssetsResult["assets"] = [];
  const emit = async (name: string, data: Buffer, size: number) => {
    assets.push(writeAsset(resolve(outDir, name), data, size, size));
  };

  // App icon: opaque brand background, logo centered. iOS masks the corners.
  await emit("icon.png", await canvas(SIZE, logo, Math.round(SIZE * 0.68), brand), SIZE);

  // Android adaptive layers. Foreground stays inside the safe zone so launcher
  // masks do not clip the logo.
  await emit("adaptive-icon.png", await canvas(SIZE, logo, foregroundSize, TRANSPARENT), SIZE);
  await emit(
    "android-icon-background.png",
    await sharp({
      create: { width: SIZE, height: SIZE, channels: 4, background: brand },
    })
      .png()
      .toBuffer(),
    SIZE,
  );
  if (!options.noMonochrome) {
    await emit("android-icon-monochrome.png", await silhouette(SIZE, logo, foregroundSize), SIZE);
  }

  // Splash icon: transparent PNG, logo centered. imageWidth in the config
  // controls how large it renders on screen.
  await emit("splash-icon.png", await canvas(SIZE, logo, splashLogoSize, TRANSPARENT), SIZE);
  if (darkLogo) {
    await emit(
      "splash-icon-dark.png",
      await canvas(SIZE, darkLogo, splashLogoSize, TRANSPARENT),
      SIZE,
    );
  }

  // Web favicon and the small white Android notification icon.
  await emit("favicon.png", await canvas(48, logo, 40, brand), 48);
  await emit("notification-icon.png", await silhouette(96, logo, 72), 96);

  if (tintedLogo) {
    await emit(
      "ios-tinted.png",
      await canvas(SIZE, tintedLogo, Math.round(SIZE * 0.68), brand),
      SIZE,
    );
  }

  const config = buildConfig(outDir, splashBackground, imageWidth);
  const configFile = options.configOut ?? resolve(outDir, "expo-assets.config.json");

  const result: ExpoAssetsResult = {
    outDir,
    assets,
    config,
    agentPrompt:
      `Merge the fragment in ${configFile} into app.json: ` +
      "set expo.icon, expo.android.adaptiveIcon.*, expo.web.favicon, " +
      "and add the expo-splash-screen plugin with the generated splash icon, " +
      "backgroundColor and imageWidth. Do not overwrite unrelated app.json keys.",
  };

  if (options.writeConfig !== false) {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(configFile), { recursive: true });
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    result.configPath = configFile;
  }

  return result;
}

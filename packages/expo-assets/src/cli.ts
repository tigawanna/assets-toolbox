#!/usr/bin/env node
import { asString } from "./utils";

export interface CliArgs {
  icon?: string | undefined;
  out?: string | undefined;
  brandColor?: string | undefined;
  splashBackground?: string | undefined;
  imageWidth?: number | undefined;
  foregroundSize?: number | undefined;
  splashLogoSize?: number | undefined;
  darkIcon?: string | undefined;
  tintedIcon?: string | undefined;
  noMonochrome: boolean;
  noConfig: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { noMonochrome: false, noConfig: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    const [flag, inline] = token.split("=", 2);
    if (flag === "--no-monochrome") {
      args.noMonochrome = true;
      continue;
    }
    if (flag === "--no-config") {
      args.noConfig = true;
      continue;
    }
    const value = inline ?? (token.startsWith("-") ? argv[++index] : token);
    if (flag === "--icon" || flag === "-i") args.icon = asString(value);
    else if (flag === "--out" || flag === "-o") args.out = asString(value);
    else if (flag === "--brand-color") args.brandColor = asString(value);
    else if (flag === "--splash-bg") args.splashBackground = asString(value);
    else if (flag === "--image-width") args.imageWidth = Number(value);
    else if (flag === "--foreground-size") args.foregroundSize = Number(value);
    else if (flag === "--splash-logo-size") args.splashLogoSize = Number(value);
    else if (flag === "--dark-icon") args.darkIcon = asString(value);
    else if (flag === "--tinted-icon") args.tintedIcon = asString(value);
  }

  return args;
}

function help(): string {
  return `expo-assets — generate Expo icons and splash screens from one logo

Usage:
  expo-assets --icon <path> [options]

Options:
  -i, --icon <path>          Source SVG or transparent PNG. Required.
  -o, --out <dir>            Output directory. Default assets/images.
      --brand-color <hex>    App icon / adaptive background. Default #0f100f.
      --splash-bg <hex>      expo-splash-screen backgroundColor. Default #ffffff.
      --image-width <px>     expo-splash-screen imageWidth. Default 200.
      --foreground-size <px> Logo size in adaptive foreground. Default 660.
      --splash-logo-size <px> Logo size in splash icon. Default 620.
      --dark-icon <path>     Transparent logo for the dark splash icon.
      --tinted-icon <path>   Grayscale logo for the iOS tinted icon.
      --no-monochrome        Skip the Android themed icon.
      --no-config            Skip writing the app.json snippet.
  -h, --help                 Show this help.

Generates: icon.png, adaptive-icon.png, android-icon-background.png,
android-icon-monochrome.png, splash-icon.png, favicon.png,
notification-icon.png and an expo-assets.config.json app.json fragment.

Example:
  npx @tigawanna/expo-assets --icon ./logo.svg --out ./assets/images \\
    --brand-color '#0f100f' --splash-bg '#ffffff' --image-width 200
`;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(help());
    return;
  }
  if (!args.icon) {
    console.error("error: --icon <path> is required");
    process.exitCode = 1;
    return;
  }

  const { generateExpoAssets } = await import("./assets");
  const result = await generateExpoAssets({
    icon: args.icon,
    outDir: args.out,
    brandColor: args.brandColor,
    splashBackground: args.splashBackground,
    imageWidth: args.imageWidth,
    foregroundSize: args.foregroundSize,
    splashLogoSize: args.splashLogoSize,
    darkIcon: args.darkIcon,
    tintedIcon: args.tintedIcon,
    noMonochrome: args.noMonochrome,
    writeConfig: !args.noConfig,
  });

  for (const asset of result.assets) {
    console.log(`wrote ${asset.path} (${asset.width}×${asset.height}, ${asset.bytes} bytes)`);
  }
  if (result.configPath) console.log(`wrote ${result.configPath}`);
  console.log(`\nAgent prompt: ${result.agentPrompt}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

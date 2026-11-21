#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_STORE_PRESET_IDS, APP_STORE_PRESETS } from "./sizes";
import type { ExportLayout, OutputFormat } from "./types";
import { asString } from "./utils";

const BOOLEAN_FLAGS = new Set(["help", "no-config", "list-presets"]);
const SHORT_FLAGS: Record<string, string> = {
  s: "shot",
  o: "out",
  h: "help",
};

function camel(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export interface CliArgs {
  shots: string[];
  presets: string[];
  out?: string | undefined;
  brandColor?: string | undefined;
  noConfig: boolean;
  listPresets: boolean;
  help: boolean;
  format?: OutputFormat | undefined;
  locale?: string | undefined;
  layout?: ExportLayout | undefined;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    shots: [],
    presets: [],
    noConfig: false,
    listPresets: false,
    help: false,
  };
  const flags = new Map<string, Array<string | boolean>>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") break;
    let key: string;
    let value: string | boolean = true;
    if (token.startsWith("--")) {
      key = token.slice(2);
      const equals = key.indexOf("=");
      if (equals >= 0) {
        value = key.slice(equals + 1);
        key = key.slice(0, equals);
      } else if (!BOOLEAN_FLAGS.has(key)) {
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("-")) {
          value = next;
          index += 1;
        }
      }
    } else if (token.startsWith("-") && token.length > 1) {
      key = SHORT_FLAGS[token[1] ?? ""] ?? token[1] ?? "";
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("-")) {
        value = next;
        index += 1;
      }
    } else {
      continue;
    }
    const name = camel(key);
    const list = flags.get(name) ?? [];
    list.push(value);
    flags.set(name, list);
  }

  for (const [key, values] of flags) {
    const text = asString(values[0]);
    const truthy = values.some((value) => value === true || value === "true");
    switch (key) {
      case "shot":
      case "shots":
        for (const value of values) {
          const shot = asString(value);
          if (shot) args.shots.push(shot);
        }
        break;
      case "preset":
      case "presets":
        for (const value of values) {
          const preset = asString(value);
          if (preset) args.presets.push(preset);
        }
        break;
      case "out":
        args.out = text;
        break;
      case "brandColor":
        args.brandColor = text;
        break;
      case "format":
        args.format = text as OutputFormat | undefined;
        break;
      case "locale":
        args.locale = text;
        break;
      case "layout":
        args.layout = text as ExportLayout | undefined;
        break;
      case "noConfig":
        args.noConfig = truthy;
        break;
      case "listPresets":
        args.listPresets = truthy;
        break;
      case "help":
        args.help = truthy;
        break;
      default:
        break;
    }
  }
  return args;
}

export function help(): string {
  return `appstore-screenshots — make App Store Connect-ready screenshots

Usage:
  appstore-screenshots --shot <path> [--shot <path> ...] [options]

Fit mode only: raw simulator capture → exact preset size, flattened onto
--brand-color. No device frames, status bars, video previews or feature graphic.

Options:
  -s, --shot <path>          Raw simulator capture. Repeatable. Required.
  -o, --out <dir>            Output directory. Default store/appstore.
      --preset <id>          Target size. Repeatable. Default iphone-6-9.
      --brand-color <hex>    Letterbox / crop color. Default #0f100f.
      --format png|jpeg      Encoding. Default png.
      --locale <locale>      Deliver locale. Default en-US.
      --layout flat|deliver  Output layout. Default flat.
      --no-config            Skip writing appstore-screenshots.config.json.
      --list-presets         Print the App Store size catalog and exit.
  -h, --help                 Show this help.

Example:
  npx @tigawanna/appstore-screenshots --shot ./shots/home.png \\
    --preset iphone-6-9 --preset ipad-13 --out ./store/appstore
`;
}

export function listPresets(): string {
  const rows = APP_STORE_PRESET_IDS.map((id) => {
    const preset = APP_STORE_PRESETS[id];
    return `  ${id.padEnd(22)} ${String(preset.width).padStart(4)}×${String(preset.height).padEnd(4)}  ${preset.section}`;
  });
  return `App Store presets (verify against Apple's specifications)\n\n${rows.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(help());
    return;
  }
  if (args.listPresets) {
    console.log(listPresets());
    return;
  }
  if (args.shots.length === 0) {
    console.error("error: --shot <path> is required (repeatable)");
    process.exitCode = 1;
    return;
  }
  if (args.format !== undefined && args.format !== "png" && args.format !== "jpeg") {
    console.error("error: --format must be png or jpeg");
    process.exitCode = 1;
    return;
  }
  if (args.layout !== undefined && args.layout !== "flat" && args.layout !== "deliver") {
    console.error("error: --layout must be flat or deliver");
    process.exitCode = 1;
    return;
  }

  const { generateAppStoreScreenshots } = await import("./generate");
  const result = await generateAppStoreScreenshots({
    shots: args.shots.map((file) => ({ file })),
    outDir: args.out,
    brandColor: args.brandColor,
    presets: args.presets,
    format: args.format,
    locale: args.locale,
    layout: args.layout,
    writeConfig: !args.noConfig,
  });

  for (const asset of result.assets) {
    console.log(`wrote ${asset.path} (${asset.width}×${asset.height}, ${asset.bytes} bytes)`);
  }
  if (result.configPath) console.log(`wrote ${result.configPath}`);
  for (const warning of result.warnings) console.warn(warning);
  console.log(`\nAgent prompt: ${result.agentPrompt}`);
}

function launchedFromCli(): boolean {
  const argvPath = process.argv[1];
  if (argvPath === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(argvPath);
  } catch {
    return false;
  }
}

if (launchedFromCli()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

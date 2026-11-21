#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfigFile } from "./config";
import { PLAY_STORE_PRESET_IDS, PLAY_STORE_PRESETS } from "./sizes";
import type { ExportLayout, OutputFormat, RenderMode } from "./types";
import { asString } from "./utils";

const BOOLEAN_FLAGS = new Set(["help", "no-config", "list-presets", "feature-graphic", "frame"]);
const SHORT_FLAGS: Record<string, string> = {
  s: "shot",
  o: "out",
  t: "title",
  c: "component",
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
  featureGraphic: boolean;
  featureSource?: string | undefined;
  noConfig: boolean;
  listPresets: boolean;
  help: boolean;
  format?: OutputFormat | undefined;
  mode?: RenderMode | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  component?: string | undefined;
  exportName?: string | undefined;
  locale?: string | undefined;
  layout?: ExportLayout | undefined;
  fontFamily?: string | undefined;
  config?: string | undefined;
  appName?: string | undefined;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    shots: [],
    presets: [],
    featureGraphic: false,
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
      case "featureSource":
        args.featureSource = text;
        break;
      case "format":
        args.format = text as OutputFormat | undefined;
        break;
      case "mode":
        args.mode = text as RenderMode | undefined;
        break;
      case "title":
        args.title = text;
        break;
      case "subtitle":
        args.subtitle = text;
        break;
      case "component":
        args.component = text;
        break;
      case "exportName":
        args.exportName = text;
        break;
      case "locale":
        args.locale = text;
        break;
      case "layout":
        args.layout = text as ExportLayout | undefined;
        break;
      case "fontFamily":
        args.fontFamily = text;
        break;
      case "config":
        args.config = text;
        break;
      case "appName":
        args.appName = text;
        break;
      case "featureGraphic":
        args.featureGraphic = truthy;
        break;
      case "noConfig":
        args.noConfig = truthy;
        break;
      case "listPresets":
        args.listPresets = truthy;
        break;
      case "frame":
        args.mode = "frame";
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

function help(): string {
  return `play-screenshots — make Google Play Console-ready screenshots

Usage:
  play-screenshots --shot <path> [--shot <path> ...] [options]
  play-screenshots --config ./store/play-screenshots.config.ts

Modes:
  fit (default)  Letterbox a raw capture into the exact preset size and flatten alpha.
  frame          Compose a marketing layout: headline, subtitle, capture, brand fill.

Options:
  -s, --shot <path>          Raw screenshot. Repeatable. Required unless --config.
  -o, --out <dir>            Output directory. Default store/google.
      --preset <id>          Target size. Repeatable. Default phone-portrait.
      --brand-color <hex>    Letterbox / crop color. Default #0f100f.
      --format png|jpeg      Encoding. Default png.
      --mode fit|frame       Render mode. Default fit. (--frame is shorthand.)
  -t, --title <text>         Frame headline (applies to every shot).
      --subtitle <text>      Frame subtitle.
      --app-name <text>      App name shown above the headline / on the feature graphic.
      --component <path>     .ts/.tsx React component used as the frame.
      --export-name <name>   Named export to use from --component.
      --feature-graphic      Also write feature-graphic.png (1024×500).
      --feature-source <p>   Source for the feature graphic (default: first shot).
      --locale <locale>      Fastlane locale. Default en-US.
      --layout flat|fastlane Output layout. Default flat.
      --font-family <name>   Frame font. Default Inter.
      --config <path>        Load all options from a .ts/.ts config file.
      --no-config            Skip writing play-screenshots.config.json.
      --list-presets         Print the Play size catalog and exit.
  -h, --help                 Show this help.

Example:
  npx @tigawanna/play-screenshots --shot ./shots/home.png \\
    --mode frame --title "Inbox zero" --subtitle "Works offline" \\
    --preset phone-portrait --feature-graphic --out ./store/google
`;
}

function listPresets(): string {
  const rows = PLAY_STORE_PRESET_IDS.map((id) => {
    const preset = PLAY_STORE_PRESETS[id];
    return `  ${id.padEnd(20)} ${String(preset.width).padStart(4)}×${String(preset.height).padEnd(4)}  ${preset.section}`;
  });
  return `Play Store presets\n\n${rows.join("\n")}\n`;
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

  const { generatePlayScreenshots } = await import("./generate");
  let base: Record<string, unknown> = {};
  if (args.config) base = (await loadConfigFile(args.config)) as unknown as Record<string, unknown>;

  function pick<T>(flag: T | undefined, fromConfig: unknown): T | undefined {
    return flag !== undefined ? flag : (fromConfig as T | undefined);
  }

  const shots = args.shots.length
    ? args.shots.map((file) => ({ file }))
    : ((base.shots as Array<{ file: string; alt?: string }>) ?? []);
  if (shots.length === 0) {
    console.error("error: --shot <path> is required (repeatable), or use --config");
    process.exitCode = 1;
    return;
  }

  const result = await generatePlayScreenshots({
    shots,
    outDir: pick(args.out, base.outDir),
    brandColor: pick(args.brandColor, base.brandColor),
    presets: args.presets.length ? args.presets : (base.presets as string[] | undefined),
    format: pick(args.format, base.format),
    mode: pick(args.mode, base.mode),
    featureGraphic: args.featureGraphic || base.featureGraphic === true,
    featureSource: pick(args.featureSource, base.featureSource),
    writeConfig: !args.noConfig && base.writeConfig !== false,
    title: pick(args.title, base.title),
    subtitle: pick(args.subtitle, base.subtitle),
    component: pick(args.component, base.component),
    exportName: pick(args.exportName, base.exportName),
    locale: pick(args.locale, base.locale),
    layout: pick(args.layout, base.layout),
    fontFamily: pick(args.fontFamily, base.fontFamily),
    props: {
      ...(base.props as Record<string, unknown> | undefined),
      ...(args.appName === undefined ? {} : { appName: args.appName }),
      ...(base.appName === undefined ? {} : { appName: base.appName }),
    },
  });

  for (const asset of result.assets) {
    console.log(`wrote ${asset.path} (${asset.width}×${asset.height}, ${asset.bytes} bytes)`);
  }
  if (result.configPath) console.log(`wrote ${result.configPath}`);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
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

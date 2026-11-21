#!/usr/bin/env node
import { join } from "node:path";

import { generateIconSet } from "./icons";
import { generateManifest } from "./manifest";
import { renderOgImage } from "./og";
import type { IconSetOptions, ManifestOptions, OgImageOptions } from "./types";
import { asString, compact } from "./utils";

type Flags = Record<string, string | boolean>;

const SHORT_FLAGS: Record<string, string> = {
  i: "icon",
  o: "out",
  c: "component",
  t: "title",
  d: "description",
  h: "help",
};

function camel(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function parseArgs(argv: string[]): { command: string; flags: Flags } {
  const flags: Flags = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";

    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (arg.startsWith("--")) {
      let key = arg.slice(2);
      let value: string | boolean = true;
      const equals = key.indexOf("=");
      if (equals >= 0) {
        value = key.slice(equals + 1);
        key = key.slice(0, equals);
      } else {
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("-")) {
          value = next;
          index += 1;
        }
      }
      flags[camel(key)] = value;
    } else if (arg.startsWith("-") && arg.length > 1) {
      const key = SHORT_FLAGS[arg[1] ?? ""] ?? arg[1] ?? "";
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0] ?? "all";
  return { command, flags };
}

function asNumber(value: string | boolean | undefined): number | undefined {
  const raw = asString(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function printHelp(): void {
  console.log(`brand-assets — generate a favicon set and OG image from one SVG

Usage:
  brand-assets [all|icons|og] --icon <path> [options]

Options:
  -i, --icon <path>          Source SVG (or PNG). Required.
  -o, --out <dir>            Output directory. Default: current directory.
  -c, --component <path>     .ts/.tsx file exporting an OG React component.
      --export-name <name>   Named export to use from --component.
  -t, --title <text>         OG title. Required unless --no-og.
  -d, --description <text>   OG description.
      --site-label <text>    Label shown in the OG header/footer.
      --plate <hex>          Background for plated icons. Default: #0f100f.
      --width <n>            OG width. Default: 1200.
      --height <n>           OG height. Default: 630.
      --copy-svg             Also write favicon.svg.
      --manifest             Also write site.webmanifest.
      --site-name <text>     Manifest name. Default: App.
      --no-og                Skip OG image generation.
      --no-icons             Skip favicon generation.
  -h, --help                 Show this help.

Examples:
  brand-assets --icon public/logo.svg --out public \\
    --title "My site" --component ./src/og/OgImage.tsx
  brand-assets icons --icon public/logo.svg --out public
`);
}

export async function runCli(argv: string[]): Promise<void> {
  const { command, flags } = parseArgs(argv);

  if (flags.help === true || command === "help") {
    printHelp();
    return;
  }
  if (command !== "all" && command !== "icons" && command !== "og") {
    console.error(`Unknown command: ${command}. Expected all, icons, or og.`);
    process.exitCode = 1;
    return;
  }

  const icon = asString(flags.icon);
  if (!icon) {
    console.error("error: --icon <path> is required");
    process.exitCode = 1;
    return;
  }

  const out = asString(flags.out);
  const withIcons = command !== "og" && flags.noIcons !== true;
  const withOg = command !== "icons" && flags.noOg !== true;

  if (withIcons) {
    const files = await generateIconSet(
      compact({
        icon,
        outDir: out,
        plate: asString(flags.plate),
        copySvg: flags.copySvg === true,
      }) as IconSetOptions,
    );
    for (const file of files) console.log(`wrote ${file.path} (${file.bytes} bytes)`);
  }

  if (withOg) {
    const title = asString(flags.title);
    if (!title) {
      console.error("error: --title <text> is required for OG generation (or pass --no-og)");
      process.exitCode = 1;
      return;
    }
    const { file } = await renderOgImage(
      compact({
        title,
        component: asString(flags.component),
        exportName: asString(flags.exportName),
        icon: asString(flags.icon),
        description: asString(flags.description),
        siteLabel: asString(flags.siteLabel),
        width: asNumber(flags.width),
        height: asNumber(flags.height),
        outDir: out,
      }) as OgImageOptions & { outDir?: string },
    );
    console.log(`wrote ${file.path} (${file.bytes} bytes)`);
  }

  if (flags.manifest === true) {
    const file = generateManifest(
      compact({
        name: asString(flags.siteName),
        shortName: asString(flags.shortName),
        themeColor: asString(flags.themeColor),
        backgroundColor: asString(flags.backgroundColor),
        outFile: out ? join(out, "site.webmanifest") : undefined,
      }) as ManifestOptions,
    );
    console.log(`wrote ${file.path} (${file.bytes} bytes)`);
  }
}

runCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

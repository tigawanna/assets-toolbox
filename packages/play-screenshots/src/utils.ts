import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative } from "node:path";
import type { Color } from "sharp";

import type { GeneratedAsset, OutputFormat, PlayStoreSection } from "./types";

export function hexToColor(hex: string): Color {
  const trimmed = hex.trim().replace(/^#/, "");
  const full =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((char) => char + char)
          .join("")
      : trimmed;
  if (!/^[\da-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    alpha: 1,
  };
}

export function writeAsset(
  file: string,
  data: Uint8Array,
  width: number,
  height: number,
  section: PlayStoreSection,
  preset: string,
  format: OutputFormat = "png",
): GeneratedAsset {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return {
    name: basename(file),
    path: file,
    bytes: data.byteLength,
    width,
    height,
    section,
    preset,
    format,
  };
}

/** Render a relative `./store/google/...` path for the JSON inventory. */
export function configPath(outDir: string, name: string): string {
  const rel = isAbsolute(outDir) ? relative(process.cwd(), outDir) : outDir;
  const normalized = rel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  return `./${normalized ? `${normalized}/` : ""}${name}`;
}

export function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function padIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

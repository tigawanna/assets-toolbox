import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { Color } from "sharp";

import type { GeneratedFile } from "./types";

/** Drop keys whose value is `undefined`. Keeps `exactOptionalPropertyTypes` happy. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** Parse `#rgb` / `#rrggbb` into a sharp color. */
export function hexToColor(hex: string): Color {
  const trimmed = hex.trim().replace(/^#/, "");
  const full =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((char) => char + char)
          .join("")
      : trimmed;
  if (!/^[\da-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    alpha: 1,
  };
}

/** Read an SVG and turn it into an inline `data:` URL for the OG component. */
export function svgToDataUrl(svgPath: string): string {
  const svg = readFileSync(svgPath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Write a file (creating parent directories) and describe it. */
export function writeFile(file: string, data: string | Uint8Array): GeneratedFile {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return {
    name: basename(file),
    path: file,
    bytes: typeof data === "string" ? Buffer.byteLength(data) : data.byteLength,
  };
}

/** Return a CLI flag only when it was given as a string value. */
export function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

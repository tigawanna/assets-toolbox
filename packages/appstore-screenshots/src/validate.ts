import { stat } from "node:fs/promises";
import sharp from "sharp";

import { MAX_FILE_BYTES } from "./policy";
import type { OutputFormat } from "./types";

/** Byte-level checks: these need the real file and `sharp`, so they run in the host. */
export interface OutputValidationOptions {
  path: string;
  expectedWidth: number;
  expectedHeight: number;
  format: OutputFormat;
  /** Defaults to false: App Store Connect rejects transparent screenshots. */
  allowAlpha?: boolean;
  maxBytes?: number;
}

export interface OutputValidationReport {
  path: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
}

export function assertMaxFileSize(bytes: number, label: string, maxBytes = MAX_FILE_BYTES): void {
  if (bytes > maxBytes) {
    throw new Error(
      `${label}: ${(bytes / 1024 / 1024).toFixed(2)} MB exceeds the ` +
        `${(maxBytes / 1024 / 1024).toFixed(0)} MB App Store file-size cap (verify).`,
    );
  }
}

/**
 * Verify a written asset against the preset it was rendered for: exact size,
 * the requested encoding, no alpha channel, and the file-size cap.
 */
export async function validateOutputFile(
  options: OutputValidationOptions,
): Promise<OutputValidationReport> {
  const { path, expectedWidth, expectedHeight, format, allowAlpha = false } = options;
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
  const { size } = await stat(path);
  const meta = await sharp(path).metadata();

  if (meta.width !== expectedWidth || meta.height !== expectedHeight) {
    throw new Error(
      `${path}: got ${meta.width}×${meta.height}, expected ${expectedWidth}×${expectedHeight}.`,
    );
  }
  const expectedFormat = format === "jpeg" ? "jpeg" : "png";
  if (meta.format !== expectedFormat) {
    throw new Error(`${path}: got ${meta.format} encoding, expected ${expectedFormat}.`);
  }
  const hasAlpha = meta.hasAlpha === true;
  if (hasAlpha && !allowAlpha) {
    throw new Error(
      `${path}: has an alpha channel. App Store Connect rejects transparent screenshots — ` +
        "flatten it onto a background color.",
    );
  }
  assertMaxFileSize(size, path, maxBytes);

  return {
    path,
    bytes: size,
    width: meta.width ?? expectedWidth,
    height: meta.height ?? expectedHeight,
    format: meta.format ?? expectedFormat,
    hasAlpha,
  };
}

/**
 * Pure App Store policy checks. No `sharp`, no disk, no host access — these
 * run in the webview as well as Node so both Studio hosts share them.
 * Byte-level work (alpha, compression, file size) lives in `validate.ts`.
 *
 * The App Store has no banned-promotional-words list and no text-coverage cap,
 * so neither is encoded here (unlike the Play package).
 */

import type { AppStoreScreenshotsConfig } from "./types";

/** JPEG or PNG, RGB, at most 8 MB per file (verify). */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_ALT_LENGTH = 140;
/** Up to 10 screenshots per display size, per localization (verify). */
export const MAX_SCREENSHOTS_PER_DISPLAY = 10;
export const COUNT_WARNING = "warning:";
export const COUNT_ERROR = "error:";

export interface AltTextIssue {
  kind: "too-long" | "leads-with-photo";
  message: string;
}

/** Pure alt-text validation. Returns issues rather than throwing so lint UIs can list them. */
export function checkAltText(alt: string): AltTextIssue[] {
  const issues: AltTextIssue[] = [];
  if (alt.length > MAX_ALT_LENGTH) {
    issues.push({
      kind: "too-long",
      message: `Alt text is ${alt.length} characters (max ${MAX_ALT_LENGTH}).`,
    });
  }
  if (/^\s*(photo of|image of|picture of|screenshot of)\b/iu.test(alt)) {
    issues.push({
      kind: "leads-with-photo",
      message: 'Alt text should describe the UI, not start with "photo of" / "image of".',
    });
  }
  return issues;
}

export function assertAltText(alt: string, label = "alt text"): void {
  const issues = checkAltText(alt);
  if (issues.length > 0)
    throw new Error(`${label}: ${issues.map((issue) => issue.message).join(" ")}`);
}

/**
 * Pure per-display-size count check. Warns at 0 screenshots and reports an
 * error above 10; messages are prefixed so callers can route them. Also
 * surfaces alt-text issues from the inventory.
 */
export function checkScreenshotCounts(config: AppStoreScreenshotsConfig): string[] {
  const issues: string[] = [];
  const sections: Array<[keyof Pick<AppStoreScreenshotsConfig, "iphone" | "ipad">, string]> = [
    ["iphone", "iPhone"],
    ["ipad", "iPad"],
  ];
  for (const [key, label] of sections) {
    const count = config[key].length;
    if (count === 0) {
      issues.push(
        `${COUNT_WARNING} ${label}: no screenshots. Supply at least one per display size.`,
      );
    } else if (count > MAX_SCREENSHOTS_PER_DISPLAY) {
      issues.push(
        `${COUNT_ERROR} ${label}: ${count} screenshots exceeds the maximum of ` +
          `${MAX_SCREENSHOTS_PER_DISPLAY} per display size, per localization.`,
      );
    }
  }
  for (const asset of config.assets) {
    if (asset.alt !== undefined) {
      for (const issue of checkAltText(asset.alt)) {
        issues.push(`${COUNT_WARNING} ${asset.name}: ${issue.message}`);
      }
    }
  }
  return issues;
}

/** Throw on the hard cap errors reported by `checkScreenshotCounts`. */
export function assertScreenshotCounts(config: AppStoreScreenshotsConfig): void {
  const errors = checkScreenshotCounts(config)
    .filter((message) => message.startsWith(`${COUNT_ERROR} `))
    .map((message) => message.slice(COUNT_ERROR.length + 1));
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function isCountError(message: string): boolean {
  return message.startsWith(`${COUNT_ERROR} `);
}

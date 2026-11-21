/**
 * Pure Play policy checks. No `sharp`, no disk, no host access — these run in
 * the webview as well as Node so both Studio hosts share them. Byte-level work
 * (alpha, compression, file size) lives in `validate.ts` in the host.
 */

import type { PlayScreenshotsConfig } from "./types";

/** 24-bit PNG / JPEG, no alpha, at most 8 MB per file. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_ALT_LENGTH = 140;
/** Play recommends the tagline occupy at most ~20% of the image. */
export const MAX_TAGLINE_RATIO = 0.2;
/** Feature-graphic cut zones on the left and right, as a fraction of width. */
export const FEATURE_GRAPHIC_SAFE_MARGIN = 0.08;

export const BANNED_TAGLINE_PHRASES = [
  "best",
  "#1",
  "top",
  "new",
  "discount",
  "sale",
  "million downloads",
  "free",
  "download now",
  "install now",
  "play now",
  "try now",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `text` contains a phrase Play disallows in promotional copy. */
export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_TAGLINE_PHRASES.filter((phrase) => {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}($|[^\\p{L}\\p{N}])`,
      "iu",
    );
    return pattern.test(lower);
  });
}

export function assertNoBannedWords(text: string, label = "tagline"): void {
  const found = findBannedPhrases(text);
  if (found.length > 0) {
    throw new Error(
      `${label} contains banned promotional ${found.length === 1 ? "phrase" : "phrases"}: ` +
        found.map((phrase) => `"${phrase}"`).join(", "),
    );
  }
}

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

/** Count warnings for the sections Play treats specially. */
export function checkScreenshotCounts(config: PlayScreenshotsConfig): string[] {
  const issues: string[] = [];
  const phone = config.play.phone.length;
  if (phone === 1) issues.push("Phone: at least 2 screenshots are required to publish.");
  else if (phone > 0 && phone < 4)
    issues.push("Phone: 4 screenshots at ≥1080p are needed for screenshot-based promotion.");
  if (phone > 8) issues.push(`Phone: ${phone} screenshots exceeds the recommended maximum of 8.`);

  const chromebook = config.play.chromebook.length;
  if (chromebook > 0 && chromebook < 4) issues.push("Chromebook: 4–8 screenshots are recommended.");
  if (chromebook > 8)
    issues.push(`Chromebook: ${chromebook} screenshots exceeds the recommended maximum of 8.`);

  for (const asset of config.assets) {
    if (asset.alt !== undefined) {
      for (const issue of checkAltText(asset.alt)) issues.push(`${asset.name}: ${issue.message}`);
    }
  }
  return issues;
}

/** Pure feature-graphic contrast heuristic: flat white / black / #111 vanish on Play. */
export function isLowContrastFill(hex: string): boolean {
  const raw = hex.trim().replace(/^#/, "").toLowerCase();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  return full === "ffffff" || full === "000000" || full === "111111";
}

/** Pure tagline-area check used by frame mode and the Studio lint panel. */
export function checkTaglineCoverage(ratio: number): void {
  if (ratio > MAX_TAGLINE_RATIO) {
    throw new Error(
      `Tagline occupies ${(ratio * 100).toFixed(1)}% of the image; Play recommends at most ` +
        `${(MAX_TAGLINE_RATIO * 100).toFixed(0)}%.`,
    );
  }
}

/**
 * Warn when a tall phone capture is placed on a much wider/square board — the
 * result would be large empty bands. Frame mode re-lays the capture out; fit
 * mode simply letterboxes it, which Play discourages for foldable/tablet.
 */
export function checkCaptureAspectMismatch(
  srcWidth: number,
  srcHeight: number,
  presetWidth: number,
  presetHeight: number,
): string | null {
  if (!Number.isFinite(srcWidth) || !Number.isFinite(srcHeight) || srcHeight <= 0) return null;
  const src = srcWidth / srcHeight;
  const dst = presetWidth / presetHeight;
  const ratio = Math.max(src / dst, dst / src);
  if (ratio <= 1.6) return null;
  return (
    `Capture aspect ${src.toFixed(2)} differs from preset aspect ${dst.toFixed(2)} ` +
    `(${ratio.toFixed(1)}×). Re-lay out for this form factor instead of letterboxing.`
  );
}

/** Wear presets must never carry frames or extra copy. */
export function assertFrameAllowed(section: string): void {
  if (section === "wear" || section === "auto-portrait" || section === "auto-landscape") {
    throw new Error(
      `Frame mode is not allowed for "${section}" assets. Use fit mode — these sections forbid ` +
        "device frames and extra text.",
    );
  }
}

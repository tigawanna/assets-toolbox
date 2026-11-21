import { describe, expect, it } from "vite-plus/test";

import { assertPlayBounds, getPreset } from "../src/sizes";
import {
  assertAltText,
  assertFrameAllowed,
  assertNoBannedWords,
  buildInventory,
  checkAltText,
  checkScreenshotCounts,
  checkTaglineCoverage,
  findBannedPhrases,
  isLowContrastFill,
  MAX_FILE_BYTES,
} from "../src/index";
import { assertMaxFileSize } from "../src/validate";
import type { GeneratedAsset, PlayScreenshotsConfig } from "../src/types";

function configWith(phone: string[], chromebook: string[] = []): PlayScreenshotsConfig {
  return {
    version: 1,
    store: "play",
    layout: "flat",
    locale: "en-US",
    format: "png",
    play: {
      phone,
      tablet7: [],
      tablet10: [],
      foldable: [],
      chromebook,
      wear: [],
      tv: [],
      automotive: [],
      xr: [],
    },
    assets: [],
  };
}

describe("pure policy checks", () => {
  it("detects banned promotional phrases as whole words", () => {
    expect(findBannedPhrases("Inbox zero, offline first")).toEqual([]);
    expect(findBannedPhrases("Best app #1 — Download now")).toEqual(
      expect.arrayContaining(["best", "#1", "download now"]),
    );
    expect(() => assertNoBannedWords("Best app #1 — Download now")).toThrow(/banned/);
    expect(() => assertNoBannedWords("The bestest inbox")).not.toThrow();
  });

  it("validates alt text length and leading filler", () => {
    expect(checkAltText("Home timeline with unread messages")).toEqual([]);
    expect(checkAltText("photo of a phone").map((issue) => issue.kind)).toContain(
      "leads-with-photo",
    );
    expect(checkAltText("x".repeat(141)).map((issue) => issue.kind)).toContain("too-long");
    expect(() => assertAltText("x".repeat(141))).toThrow(/140/);
  });

  it("warns about Play section counts", () => {
    expect(checkScreenshotCounts(configWith([]))).toEqual([]);
    expect(checkScreenshotCounts(configWith(["01.png"])).join(" ")).toMatch(/at least 2/);
    expect(checkScreenshotCounts(configWith(["01.png", "02.png"])).join(" ")).toMatch(
      /4 screenshots/,
    );
    expect(checkScreenshotCounts(configWith([], ["01.png"])).join(" ")).toMatch(/Chromebook/);
  });

  it("checks feature-graphic contrast and tagline coverage", () => {
    expect(isLowContrastFill("#ffffff")).toBe(true);
    expect(isLowContrastFill("#000")).toBe(true);
    expect(isLowContrastFill("#0f100f")).toBe(false);
    expect(() => checkTaglineCoverage(0.19)).not.toThrow();
    expect(() => checkTaglineCoverage(0.21)).toThrow(/20%/);
  });

  it("refuses frame mode for Wear and Automotive", () => {
    expect(() => assertFrameAllowed("wear")).toThrow(/not allowed/);
    expect(() => assertFrameAllowed("phone")).not.toThrow();
  });

  it("asserts preset bounds and file size caps", () => {
    expect(() => assertPlayBounds(getPreset("phone-portrait"))).not.toThrow();
    expect(() => assertMaxFileSize(MAX_FILE_BYTES - 1, "shot.png")).not.toThrow();
    expect(() => assertMaxFileSize(MAX_FILE_BYTES + 1, "shot.png")).toThrow(/8 MB/);
  });
});

describe("buildInventory", () => {
  const asset = (section: GeneratedAsset["section"], name: string): GeneratedAsset => ({
    name,
    path: `/tmp/out/${name}`,
    bytes: 123,
    width: 1080,
    height: 1920,
    section,
    preset: name.replace(/^\d+-|\.png$|\.jpg$/g, ""),
    format: "png",
  });

  it("builds the flat inventory and duplicates tablet paths", () => {
    const config = buildInventory(
      [asset("phone", "01-phone-portrait.png"), asset("tablet-10", "01-tablet-portrait.png")],
      { outDir: "store/google" },
    );
    expect(config.play.phone).toEqual(["./store/google/01-phone-portrait.png"]);
    expect(config.play.tablet7).toEqual(config.play.tablet10);
    expect(config.assets).toHaveLength(2);
    expect(config.version).toBe(1);
  });

  it("builds fastlane paths", () => {
    const config = buildInventory(
      [asset("phone", "01-phone-portrait.png"), asset("feature-graphic", "feature-graphic.png")],
      { outDir: "/tmp/out", layout: "fastlane", locale: "fr-FR" },
    );
    expect(config.play.phone[0]).toBe(
      "./metadata/android/fr-FR/images/phoneScreenshots/01-phone-portrait.png",
    );
    expect(config.play.featureGraphic).toBe("./metadata/android/fr-FR/images/featureGraphic.png");
  });
});

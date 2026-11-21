import { describe, expect, it } from "vite-plus/test";

import {
  APP_STORE_SCREENSHOT_DEFAULTS,
  assertAltText,
  assertMaxFileSize,
  assertScreenshotCounts,
  buildInventory,
  checkAltText,
  checkScreenshotCounts,
  MAX_ALT_LENGTH,
  MAX_FILE_BYTES,
  MAX_SCREENSHOTS_PER_DISPLAY,
  type AppStoreScreenshotsConfig,
  type GeneratedAsset,
} from "../src/index";

function configWith(iphone: string[], ipad: string[] = []): AppStoreScreenshotsConfig {
  return {
    version: 1,
    store: "app-store",
    layout: "flat",
    locale: "en-US",
    format: "png",
    iphone,
    ipad,
    assets: [],
  };
}

describe("pure policy checks", () => {
  it("has the documented limits and defaults", () => {
    expect(MAX_ALT_LENGTH).toBe(140);
    expect(MAX_FILE_BYTES).toBe(8 * 1024 * 1024);
    expect(MAX_SCREENSHOTS_PER_DISPLAY).toBe(10);
    expect(APP_STORE_SCREENSHOT_DEFAULTS).toMatchObject({
      outDir: "store/appstore",
      presets: ["iphone-6-9"],
      layout: "flat",
      locale: "en-US",
    });
  });

  it("validates alt text length and leading filler", () => {
    expect(checkAltText("Home timeline with unread messages")).toEqual([]);
    expect(checkAltText("photo of a phone").map((issue) => issue.kind)).toContain(
      "leads-with-photo",
    );
    expect(checkAltText("image of a tablet").map((issue) => issue.kind)).toContain(
      "leads-with-photo",
    );
    expect(checkAltText("x".repeat(141)).map((issue) => issue.kind)).toContain("too-long");
    expect(() => assertAltText("x".repeat(141))).toThrow(/140/);
  });

  it("warns at zero screenshots and errors above ten per display size", () => {
    expect(checkScreenshotCounts(configWith(["01.png"], ["01.png"]))).toEqual([]);
    const bothEmpty = checkScreenshotCounts(configWith([])).join(" ");
    expect(bothEmpty).toMatch(/iPhone.*no screenshots/);
    expect(bothEmpty).toMatch(/iPad.*no screenshots/);
    expect(checkScreenshotCounts(configWith(["01.png"])).join(" ")).toMatch(/iPad.*no screenshots/);
    expect(checkScreenshotCounts(configWith([], ["01.png"])).join(" ")).toMatch(
      /iPhone.*no screenshots/,
    );

    const tooMany = Array.from({ length: 11 }, (_, index) => `${index + 1}.png`);
    expect(checkScreenshotCounts(configWith(tooMany)).join(" ")).toMatch(
      /error:.*11.*maximum of 10/,
    );
    expect(() => assertScreenshotCounts(configWith(tooMany))).toThrow(/exceeds the maximum of 10/);
    expect(() => assertScreenshotCounts(configWith(tooMany, tooMany))).toThrow(/iPad/);
    expect(() => assertScreenshotCounts(configWith(["01.png"]))).not.toThrow();
  });

  it("checks the file size cap", () => {
    expect(() => assertMaxFileSize(MAX_FILE_BYTES - 1, "shot.png")).not.toThrow();
    expect(() => assertMaxFileSize(MAX_FILE_BYTES + 1, "shot.png")).toThrow(/8 MB/);
  });
});

describe("buildInventory", () => {
  const asset = (
    section: GeneratedAsset["section"],
    preset: string,
    name: string,
  ): GeneratedAsset => ({
    name,
    path: `/tmp/out/${name}`,
    bytes: 123,
    width: 1320,
    height: 2868,
    section,
    preset,
    format: "png",
  });

  it("builds the flat inventory", () => {
    const config = buildInventory(
      [
        asset("iphone", "iphone-6-9", "01-iphone-6-9.png"),
        asset("ipad", "ipad-13", "01-ipad-13.png"),
      ],
      { outDir: "store/appstore" },
    );
    expect(config).toMatchObject({ version: 1, store: "app-store", layout: "flat" });
    expect(config.iphone).toEqual(["./store/appstore/01-iphone-6-9.png"]);
    expect(config.ipad).toEqual(["./store/appstore/01-ipad-13.png"]);
    expect(config.assets).toHaveLength(2);
  });

  it("builds deliver paths with display labels", () => {
    const config = buildInventory(
      [
        asset("iphone", "iphone-6-9", "02-iphone-6-9.png"),
        asset("ipad", "ipad-12-9", "01-ipad-12-9.png"),
      ],
      { outDir: "/tmp/out", layout: "deliver", locale: "en-US" },
    );
    expect(config.layout).toBe("deliver");
    expect(config.iphone).toEqual(["./fastlane/screenshots/en-US/iPhone 6.9-02.png"]);
    expect(config.ipad).toEqual(["./fastlane/screenshots/en-US/iPad 12.9-01.png"]);
  });
});

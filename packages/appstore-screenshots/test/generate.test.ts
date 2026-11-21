import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { parseCliArgs } from "../src/cli";
import { generateAppStoreScreenshots } from "../src/generate";
import {
  APP_STORE_PRESET_IDS,
  APP_STORE_PRESETS,
  assertAppStoreBounds,
  getPreset,
} from "../src/sizes";
import { validateOutputFile } from "../src/validate";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "appstore-screenshots-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function makeShot(dir: string, width = 400, height = 800, alpha = 0.4): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `shot-${width}x${height}.png`);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 180, b: 90, alpha },
    },
  })
    .png()
    .toFile(file);
  return file;
}

describe("APP_STORE_PRESETS", () => {
  it("has the accepted iPhone and iPad sizes and their landscape variants", () => {
    expect(APP_STORE_PRESETS["iphone-6-9"]).toMatchObject({
      width: 1320,
      height: 2868,
      section: "iphone",
      flatten: true,
    });
    expect(APP_STORE_PRESETS["iphone-6-5"]).toMatchObject({ width: 1284, height: 2778 });
    expect(APP_STORE_PRESETS["ipad-13"]).toMatchObject({ width: 2064, height: 2752 });
    expect(APP_STORE_PRESETS["ipad-12-9"]).toMatchObject({ width: 2048, height: 2732 });
    expect(APP_STORE_PRESETS["ipad-13-landscape"]).toMatchObject({ width: 2752, height: 2064 });
    expect(APP_STORE_PRESET_IDS.length).toBe(8);
    for (const id of APP_STORE_PRESET_IDS) {
      expect(APP_STORE_PRESETS[id].flatten).toBe(true);
      expect(() => assertAppStoreBounds(getPreset(id))).not.toThrow();
    }
  });

  it("rejects unknown preset ids", () => {
    expect(() => getPreset("pixel-9")).toThrow(/Unknown preset/);
  });
});

describe("parseCliArgs", () => {
  it("collects repeated shots and presets plus value and boolean flags", () => {
    const args = parseCliArgs([
      "-s",
      "a.png",
      "--shot",
      "b.png",
      "--preset",
      "iphone-6-9",
      "--preset",
      "ipad-13",
      "-o",
      "./store",
      "--brand-color",
      "#ff00aa",
      "--format",
      "jpeg",
      "--locale",
      "fr-FR",
      "--layout",
      "deliver",
      "--no-config",
      "--list-presets",
    ]);
    expect(args.shots).toEqual(["a.png", "b.png"]);
    expect(args.presets).toEqual(["iphone-6-9", "ipad-13"]);
    expect(args).toMatchObject({
      out: "./store",
      brandColor: "#ff00aa",
      format: "jpeg",
      locale: "fr-FR",
      layout: "deliver",
      noConfig: true,
      listPresets: true,
    });
  });

  it("supports --help/-h and --flag=value", () => {
    expect(parseCliArgs(["-h"]).help).toBe(true);
    expect(parseCliArgs(["--format=jpeg"]).format).toBe("jpeg");
  });
});

describe("generateAppStoreScreenshots", () => {
  it("fits a capture to the exact preset, flattens alpha and writes the flat inventory", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    const result = await generateAppStoreScreenshots({
      shots: [{ file: shot, alt: "Home timeline" }],
      outDir: out,
    });

    expect(result.assets.map((asset) => asset.name)).toEqual(["01-iphone-6-9.png"]);
    expect(result.assets[0]).toMatchObject({ width: 1320, height: 2868, section: "iphone" });
    expect(result.config.iphone).toEqual([`./${relative(process.cwd(), out)}/01-iphone-6-9.png`]);
    expect(result.config.ipad).toEqual([]);
    expect(JSON.parse(readFileSync(result.configPath ?? "", "utf8"))).toEqual(result.config);
    expect(result.agentPrompt).toContain("App Store Connect");
    expect(result.warnings.join(" ")).toMatch(/iPad.*no screenshots/);

    const { data, info } = await sharp(join(out, "01-iphone-6-9.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1320);
    expect(info.height).toBe(2868);
    expect(data[3]).toBe(255);
  });

  it("writes deliver paths with display labels for shots across two sections", async () => {
    const dir = makeTempDir();
    const first = await makeShot(dir, 300, 600);
    const second = await makeShot(dir, 301, 601);
    const out = join(dir, "out");
    const result = await generateAppStoreScreenshots({
      shots: [{ file: first }, { file: second }],
      outDir: out,
      presets: ["iphone-6-9", "ipad-13"],
      layout: "deliver",
      locale: "fr-FR",
    });

    const base = "./fastlane/screenshots/fr-FR/";
    expect(result.config.iphone).toEqual([`${base}iPhone 6.9-01.png`, `${base}iPhone 6.9-02.png`]);
    expect(result.config.ipad).toEqual([`${base}iPad 13-01.png`, `${base}iPad 13-02.png`]);
    expect(result.assets).toHaveLength(4);
    for (const name of [
      "iPhone 6.9-01.png",
      "iPhone 6.9-02.png",
      "iPad 13-01.png",
      "iPad 13-02.png",
    ]) {
      expect(existsSync(join(out, "fastlane/screenshots/fr-FR", name))).toBe(true);
    }
    for (const asset of result.assets) {
      await expect(
        validateOutputFile({
          path: asset.path,
          expectedWidth: asset.width,
          expectedHeight: asset.height,
          format: "png",
        }),
      ).resolves.toMatchObject({ hasAlpha: false });
    }
  });

  it("writes opaque JPEGs with the jpg extension", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    const result = await generateAppStoreScreenshots({
      shots: [{ file: shot }],
      outDir: out,
      format: "jpeg",
    });
    expect(result.assets[0]?.name).toBe("01-iphone-6-9.jpg");
    expect(result.config.format).toBe("jpeg");
    const meta = await sharp(join(out, "01-iphone-6-9.jpg")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.hasAlpha).toBeFalsy();
  });

  it("rejects a transparent file in byte validation", async () => {
    const dir = makeTempDir();
    const transparent = await makeShot(dir, 40, 80, 0.5);
    await expect(
      validateOutputFile({
        path: transparent,
        expectedWidth: 40,
        expectedHeight: 80,
        format: "png",
      }),
    ).rejects.toThrow(/alpha/);
  });
});

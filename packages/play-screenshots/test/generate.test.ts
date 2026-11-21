import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { parseCliArgs } from "../src/cli";
import { generatePlayScreenshots } from "../src/generate";
import { getPreset, PLAY_STORE_PRESET_IDS, PLAY_STORE_PRESETS } from "../src/sizes";
import { configPath } from "../src/utils";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "play-screenshots-"));
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

describe("PLAY_STORE_PRESETS", () => {
  it("covers the sizes Play Console actually asks for", () => {
    expect(PLAY_STORE_PRESETS["phone-portrait"]).toMatchObject({ width: 1080, height: 1920 });
    expect(PLAY_STORE_PRESETS["phone-landscape"]).toMatchObject({ width: 1920, height: 1080 });
    expect(PLAY_STORE_PRESETS["feature-graphic"]).toMatchObject({ width: 1024, height: 500 });
    expect(PLAY_STORE_PRESETS["tablet-landscape"]).toMatchObject({ width: 2560, height: 1600 });
    expect(PLAY_STORE_PRESETS.wear).toMatchObject({ width: 384, height: 384, flatten: true });
    expect(PLAY_STORE_PRESETS["play-icon"].flatten).toBe(false);
    expect(PLAY_STORE_PRESET_IDS.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects unknown preset ids", () => {
    expect(() => getPreset("ipad")).toThrow(/Unknown preset/);
  });
});

describe("parseCliArgs", () => {
  it("collects repeated shots and presets", () => {
    const args = parseCliArgs([
      "--shot",
      "a.png",
      "--shot",
      "b.png",
      "--preset",
      "phone-portrait",
      "--preset",
      "tablet-landscape",
      "--feature-graphic",
      "--out",
      "./store",
    ]);
    expect(args.shots).toEqual(["a.png", "b.png"]);
    expect(args.presets).toEqual(["phone-portrait", "tablet-landscape"]);
    expect(args.featureGraphic).toBe(true);
    expect(args.out).toBe("./store");
  });
});

describe("generatePlayScreenshots", () => {
  it("letterboxes shots into phone-portrait and flattens alpha", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    const result = await generatePlayScreenshots({
      shots: [{ file: shot, alt: "Home" }],
      outDir: out,
    });

    expect(result.assets.map((asset) => asset.name)).toEqual(["01-phone-portrait.png"]);
    expect(result.assets[0]).toMatchObject({ width: 1080, height: 1920, section: "phone" });

    const { data, info } = await sharp(join(out, "01-phone-portrait.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(data[3]).toBe(255);
  });

  it("emits a feature graphic and a JSON inventory", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir, 800, 400);
    const out = join(dir, "out");
    const result = await generatePlayScreenshots({
      shots: [{ file: shot }],
      outDir: out,
      presets: ["phone-landscape"],
      featureGraphic: true,
    });

    const names = result.assets.map((asset) => asset.name);
    expect(names).toContain("01-phone-landscape.png");
    expect(names).toContain("feature-graphic.png");
    expect(result.config.play.featureGraphic).toBe(configPath(out, "feature-graphic.png"));
    expect(JSON.parse(readFileSync(result.configPath ?? "", "utf8"))).toEqual(result.config);
    expect(result.agentPrompt).toContain("Play Console");

    const meta = await sharp(join(out, "feature-graphic.png")).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(500);
  });

  it("writes one file per shot × preset", async () => {
    const dir = makeTempDir();
    const first = await makeShot(dir, 200, 400);
    const second = await makeShot(dir, 201, 401);
    const result = await generatePlayScreenshots({
      shots: [{ file: first }, { file: second }],
      outDir: join(dir, "out"),
      presets: ["phone-portrait", "tablet-landscape"],
    });
    expect(result.assets.map((asset) => asset.name).sort()).toEqual(
      [
        "01-phone-portrait.png",
        "01-tablet-landscape.png",
        "02-phone-portrait.png",
        "02-tablet-landscape.png",
      ].sort(),
    );
    expect(result.config.play.tablet7).toEqual(result.config.play.tablet10);
  });
});

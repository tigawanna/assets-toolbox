import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement, isValidElement } from "react";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadConfigFile, loadFrameComponent, renderFrame, shotToDataUrl } from "../src/index";
import { generatePlayScreenshots } from "../src/generate";
import { DefaultFeatureGraphic } from "../src/default-feature";
import { DefaultFrame } from "../src/default-frame";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "play-screenshots-frame-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function makeShot(dir: string): Promise<string> {
  const file = join(dir, "shot.png");
  await sharp({
    create: { width: 600, height: 1200, channels: 3, background: { r: 20, g: 180, b: 90 } },
  })
    .png()
    .toFile(file);
  return file;
}

describe("frame components", () => {
  it("exposes valid built-in templates", () => {
    expect(
      isValidElement(createElement(DefaultFrame, { title: "Hi", brandColor: "#0f100f" })),
    ).toBe(true);
    expect(
      isValidElement(
        createElement(DefaultFeatureGraphic, {
          appName: "App",
          slogan: "Go",
          brandColor: "#0f100f",
        }),
      ),
    ).toBe(true);
  });

  it("loads a fixture by default export and by named export", async () => {
    const file = join(import.meta.dirname, "fixtures", "Frame.tsx");
    const Default = await loadFrameComponent(file);
    expect(isValidElement(createElement(Default, { title: "Hi" }))).toBe(true);
    const Named = await loadFrameComponent(file, "AltFrame");
    expect(isValidElement(createElement(Named, { marker: "ok" }))).toBe(true);
    await expect(loadFrameComponent(file, "Missing")).rejects.toThrow(/No React frame component/);
  });

  it("turns a capture into a data URL", async () => {
    const shot = await makeShot(makeTempDir());
    expect(await shotToDataUrl(shot)).toMatch(/^data:image\/png;base64,/);
  });
});

describe("frame render", () => {
  it("renders an exact-size opaque PNG with the capture on the canvas", async () => {
    const shot = await makeShot(makeTempDir());
    const buffer = await renderFrame({
      width: 1080,
      height: 1920,
      props: {
        title: "Inbox zero",
        screenshotDataUrl: await shotToDataUrl(shot),
        brandColor: "#0f100f",
      },
    });
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(data[3]).toBe(255);

    let nonBrand = 0;
    for (let y = 800; y < 1600; y += 40) {
      const offset = (y * info.width + 540) * info.channels;
      if (data[offset] !== 15 || data[offset + 1] !== 16 || data[offset + 2] !== 15) nonBrand += 1;
    }
    expect(nonBrand).toBeGreaterThan(0);
  }, 30_000);
});

describe("generatePlayScreenshots — frame mode", () => {
  it("composes a headline frame and an opaque feature graphic", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    const result = await generatePlayScreenshots({
      shots: [{ file: shot }],
      outDir: out,
      mode: "frame",
      title: "Inbox zero",
      subtitle: "Works offline",
      featureGraphic: true,
    });

    expect(result.assets.map((asset) => asset.name).sort()).toEqual(
      ["01-phone-portrait.png", "feature-graphic.png"].sort(),
    );
    const meta = await sharp(join(out, "01-phone-portrait.png")).metadata();
    expect(meta).toMatchObject({ width: 1080, height: 1920, format: "png" });
    expect(meta.hasAlpha).toBe(false);
    const fg = await sharp(join(out, "feature-graphic.png")).metadata();
    expect(fg).toMatchObject({ width: 1024, height: 500 });
    expect(result.config.play.featureGraphic).toBeDefined();
  }, 30_000);

  it("rejects banned copy and Wear presets", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    await expect(
      generatePlayScreenshots({
        shots: [{ file: shot }],
        outDir: join(dir, "out"),
        mode: "frame",
        title: "Best app #1 — Download now",
      }),
    ).rejects.toThrow(/banned/);
    await expect(
      generatePlayScreenshots({
        shots: [{ file: shot }],
        outDir: join(dir, "out-wear"),
        mode: "frame",
        title: "Clean UI",
        presets: ["wear"],
      }),
    ).rejects.toThrow(/not allowed/);
  });

  it("uses a custom React frame via --component", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    await generatePlayScreenshots({
      shots: [{ file: shot }],
      outDir: out,
      mode: "frame",
      title: "Custom frame",
      component: join(import.meta.dirname, "fixtures", "Frame.tsx"),
    });
    const meta = await sharp(join(out, "01-phone-portrait.png")).metadata();
    expect(meta).toMatchObject({ width: 1080, height: 1920 });
  }, 30_000);

  it("writes scaled-down JPEGs into the fastlane tree", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const out = join(dir, "out");
    const result = await generatePlayScreenshots({
      shots: [{ file: shot }],
      outDir: out,
      format: "jpeg",
      layout: "fastlane",
      locale: "en-US",
      presets: ["phone-portrait", "phone-landscape"],
      featureGraphic: true,
    });
    expect(result.config.format).toBe("jpeg");
    expect(result.assets.every((asset) => asset.name.endsWith(".jpg"))).toBe(true);
    expect(
      readFileSync(
        join(out, "metadata/android/en-US/images/phoneScreenshots/01-phone-portrait.jpg"),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      readFileSync(join(out, "metadata/android/en-US/images/featureGraphic.jpg")).length,
    ).toBeGreaterThan(0);
    const meta = await sharp(
      join(out, "metadata/android/en-US/images/phoneScreenshots/01-phone-portrait.jpg"),
    ).metadata();
    expect(meta.format).toBe("jpeg");
  }, 30_000);
});

describe("loadConfigFile", () => {
  it("loads a TypeScript config with a shots array", async () => {
    const dir = makeTempDir();
    const shot = await makeShot(dir);
    const file = join(dir, "config.ts");
    writeFileSync(
      file,
      `export default { shots: [{ file: ${JSON.stringify(shot)} }], presets: ["phone-portrait"] };\n`,
    );
    const config = await loadConfigFile(file);
    expect(config.shots).toHaveLength(1);
    expect(config.presets).toEqual(["phone-portrait"]);
  });
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateExpoAssets } from "../src/assets";
import { configPath } from "../src/utils";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "expo-assets-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const icon = join(import.meta.dirname, "fixtures", "logo.svg");

describe("generateExpoAssets", () => {
  it("writes the Expo asset set with the expected dimensions", async () => {
    const out = makeTempDir();
    const result = await generateExpoAssets({ icon, outDir: out });

    expect(result.assets.map((asset) => asset.name).sort()).toEqual(
      [
        "adaptive-icon.png",
        "android-icon-background.png",
        "android-icon-monochrome.png",
        "favicon.png",
        "icon.png",
        "notification-icon.png",
        "splash-icon.png",
      ].sort(),
    );

    const dimensions = Object.fromEntries(
      result.assets.map((asset) => [asset.name, `${asset.width}x${asset.height}`]),
    );
    expect(dimensions).toMatchObject({
      "icon.png": "1024x1024",
      "adaptive-icon.png": "1024x1024",
      "splash-icon.png": "1024x1024",
      "favicon.png": "48x48",
      "notification-icon.png": "96x96",
    });

    for (const asset of result.assets) {
      const meta = await sharp(join(out, asset.name)).metadata();
      expect(meta.width).toBe(asset.width);
      expect(meta.height).toBe(asset.height);
    }
  });

  it("writes an app.json fragment with paths relative to the project", async () => {
    const out = makeTempDir();
    const result = await generateExpoAssets({
      icon,
      outDir: out,
      imageWidth: 180,
      splashBackground: "#101010",
    });

    expect(result.config.expo.icon).toBe(configPath(out, "icon.png"));
    expect(result.config.expo.web.favicon).toBe(configPath(out, "favicon.png"));
    const plugin = result.config.expo.plugins[0];
    expect(plugin?.[0]).toBe("expo-splash-screen");
    expect(plugin?.[1]).toMatchObject({ imageWidth: 180, backgroundColor: "#101010" });
    expect(JSON.parse(readFileSync(result.configPath ?? "", "utf8"))).toEqual(result.config);
    expect(result.agentPrompt).toContain("app.json");
  });

  it("makes the monochrome icon a white silhouette on transparency", async () => {
    const out = makeTempDir();
    await generateExpoAssets({ icon, outDir: out });

    const { data, info } = await sharp(join(out, "android-icon-monochrome.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const corner = 4 * (10 * info.width + 10);
    expect(data[corner + 3]).toBe(0); // transparent outside the logo

    const center = 4 * ((info.height / 2) * info.width + info.width / 2);
    expect(data[center + 3]).toBe(255); // opaque inside
    expect(data[center]).toBe(255); // white
    expect(data[center + 1]).toBe(255);
    expect(data[center + 2]).toBe(255);
  });

  it("honors dark/tinted sources and the no-monochrome flag", async () => {
    const out = makeTempDir();
    const result = await generateExpoAssets({
      icon,
      darkIcon: icon,
      tintedIcon: icon,
      noMonochrome: true,
      outDir: out,
    });

    const names = result.assets.map((asset) => asset.name);
    expect(names).toContain("splash-icon-dark.png");
    expect(names).toContain("ios-tinted.png");
    expect(names).not.toContain("android-icon-monochrome.png");
  });
});

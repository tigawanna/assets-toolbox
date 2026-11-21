import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, expect, it } from "vite-plus/test";

import { generateIconSet } from "../src/icons";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "brand-assets-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const icon = join(import.meta.dirname, "fixtures", "icon.svg");

it("generates the standard favicon set from an SVG", async () => {
  const out = makeTempDir();
  const files = await generateIconSet({ icon, outDir: out });

  expect(files.map((file) => file.name).sort()).toEqual(
    [
      "apple-touch-icon.png",
      "favicon-32x32.png",
      "favicon-96x96.png",
      "favicon.ico",
      "web-app-manifest-192x192.png",
      "web-app-manifest-512x512.png",
    ].sort(),
  );
  expect(readdirSync(out)).toHaveLength(files.length);

  const transparent = await sharp(join(out, "favicon-32x32.png")).metadata();
  expect(transparent.width).toBe(32);
  expect(transparent.height).toBe(32);

  const plated = await sharp(join(out, "apple-touch-icon.png")).metadata();
  expect(plated.width).toBe(180);
  expect(plated.height).toBe(180);
});

it("honors size overrides and the copySvg option", async () => {
  const out = makeTempDir();
  const files = await generateIconSet({
    icon,
    outDir: out,
    copySvg: true,
    sizes: {
      ico: [16],
      transparent: { "custom.png": 24 },
      plated: {},
    },
  });

  expect(files.map((file) => file.name).sort()).toEqual([
    "custom.png",
    "favicon.ico",
    "favicon.svg",
  ]);
  const meta = await sharp(join(out, "custom.png")).metadata();
  expect(meta.width).toBe(24);
});

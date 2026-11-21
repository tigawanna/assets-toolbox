/**
 * Generate the example screenshots locally so the repo does not carry large fixtures.
 * Run once before opening the example project:
 *   node examples/hollow/generate-assets.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(dir, "assets");
mkdirSync(assetsDir, { recursive: true });

const slides = [
  { file: "home.png", color: { r: 24, g: 28, b: 52 }, bar: { r: 99, g: 91, b: 255 } },
  { file: "search.png", color: { r: 18, g: 32, b: 34 }, bar: { r: 139, g: 212, b: 80 } },
  { file: "archive.png", color: { r: 40, g: 26, b: 20 }, bar: { r: 255, g: 184, b: 107 } },
];

for (const slide of slides) {
  await sharp({
    create: {
      width: 1080,
      height: 2400,
      channels: 3,
      background: slide.color,
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1080" height="2400"><rect x="80" y="180" width="920" height="90" rx="24" fill="#ffffff" opacity="0.16"/><rect x="80" y="340" width="680" height="40" rx="20" fill="#ffffff" opacity="0.12"/><rect x="80" y="420" width="820" height="40" rx="20" fill="#ffffff" opacity="0.1"/><rect x="80" y="500" width="560" height="40" rx="20" fill="#ffffff" opacity="0.08"/></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(join(assetsDir, slide.file));
}

await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 91, b: 255, alpha: 1 } },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="512" height="512"><circle cx="256" cy="256" r="120" fill="#ffffff" opacity="0.9"/></svg>',
      ),
    },
  ])
  .png()
  .toFile(join(assetsDir, "icon.png"));

console.log(`Generated ${slides.length + 1} example assets in ${dir}`);

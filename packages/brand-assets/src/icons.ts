import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pngToIco from "png-to-ico";
import sharp, { type Color } from "sharp";

import { defaultIconSizes, type GeneratedFile, type IconSetOptions, type IconSizes } from "./types";
import { hexToColor, writeFile } from "./utils";

const transparent: Color = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Rasterize the source SVG/PNG once and emit the standard favicon set:
 * transparent PNGs, plated touch/manifest PNGs, and a multi-resolution
 * `favicon.ico`.
 */
export async function generateIconSet(options: IconSetOptions): Promise<GeneratedFile[]> {
  const source = readFileSync(resolve(options.icon));
  const outDir = resolve(options.outDir ?? process.cwd());
  const sizes: IconSizes = {
    ico: options.sizes?.ico ?? defaultIconSizes.ico,
    transparent: options.sizes?.transparent ?? defaultIconSizes.transparent,
    plated: options.sizes?.plated ?? defaultIconSizes.plated,
  };
  const plate = hexToColor(options.plate ?? "#0f100f");

  const contain = (size: number): Promise<Buffer> =>
    sharp(source).resize(size, size, { fit: "contain", background: transparent }).png().toBuffer();

  const plated = async (size: number, padding: number): Promise<Buffer> => {
    const inner = size - padding * 2;
    const logo = await contain(inner);
    return sharp({
      create: { width: size, height: size, channels: 4, background: plate },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toBuffer();
  };

  const files: GeneratedFile[] = [];

  const transparentEntries = Object.entries(sizes.transparent) as Array<[string, number]>;
  for (const [name, size] of transparentEntries) {
    files.push(writeFile(join(outDir, name), await contain(size)));
  }
  const platedEntries = Object.entries(sizes.plated) as Array<
    [string, readonly [size: number, padding: number]]
  >;
  for (const [name, [size, padding]] of platedEntries) {
    files.push(writeFile(join(outDir, name), await plated(size, padding)));
  }

  const ico = await pngToIco(await Promise.all(sizes.ico.map(contain)));
  files.push(writeFile(join(outDir, "favicon.ico"), ico));

  if (options.copySvg) {
    files.push(writeFile(join(outDir, "favicon.svg"), source));
  }

  return files;
}

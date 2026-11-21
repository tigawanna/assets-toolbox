import sharp, { type Color } from "sharp";

import type { OutputFormat } from "./types";

/** Letterbox a raw simulator capture into an exact preset size, flattening alpha. */
export async function fitToPreset(
  source: string,
  width: number,
  height: number,
  background: Color,
  flatten: boolean,
  format: OutputFormat = "png",
): Promise<Buffer> {
  let pipeline = sharp(source, { density: 300 }).resize(width, height, {
    fit: "contain",
    background,
  });
  if (flatten) pipeline = pipeline.flatten({ background });
  return format === "jpeg" ? pipeline.jpeg({ quality: 90 }).toBuffer() : pipeline.png().toBuffer();
}

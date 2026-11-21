import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { createJiti } from "jiti";
import { createElement, type ComponentType } from "react";
import { render } from "takumi-js";
import { googleFonts } from "takumi-js/helpers";

import { DefaultFrame } from "./default-frame";
import { DefaultFeatureGraphic } from "./default-feature";

/** Any React component that can receive the injected frame props. */
export type FrameComponent = ComponentType<Record<string, unknown>>;

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Read a capture and turn it into a data URL Takumi can draw in an `<img>`. */
export async function shotToDataUrl(file: string): Promise<string> {
  const bytes = await readFile(resolve(file));
  const mime = MIME[extname(file).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/**
 * Load a React frame component from a `.ts`/`.tsx` file at runtime. Jiti handles
 * the TypeScript/JSX transform, so users never need a build step.
 */
export async function loadFrameComponent(
  componentPath: string,
  exportName?: string,
): Promise<FrameComponent> {
  const jiti = createJiti(import.meta.url, {
    jsx: { runtime: "automatic", importSource: "react" },
    interopDefault: true,
  });
  const module = await jiti.import<Record<string, unknown>>(resolve(componentPath));
  const candidates = exportName
    ? [module[exportName]]
    : [
        module.default,
        module.Frame,
        module.PlayFrame,
        module.Screenshot,
        module.Image,
        module.DefaultFrame,
      ];
  // `interopDefault` can set `default` to the whole namespace object, so pick
  // the first candidate that is actually callable.
  const candidate = candidates.find((entry) => typeof entry === "function");
  if (candidate === undefined) {
    const exports = Object.keys(module).join(", ") || "(none)";
    throw new Error(
      `No React frame component found in ${componentPath} (exports: ${exports}). ` +
        "Use a default export or pass an explicit export name.",
    );
  }
  return candidate as FrameComponent;
}

export interface FrameRenderOptions {
  width: number;
  height: number;
  props: Record<string, unknown>;
  component?: string | undefined;
  exportName?: string | undefined;
  fontFamily?: string | undefined;
  /** Use the dedicated safe-zone feature-graphic template. */
  feature?: boolean | undefined;
}

/** Compose one frame with Takumi. Returns encoded PNG bytes. */
export async function renderFrame(options: FrameRenderOptions): Promise<Buffer> {
  let Component: FrameComponent;
  if (options.feature) Component = DefaultFeatureGraphic as unknown as FrameComponent;
  else if (options.component)
    Component = await loadFrameComponent(options.component, options.exportName);
  else Component = DefaultFrame as unknown as FrameComponent;

  const fontName = options.fontFamily ?? "Inter";
  const fonts = await googleFonts([{ name: fontName, weight: [400, 500, 600, 700] }] as Parameters<
    typeof googleFonts
  >[0]);

  const bytes = await render(createElement(Component, options.props), {
    width: options.width,
    height: options.height,
    fonts,
  });
  return Buffer.from(bytes);
}

import { createJiti } from "jiti";
import { join, resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import { render } from "takumi-js";
import { googleFonts } from "takumi-js/helpers";

import { DefaultOgImage } from "./default-og";
import type { GeneratedFile, OgFont, OgImageOptions } from "./types";
import { compact, svgToDataUrl, writeFile } from "./utils";

/** Any React component that can receive the injected OG props. */
export type OgComponent = ComponentType<Record<string, unknown>>;

const defaultFonts: OgFont[] = [{ name: "Inter", weight: [400, 600, 700] }];

/**
 * Load a React component from a `.ts`/`.tsx` file at runtime. Jiti handles the
 * TypeScript/JSX transform, so the component does not need a build step.
 */
export async function loadOgComponent(
  componentPath: string,
  exportName?: string,
): Promise<OgComponent> {
  const jiti = createJiti(import.meta.url, {
    jsx: { runtime: "automatic", importSource: "react" },
    interopDefault: true,
  });
  const module = await jiti.import<Record<string, unknown>>(resolve(componentPath));
  const candidates = exportName
    ? [module[exportName]]
    : [module.default, module.OgImage, module.Og, module.Image];
  // `interopDefault` can set `default` to the whole namespace object, so pick
  // the first candidate that is actually callable.
  const candidate = candidates.find((entry) => typeof entry === "function");

  if (candidate === undefined) {
    const exports = Object.keys(module).join(", ") || "(none)";
    throw new Error(
      `No React component found in ${componentPath} (exports: ${exports}). ` +
        "Use a default export or pass an explicit export name.",
    );
  }
  return candidate as OgComponent;
}

export interface OgRenderResult {
  buffer: Uint8Array;
  file: GeneratedFile;
}

/** Render an OG image with Takumi and write it to disk. */
export async function renderOgImage(
  options: OgImageOptions & { outDir?: string },
): Promise<OgRenderResult> {
  const Component = options.component
    ? await loadOgComponent(options.component, options.exportName)
    : (DefaultOgImage as unknown as OgComponent);

  const iconDataUrl = options.icon ? svgToDataUrl(resolve(options.icon)) : undefined;
  const fonts = await googleFonts(
    (options.fonts ?? defaultFonts) as Parameters<typeof googleFonts>[0],
  );

  const buffer = await render(
    createElement(
      Component,
      compact({
        title: options.title,
        description: options.description,
        siteLabel: options.siteLabel,
        iconDataUrl,
        ...options.props,
      }),
    ),
    {
      width: options.width ?? 1200,
      height: options.height ?? 630,
      fonts,
    },
  );

  const outFile = resolve(
    options.outFile ?? join(resolve(options.outDir ?? process.cwd()), "og.png"),
  );
  return { buffer, file: writeFile(outFile, buffer) };
}

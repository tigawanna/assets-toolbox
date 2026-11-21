import { join, resolve } from "node:path";

import { generateIconSet } from "./icons";
import { generateManifest } from "./manifest";
import { renderOgImage } from "./og";
import type {
  BrandAssetsOptions,
  BrandAssetsResult,
  GeneratedFile,
  IconSetOptions,
  OgImageOptions,
} from "./types";
import { compact } from "./utils";

/**
 * One-shot entry point: generate the icon set from `icon`, and optionally an
 * OG image and web manifest, all into the same output directory.
 */
export async function generateBrandAssets(options: BrandAssetsOptions): Promise<BrandAssetsResult> {
  const outDir = resolve(options.outDir ?? process.cwd());

  const icons = await generateIconSet(
    compact({
      icon: options.icon,
      outDir,
      plate: options.plate,
      sizes: options.sizes,
      copySvg: options.copySvg,
    }) as IconSetOptions,
  );

  let og: GeneratedFile | undefined;
  if (options.og) {
    const ogOptions = options.og;
    const result = await renderOgImage(
      compact({
        ...ogOptions,
        icon: ogOptions.icon ?? options.icon,
        outDir,
        outFile: ogOptions.outFile ?? join(outDir, "og.png"),
      }) as OgImageOptions & { outDir: string },
    );
    og = result.file;
  }

  let manifest: GeneratedFile | undefined;
  if (options.manifest) {
    manifest = generateManifest({
      ...options.manifest,
      outFile: options.manifest.outFile ?? join(outDir, "site.webmanifest"),
    });
  }

  return compact({ outDir, icons, og, manifest }) as BrandAssetsResult;
}

import { join, resolve } from "node:path";

import type { GeneratedFile, ManifestOptions } from "./types";
import { writeFile } from "./utils";

/** Emit a `site.webmanifest` that references the generated manifest icons. */
export function generateManifest(options: ManifestOptions = {}): GeneratedFile {
  const name = options.name ?? "App";
  const themeColor = options.themeColor ?? "#0f100f";
  const manifest = {
    name,
    short_name: options.shortName ?? name,
    start_url: options.startUrl ?? "/",
    display: options.display ?? "standalone",
    background_color: options.backgroundColor ?? themeColor,
    theme_color: themeColor,
    icons: [
      {
        src: "web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  const outFile = resolve(options.outFile ?? join(process.cwd(), "site.webmanifest"));
  return writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

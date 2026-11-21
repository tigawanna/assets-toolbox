import { resolve } from "node:path";

import { createJiti } from "jiti";

import type { PlayScreenshotOptions } from "./types";

/**
 * Load a `play-screenshots.config.ts` file with jiti. The file may default-export
 * the options object, or export it as `config` / `playScreenshots`.
 */
export async function loadConfigFile(path: string): Promise<PlayScreenshotOptions> {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const module = await jiti.import<Record<string, unknown>>(resolve(path));
  const data = module.default ?? module.config ?? module.playScreenshots ?? module;
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { shots?: unknown }).shots)
  ) {
    throw new Error(`${path} must export an options object with a \`shots\` array.`);
  }
  return data as PlayScreenshotOptions;
}

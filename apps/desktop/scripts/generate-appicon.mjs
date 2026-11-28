import { mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(join(root, "package.json"));

let sharp;
try {
  sharp = require("sharp");
} catch {
  const pnpmStore = join(root, "node_modules", ".pnpm");
  const sharpPackage = readdirSync(pnpmStore).find((entry) => entry.startsWith("sharp@"));
  if (!sharpPackage) throw new Error("sharp is required to generate the Wails app icon");
  sharp = require(join(pnpmStore, sharpPackage, "node_modules", "sharp"));
}

const appDir = join(root, "apps", "desktop");
const output = join(appDir, "build", "appicon.png");
mkdirSync(dirname(output), { recursive: true });
await sharp(join(appDir, "appicon.svg"))
  .resize(512, 512, { fit: "contain", background: "#00000000" })
  .png()
  .toFile(output);
console.log("Wrote apps/desktop/build/appicon.png");

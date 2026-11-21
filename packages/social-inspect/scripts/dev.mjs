import { resolve } from "node:path";
import { createServer } from "vite";

const appRoot = resolve(process.cwd(), "app");
const server = await createServer({
  root: appRoot,
  configFile: resolve(appRoot, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4310 },
  clearScreen: false,
});
await server.listen();
console.log(`Social Inspect (dev) → ${server.resolvedUrls?.local?.[0]}`);

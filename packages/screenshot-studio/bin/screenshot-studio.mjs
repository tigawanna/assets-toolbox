#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
let port = process.env.PORT ?? "4320";
let host = process.env.HOST ?? "127.0.0.1";
let shouldOpen = true;

for (let index = 0; index < args.length; index += 1) {
  const token = args[index] ?? "";
  if (token === "--help" || token === "-h") {
    console.log(`screenshot-studio — local canvas for store screenshots

Usage:
  screenshot-studio [--port 4320] [--host 127.0.0.1] [--no-open]

The published package starts the built TanStack Start Node server.
During development, run pnpm dev instead.
`);
    process.exit(0);
  } else if (token === "--no-open") {
    shouldOpen = false;
  } else if (token === "--port" || token === "-p") {
    port = args[++index] ?? port;
  } else if (token === "--host") {
    host = args[++index] ?? host;
  }
}

const server = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".output",
  "server",
  "index.mjs",
);
if (!existsSync(server)) {
  console.error("Screenshot Studio has not been built. From the package, run: pnpm build");
  process.exit(1);
}

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOST: host },
});

if (shouldOpen) {
  const url = `http://${host}:${port}`;
  setTimeout(() => {
    import("open")
      .then((mod) => mod.default(url))
      .catch(() => {
        console.log(`Open ${url}`);
      });
  }, 700);
}

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

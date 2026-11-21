#!/usr/bin/env node
import open from "open";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export interface CliArgs {
  url?: string | undefined;
  port?: number | undefined;
  host?: string | undefined;
  open: boolean;
  help: boolean;
}

/** Parse the small set of flags the CLI understands. */
export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { open: true, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--no-open") {
      args.open = false;
    } else if (token === "--url" || token === "-u") {
      args.url = argv[++index];
    } else if (token === "--port" || token === "-p") {
      const parsed = Number(argv[++index]);
      if (Number.isFinite(parsed)) args.port = parsed;
    } else if (token === "--host") {
      args.host = argv[++index];
    } else if (!token.startsWith("-") && args.url === undefined) {
      args.url = token;
    }
  }
  return args;
}

function help(): string {
  return `social-inspect — local Open Graph & social preview inspector

Usage:
  social-inspect [url] [options]

Options:
  -u, --url <url>    URL to inspect on startup (local or remote).
  -p, --port <n>     Preferred port. Default 4310.
      --host <host>  Host to bind. Default 127.0.0.1.
      --no-open      Don't open a browser window.
  -h, --help         Show this help.

Examples:
  npx @tigawanna/social-inspect
  npx @tigawanna/social-inspect https://cravfted.vercel.app
  npx @tigawanna/social-inspect http://localhost:3000 --port 4310
`;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(help());
    return;
  }

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const appRoot = join(packageRoot, "app");

  const server = await createServer({
    root: appRoot,
    configFile: join(appRoot, "vite.config.ts"),
    server: {
      host: args.host ?? "127.0.0.1",
      port: args.port ?? 4310,
      strictPort: false,
    },
    clearScreen: false,
  });

  await server.listen();

  const address = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${args.port ?? 4310}`;
  const target = args.url ? `${address}?url=${encodeURIComponent(args.url)}` : address;

  console.log(`\n  Social Inspect ready at ${address}`);
  if (args.url) console.log(`  Inspecting: ${args.url}`);
  console.log("  Press Ctrl+C to stop.\n");

  if (args.open) {
    try {
      await open(target);
    } catch {
      console.log(`  Could not open a browser. Visit ${target}`);
    }
  }

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

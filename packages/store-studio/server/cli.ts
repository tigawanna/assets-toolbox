#!/usr/bin/env node
import { exec } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";

import { decodeLog, isEventRecord, replayLog } from "../src/model/events";
import { renderHeadless } from "./render";
import { createServer } from "./server";

export interface StudioCliArgs {
  projectDir: string;
  port: number;
  open: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): StudioCliArgs {
  const args: StudioCliArgs = {
    projectDir: "store/studio",
    port: 5177,
    open: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--open" || token === "-o") args.open = true;
    else if (token === "--port" || token === "-p") args.port = Number(argv[++index] ?? 5177);
    else if (token.startsWith("--port=")) args.port = Number(token.slice(7));
    else if (!token.startsWith("-")) args.projectDir = token;
  }
  return args;
}

function help(): string {
  return `store-studio — local screenshot editor for Play and the App Store

Usage:
  store-studio [projectDir] [--port 5177] [--open]
  store-studio render <project.json> [--board phone] [--port 0]
  store-studio replay <events.jsonl> [--out project.json] [--verify project.json]

Commands:
  render       Render slices headlessly with Playwright and write them to disk.
  replay       Rebuild project.json from a portable edit log.

  projectDir  Directory holding project.json (created if missing).
              Default: store/studio
  --board     Board kind or id to render. Default: the first board.
  --port      HTTP port. Default 5177 (0 picks a free port for render).
  --open      Open the editor in your default browser.
  -h, --help  Show this help.
`;
}

function appDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "app");
}

async function renderCommand(argv: string[]): Promise<void> {
  let projectFile = "store/studio/project.json";
  let board = "";
  let port = 0;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--board") board = argv[++index] ?? "";
    else if (token.startsWith("--board=")) board = token.slice(8);
    else if (token === "--port") port = Number(argv[++index] ?? 0);
    else if (token.startsWith("--port=")) port = Number(token.slice(7));
    else if (token === "--help" || token === "-h") {
      console.log(help());
      return;
    } else if (!token.startsWith("-")) projectFile = token;
  }
  const file = resolve(projectFile);
  const app = createServer({ projectDir: dirname(file), appDir: appDirectory() });
  const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
  const address = server.address();
  const activePort = typeof address === "object" && address !== null ? address.port : port;
  try {
    const report = await renderHeadless({ port: activePort, board });
    for (const item of report.files)
      console.log(`wrote ${item.path} (${item.width}×${item.height}, ${item.bytes} bytes)`);
    for (const warning of report.warnings) console.warn(`warning: ${warning}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode ?? 0);
  }
}

async function replayCommand(argv: string[]): Promise<void> {
  let logFile: string | undefined;
  let outFile: string | undefined;
  let verifyFile: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") outFile = argv[++index];
    else if (token.startsWith("--out=")) outFile = token.slice(6);
    else if (token === "--verify") verifyFile = argv[++index];
    else if (token.startsWith("--verify=")) verifyFile = token.slice(9);
    else if (token === "--help" || token === "-h") {
      console.log(help());
      return;
    } else if (!token.startsWith("-")) logFile = token;
  }
  if (logFile === undefined) throw new Error("replay needs a events.jsonl path");
  const file = resolve(logFile);
  const log = decodeLog(readFileSync(file, "utf8"));
  const project = replayLog(log);
  const count = log.records.filter(isEventRecord).length;
  const destination = resolve(outFile ?? resolve(dirname(file), "project.replayed.json"));
  writeFileSync(destination, `${JSON.stringify(project, null, 2)}\n`);
  console.log(`Replayed ${count} events → ${destination}`);
  if (verifyFile !== undefined) {
    const expected = JSON.parse(readFileSync(resolve(verifyFile), "utf8")) as unknown;
    const matches = JSON.stringify(expected) === JSON.stringify(project);
    console.log(
      matches
        ? "Verified: replay matches the project file."
        : "Verified: replay DIFFERS from the project file.",
    );
    if (!matches) process.exitCode = 1;
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv[0] === "render") {
    await renderCommand(argv.slice(1));
    return;
  }
  if (argv[0] === "replay") {
    await replayCommand(argv.slice(1));
    return;
  }
  const args = parseCliArgs(argv);
  if (args.help) {
    console.log(help());
    return;
  }
  const app = createServer({ projectDir: args.projectDir, appDir: appDirectory() });
  const server = serve({ fetch: app.fetch, port: args.port, hostname: "127.0.0.1" });
  const url = `http://127.0.0.1:${args.port}/`;
  console.log(`Store Studio → ${url}`);
  console.log(`Project: ${resolve(args.projectDir)}`);
  if (args.open) {
    let command = "xdg-open";
    if (process.platform === "darwin") command = "open";
    else if (process.platform === "win32") command = "start";
    exec(`${command} ${JSON.stringify(url)}`, () => {});
  }
  const shutdown = () => {
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

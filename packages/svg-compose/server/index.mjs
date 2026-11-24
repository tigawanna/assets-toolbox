import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { createWorkspaceApi } from "./api.mjs";

const root = resolve(process.cwd(), "dist");
const api = createWorkspaceApi();
const port = Number(process.env.PORT ?? 4330);
const host = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

async function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }
  let file = candidate;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(root, "index.html");
  }
  try {
    const body = await readFile(file);
    response.statusCode = 200;
    response.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end("Not found — run `vp build` first.");
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);
  await api(request, response, () => serveStatic(request, response, url));
}).listen(port, host, () => {
  console.log(`SVG Compose: http://${host}:${port}`);
  console.log(`Node workspace: ${process.env.SVG_COMPOSE_DATA ?? ".svg-compose/workspace.sqlite"}`);
});

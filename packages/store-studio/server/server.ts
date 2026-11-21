import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import sharp from "sharp";

import { appendEvent, readEvents } from "./events";
import { clearSlices, finishExport, storeSlice } from "./export";
import { projectPaths, readProject, safePath, writeProject } from "./project-io";
import { createEventBus, watchProject, type EventBus } from "./watch";
import { StudioProjectSchema } from "../src/model/schema";
import type { ExportRequest } from "../src/data-access-layer/host/types";

export interface ServerOptions {
  projectDir: string;
  appDir: string;
  bus?: EventBus;
}

function mimeType(ext: string): string {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "image/png";
}

function safeFileName(name: string): string {
  const base = basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base === "" || base === "." || base === ".." ? `asset-${Date.now()}.png` : base;
}

export function createServer(options: ServerOptions): Hono {
  const app = new Hono();
  const paths = projectPaths(options.projectDir);
  const bus = options.bus ?? createEventBus();
  mkdirSync(paths.assets, { recursive: true });
  let stopWatching: (() => void) | undefined;

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  });

  app.get("/api/project", (c) => c.json(readProject(paths)));
  app.put("/api/project", async (c) => {
    const body = await c.req.json();
    const parsed = writeProject(paths, StudioProjectSchema.parse(body));
    bus.publish({ type: "project-changed" });
    return c.json(parsed);
  });

  app.post("/api/assets", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
    const name = safeFileName(file.name);
    const destination = safePath(paths.root, `assets/${name}`);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    writeFileSync(destination, Buffer.from(await file.arrayBuffer()));
    const meta = await sharp(destination).metadata();
    const id = name;
    const url = `/api/assets/${encodeURIComponent(name)}`;
    bus.publish({ type: "assets-changed", file: name });
    return c.json({
      id,
      file: name,
      url,
      width: meta.width ?? 1080,
      height: meta.height ?? 1920,
      kind: "screenshot",
      intrinsic: { width: meta.width ?? 1080, height: meta.height ?? 1920 },
    });
  });

  app.get("/api/assets/:file", (c) => {
    const file = safePath(paths.root, `assets/${c.req.param("file")}`);
    try {
      const bytes = readFileSync(file);
      const ext = extname(file).toLowerCase();
      const type = mimeType(ext);
      return new Response(bytes, {
        headers: { "content-type": type, "cache-control": "no-store" },
      });
    } catch {
      return c.notFound();
    }
  });

  app.get("/api/events-log", (c) => c.json({ log: readEvents(paths.root) }));
  app.post("/api/events-log", async (c) => {
    const input = await c.req.json();
    return c.json(appendEvent(paths.root, input));
  });

  app.post("/api/export/slice", async (c) => {
    const body = await c.req.parseBody();
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const index = Number(body.index ?? -1);
    const png = body.png;
    if (boardId === "" || index < 0 || !(png instanceof File)) {
      return c.json({ error: "boardId, index and png are required" }, 400);
    }
    storeSlice(boardId, index, Buffer.from(await png.arrayBuffer()));
    return c.json({ ok: true });
  });

  app.post("/api/export/finish", async (c) => {
    const request = (await c.req.json()) as ExportRequest;
    const report = await finishExport(paths, request);
    clearSlices();
    return c.json(report);
  });

  app.get("/api/events", (c) =>
    stream(c, async (writer) => {
      const unsubscribe = bus.subscribe((event) => {
        void writer.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      writer.onAbort(unsubscribe);
      await writer.write(`event: message\ndata: {"type":"connected"}\n\n`);
      await new Promise<void>(() => {
        // Keep the stream open until the client disconnects.
      });
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, projectDir: paths.root }));

  app.use("/assets/*", serveStatic({ root: options.appDir }));
  app.get("/", serveStatic({ root: options.appDir, path: "index.html" }));
  app.get("/*", serveStatic({ root: options.appDir, path: "index.html" }));

  stopWatching = watchProject(paths, bus);
  app.delete("/__stop", (c) => {
    stopWatching?.();
    return c.json({ ok: true });
  });

  return app;
}

import { loadWorkspace, saveWorkspace } from "./storage.mjs";

const MAX_BODY = 8 * 1024 * 1024;

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Request body exceeds 8 MB"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

/** Connect-style middleware for Vite dev, Vite preview, and the Node server. */
export function createWorkspaceApi(options = {}) {
  return async (request, response, next) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/workspace") {
      await next?.();
      return;
    }
    try {
      if (request.method === "GET") {
        json(response, 200, { document: loadWorkspace(options.databasePath) });
        return;
      }
      if (request.method === "PUT" || request.method === "POST") {
        const raw = await readBody(request);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          json(response, 400, { error: "Invalid JSON" });
          return;
        }
        const document = saveWorkspace(parsed, options.databasePath);
        json(response, 200, { document });
        return;
      }
      json(response, 405, { error: "Method not allowed" });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : "Save failed" });
    }
  };
}

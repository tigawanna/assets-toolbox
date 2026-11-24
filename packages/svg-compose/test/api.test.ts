// @vitest-environment node
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createWorkspaceApi } from "../server/api.mjs";
import { closeWorkspace } from "../server/storage.mjs";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

const start = async (databasePath: string) => {
  const server = createServer(createWorkspaceApi({ databasePath }));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}/api/workspace`;
};

describe("workspace API", () => {
  it("GET, PUT, POST, invalid JSON and method errors", async () => {
    const folder = mkdtempSync(join(tmpdir(), "svg-compose-api-"));
    const path = join(folder, "workspace.sqlite");
    const url = await start(path);
    try {
      const empty = await fetch(url).then((response) => response.json());
      expect(empty.document).toBeNull();

      const payload = {
        name: "API",
        svg: '<g id="api"><rect width="4" height="4"/></g>',
        viewport: { zoom: 2, tx: 3, ty: 4 },
      };
      const savedResponse = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(savedResponse.status).toBe(200);
      const saved = await savedResponse.json();
      expect(saved.document).toMatchObject(payload);

      const loaded = await fetch(url).then((response) => response.json());
      expect(loaded.document.svg).toBe(payload.svg);

      const posted = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ ...payload, svg: "<circle/>" }),
      });
      expect(posted.status).toBe(200);

      const invalid = await fetch(url, { method: "PUT", body: "not json" });
      expect(invalid.status).toBe(400);

      const method = await fetch(url, { method: "DELETE" });
      expect(method.status).toBe(405);
    } finally {
      closeWorkspace(path);
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

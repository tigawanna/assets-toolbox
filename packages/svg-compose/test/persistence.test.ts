import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  loadWorkspaceFromLocal,
  loadWorkspaceFromServer,
  newestWorkspace,
  saveWorkspaceToLocal,
  saveWorkspaceToServer,
} from "../src/lib/persistence";

const sample = {
  name: "Untitled",
  svg: '<g id="a"><rect width="10" height="10"/></g>',
  viewport: { zoom: 1.5, tx: 20, ty: -5 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("workspace persistence", () => {
  it("stores a browser backup when Node is unavailable", () => {
    const saved = saveWorkspaceToLocal(sample);
    expect(saved.id).toBe("local");
    expect(loadWorkspaceFromLocal()).toEqual(saved);
  });

  it("chooses the newer of the server and browser copies", () => {
    const server = { ...sample, id: "draft", updatedAt: "2026-11-24T10:00:00.000Z" };
    const local = { ...sample, id: "local", updatedAt: "2026-11-24T11:00:00.000Z" };
    expect(newestWorkspace(server, local)).toBe(local);
    expect(newestWorkspace(server, null)).toBe(server);
  });

  it("loads and saves through the Node API", async () => {
    const document = { ...sample, id: "draft", updatedAt: "2026-11-24T10:00:00.000Z" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ document }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ document }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadWorkspaceFromServer()).toEqual(document);
    expect(await saveWorkspaceToServer(sample)).toEqual(document);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("survives malformed local data", () => {
    localStorage.setItem("svg-compose:workspace:v1", "not json");
    expect(loadWorkspaceFromLocal()).toBeNull();
  });
});

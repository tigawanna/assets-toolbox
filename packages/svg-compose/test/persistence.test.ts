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

const saved = { ...sample, id: "draft", updatedAt: "2026-11-24T10:00:00.000Z" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("workspace persistence", () => {
  it("stores a browser backup when Node is unavailable", () => {
    const local = saveWorkspaceToLocal(sample);
    expect(local?.id).toBe("local");
    expect(loadWorkspaceFromLocal()).toEqual(local);
  });

  it("preserves a server timestamp when mirroring a saved document", () => {
    const local = saveWorkspaceToLocal(sample, { updatedAt: saved.updatedAt });
    expect(local?.updatedAt).toBe(saved.updatedAt);
    expect(loadWorkspaceFromLocal()).toEqual(local);
  });

  it("isolates browser backups by native workspace", () => {
    const first = saveWorkspaceToLocal(sample, { workspaceId: "first" });
    const second = saveWorkspaceToLocal({ ...sample, svg: "<rect/>" }, { workspaceId: "second" });

    expect(loadWorkspaceFromLocal("first")).toEqual(first);
    expect(loadWorkspaceFromLocal("second")).toEqual(second);
    expect(loadWorkspaceFromLocal()).toBeNull();
    expect(first?.svg).not.toBe(second?.svg);
  });

  it("reports when the browser fallback cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(saveWorkspaceToLocal(sample)).toBeNull();
  });

  it("chooses the newer of the server and browser copies", () => {
    const local = { ...sample, id: "local", updatedAt: "2026-11-24T11:00:00.000Z" };
    expect(newestWorkspace(saved, local)).toBe(local);
    expect(newestWorkspace(saved, null)).toBe(saved);
  });

  it("prefers native Wails bindings over the HTTP API", async () => {
    const fetchMock = vi.fn();
    const LoadWorkspace = vi.fn().mockResolvedValue(saved);
    const SaveWorkspace = vi.fn().mockResolvedValue(saved);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("go", { main: { App: { LoadWorkspace, SaveWorkspace } } });

    expect(await loadWorkspaceFromServer()).toEqual(saved);
    expect(await saveWorkspaceToServer(sample)).toEqual(saved);
    expect(SaveWorkspace).toHaveBeenCalledWith({ ...sample, id: "draft", updatedAt: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid native document instead of silently losing the save", async () => {
    vi.stubGlobal("go", {
      main: { App: { SaveWorkspace: vi.fn().mockResolvedValue({ ...saved, viewport: null }) } },
    });

    await expect(saveWorkspaceToServer(sample)).rejects.toThrow("invalid document");
  });

  it("loads and saves through the Node API when native bindings are absent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ document: saved }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ document: saved }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadWorkspaceFromServer()).toEqual(saved);
    expect(await saveWorkspaceToServer(sample)).toEqual(saved);
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

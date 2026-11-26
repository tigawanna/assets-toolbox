// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  loadWorkspaceFromLocal,
  loadWorkspaceFromServer,
  saveWorkspaceToLocal,
  saveWorkspaceToServer,
} from "./persistence";

const sample = {
  name: "Untitled",
  svg: '<g id="n1"><rect width="10" height="10"/></g>',
  viewport: { zoom: 1, tx: 0, ty: 0 },
};

const saved = { ...sample, id: "draft", updatedAt: "2026-11-26T10:00:00.000Z" };

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("desktop workspace persistence", () => {
  it("uses native bindings when Vite does not provide the HTTP API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("go", {
      main: {
        App: {
          LoadWorkspace: vi.fn().mockResolvedValue(saved),
          SaveWorkspace: vi.fn().mockResolvedValue(saved),
        },
      },
    });

    expect(await loadWorkspaceFromServer()).toEqual(saved);
    expect(await saveWorkspaceToServer(sample)).toEqual(saved);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("isolates browser fallback data by native workspace", () => {
    const first = saveWorkspaceToLocal(sample, { workspaceId: "first" });
    const second = saveWorkspaceToLocal({ ...sample, svg: "<rect/>" }, { workspaceId: "second" });

    expect(loadWorkspaceFromLocal("first")).toEqual(first);
    expect(loadWorkspaceFromLocal("second")).toEqual(second);
    expect(loadWorkspaceFromLocal("first")?.svg).not.toBe(loadWorkspaceFromLocal("second")?.svg);
  });

  it("reports when the browser fallback cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(saveWorkspaceToLocal(sample)).toBeNull();
  });
});

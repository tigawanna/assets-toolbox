import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { completeDesktopFlush, getWorkspaceId, onDesktopFlush } from "../src/lib/desktop";

const runtimeWindow = window as Window & { runtime?: unknown; go?: unknown };

afterEach(() => {
  delete runtimeWindow.runtime;
  delete runtimeWindow.go;
});

describe("desktop flush bridge", () => {
  it("is a no-op in the browser", () => {
    delete runtimeWindow.runtime;
    const callback = vi.fn();
    expect(onDesktopFlush(callback)).toBeUndefined();
    expect(() => completeDesktopFlush()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("subscribes and acknowledges through the Wails runtime", () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const eventsOn = vi.fn(() => unsubscribe);
    const eventsEmit = vi.fn();
    runtimeWindow.runtime = { EventsOn: eventsOn, EventsEmit: eventsEmit };

    expect(onDesktopFlush(callback)).toBe(unsubscribe);
    expect(eventsOn).toHaveBeenCalledWith("workspace:flush", callback);
    callback(9);
    expect(callback).toHaveBeenCalledWith(9);

    completeDesktopFlush(false, 9);
    expect(eventsEmit).toHaveBeenCalledWith("workspace:flushed", false, 9);
  });

  it("reads the native workspace id and falls back safely", async () => {
    expect(await getWorkspaceId()).toBe("");
    const WorkspaceID = vi.fn().mockResolvedValue("workspace-a");
    runtimeWindow.go = { main: { App: { WorkspaceID } } };
    expect(await getWorkspaceId()).toBe("workspace-a");

    WorkspaceID.mockRejectedValueOnce(new Error("bridge unavailable"));
    expect(await getWorkspaceId()).toBe("");
  });
});

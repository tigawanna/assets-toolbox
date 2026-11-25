import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { completeDesktopFlush, onDesktopFlush } from "../src/lib/desktop";

const runtimeWindow = window as Window & { runtime?: unknown };

afterEach(() => {
  delete runtimeWindow.runtime;
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

    completeDesktopFlush();
    expect(eventsEmit).toHaveBeenCalledWith("workspace:flushed");
  });
});

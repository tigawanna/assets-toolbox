// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { completeDesktopFlush, onDesktopFlush, setDesktopModuleActive } from "./desktop";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop flush events", () => {
  it("echoes the request ID and reports the durable write result", () => {
    const EventsOn = vi.fn(() => () => {});
    const EventsEmit = vi.fn();
    vi.stubGlobal("runtime", { EventsOn, EventsEmit });

    const callback = vi.fn();
    const unsubscribe = onDesktopFlush("studio", callback);
    expect(EventsOn).toHaveBeenCalledWith("studio:flush", callback);

    completeDesktopFlush("studio", false, 42);
    expect(EventsEmit).toHaveBeenCalledWith("studio:flushed", false, 42);

    setDesktopModuleActive("studio", true);
    expect(EventsEmit).toHaveBeenCalledWith("studio:active");
    unsubscribe?.();
  });
});

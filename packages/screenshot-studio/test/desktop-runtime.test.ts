// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  completeDesktopFlush,
  onDesktopFlush,
  setDesktopModuleActive,
} from "../src/desktop/runtime";

const runtimeWindow = window as Window & { runtime?: unknown };

afterEach(() => {
  delete runtimeWindow.runtime;
});

describe("desktop runtime bridge", () => {
  it("is a no-op in a standalone browser", () => {
    const callback = vi.fn();
    expect(onDesktopFlush("studio", callback)).toBeUndefined();
    expect(() => completeDesktopFlush("studio")).not.toThrow();
    expect(() => setDesktopModuleActive("studio", true)).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("subscribes, acknowledges, and reports module activity through Wails", () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const EventsOn = vi.fn(() => unsubscribe);
    const EventsEmit = vi.fn();
    runtimeWindow.runtime = { EventsOn, EventsEmit };

    expect(onDesktopFlush("studio", callback)).toBe(unsubscribe);
    expect(EventsOn).toHaveBeenCalledWith("studio:flush", callback);
    completeDesktopFlush("studio", false, 7);
    setDesktopModuleActive("studio", true);
    expect(EventsEmit).toHaveBeenCalledWith("studio:flushed", false, 7);
    expect(EventsEmit).toHaveBeenCalledWith("studio:active");
  });
});

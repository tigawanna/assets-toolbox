// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  currentTheme,
  DESKTOP_THEME_CHANGE_EVENT,
  DESKTOP_THEME_STORAGE_KEY,
  setTheme,
  THEME_STORAGE_KEY,
} from "../src/lib/theme";

afterEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
});

describe("Studio theme bridge", () => {
  it("reads both the shell data attribute and the standalone dark class", () => {
    document.documentElement.dataset.theme = "dark";
    expect(currentTheme()).toBe("dark");
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.add("dark");
    expect(currentTheme()).toBe("dark");
  });

  it("keeps shell and standalone theme state in sync", () => {
    const shellListener = vi.fn();
    window.addEventListener(DESKTOP_THEME_CHANGE_EVENT, shellListener);
    try {
      setTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(localStorage.getItem(DESKTOP_THEME_STORAGE_KEY)).toBe("dark");
      expect(shellListener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(DESKTOP_THEME_CHANGE_EVENT, shellListener);
    }
  });
});

import { beforeEach, describe, expect, it } from "vite-plus/test";

import { applyThemeStorageEvent, setTheme, toggleTheme } from "./theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
  document.documentElement.classList.remove("dark");
});

describe("desktop theme", () => {
  it("applies and persists both shell and Studio dark selectors", () => {
    setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("dark");

    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("light");
  });

  it("applies matching cross-tab theme changes only", () => {
    expect(
      applyThemeStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-theme", newValue: "dark" }),
      ),
    ).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");

    expect(
      applyThemeStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-sidebar", newValue: "light" }),
      ),
    ).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

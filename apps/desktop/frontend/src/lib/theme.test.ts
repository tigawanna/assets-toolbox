import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  applyCustomTheme,
  applyThemeStorageEvent,
  clampScale,
  isSystemDefault,
  nextTheme,
  resetAppearance,
  resolveTheme,
  setAccent,
  setBackground,
  setTextColor,
  setTextScale,
  setTheme,
  setThemeMode,
  setUiScale,
  toggleTheme,
} from "./theme";

beforeEach(() => {
  localStorage.clear();
  resetAppearance();
  document.documentElement.dataset.theme = "light";
  document.documentElement.classList.remove("dark");
  document.documentElement.style.removeProperty("--ui-scale");
  document.documentElement.style.removeProperty("--text-scale");
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--canvas");
  document.documentElement.style.removeProperty("--text");
  document.documentElement.removeAttribute("data-custom-bg");
  document.documentElement.removeAttribute("data-custom-text");
});

describe("desktop theme", () => {
  it("applies and persists both shell and Studio dark selectors", () => {
    setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("dark");

    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("black");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("light");
  });

  it("cycles light, dark and pitch black in order", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("black");
    expect(nextTheme("black")).toBe("light");

    setThemeMode("black");
    expect(document.documentElement.dataset.theme).toBe("black");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("black");
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

  it("treats a missing or invalid preference as the system theme", () => {
    setThemeMode("system");
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("system");
    // jsdom's matchMedia mock reports a light OS preference.
    expect(resolveTheme()).toBe("light");

    setThemeMode("dark");
    expect(
      applyThemeStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-theme", newValue: null }),
      ),
    ).toBe(true);
    expect(resolveTheme()).toBe("light");
  });

  it("resolves the system theme from the OS preference", () => {
    const base = {
      activeThemeId: null,
      uiScale: 1,
      textScale: 1,
      accent: null,
      background: null,
      text: null,
    };
    expect(resolveTheme({ ...base, mode: "system", systemDark: true })).toBe("dark");
    expect(resolveTheme({ ...base, mode: "light", systemDark: true })).toBe("light");
    expect(resolveTheme({ ...base, mode: "black", systemDark: false })).toBe("black");
  });
});

describe("desktop appearance scales", () => {
  it("applies and persists both scales independently", () => {
    setUiScale(1.25);
    setTextScale(1.1);

    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.25");
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1.1");
    expect(localStorage.getItem("assets-toolbox-ui-scale")).toBe("1.25");
    expect(localStorage.getItem("assets-toolbox-text-scale")).toBe("1.1");

    setUiScale(0.9);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("0.9");
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1.1");
  });

  it("clamps out-of-range and invalid values", () => {
    expect(clampScale(9)).toBe(1.5);
    expect(clampScale(-4)).toBe(0.8);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(1.234)).toBe(1.23);

    setTextScale(50);
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1.5");
  });

  it("applies scale changes from another tab", () => {
    expect(
      applyThemeStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-ui-scale", newValue: "1.35" }),
      ),
    ).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.35");
  });

  it("resets theme and both scales to system defaults", () => {
    setThemeMode("dark");
    setUiScale(1.4);
    setTextScale(0.85);
    setAccent("#6366f1");
    setBackground("#101010");
    setTextColor("#fafafa");
    expect(isSystemDefault()).toBe(false);

    resetAppearance();

    expect(isSystemDefault()).toBe(true);
    expect(resolveTheme()).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1");
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(localStorage.getItem("assets-toolbox-theme")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-ui-scale")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-text-scale")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-accent")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-background")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-text")).toBeNull();
  });
});

describe("desktop accent color", () => {
  it("applies and persists a custom primary color", () => {
    setAccent("#6366f1");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#6366f1");
    expect(localStorage.getItem("assets-toolbox-accent")).toBe("#6366f1");

    setAccent("#0d9488");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#0d9488");
  });

  it("restores the theme default when cleared", () => {
    setAccent("#e11d48");
    setAccent(null);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(localStorage.getItem("assets-toolbox-accent")).toBeNull();
  });

  it("ignores invalid colors and applies cross-tab changes", () => {
    setAccent("not-a-color");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");

    expect(
      applyThemeStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-accent", newValue: "#65a30d" }),
      ),
    ).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#65a30d");
  });
});

describe("desktop background and text colors", () => {
  it("applies and persists a custom background and text color", () => {
    setBackground("#101010");
    setTextColor("#fef08a");

    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("#101010");
    expect(document.documentElement.style.getPropertyValue("--text")).toBe("#fef08a");
    expect(document.documentElement.hasAttribute("data-custom-bg")).toBe(true);
    expect(document.documentElement.hasAttribute("data-custom-text")).toBe(true);
    expect(localStorage.getItem("assets-toolbox-background")).toBe("#101010");
    expect(localStorage.getItem("assets-toolbox-text")).toBe("#fef08a");
  });

  it("restores theme defaults when cleared", () => {
    setBackground("#101010");
    setTextColor("#fef08a");
    setBackground(null);
    setTextColor(null);

    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--text")).toBe("");
    expect(document.documentElement.hasAttribute("data-custom-bg")).toBe(false);
    expect(document.documentElement.hasAttribute("data-custom-text")).toBe(false);
    expect(localStorage.getItem("assets-toolbox-background")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-text")).toBeNull();
  });
});

describe("desktop custom themes", () => {
  const forest = {
    id: "forest",
    name: "Forest",
    background: "#10241a",
    accent: "#4ade80",
    text: "#e8f5e9",
  };

  it("applies every colour of a saved theme at once", () => {
    applyCustomTheme(forest);

    expect(localStorage.getItem("assets-toolbox-theme")).toBe("custom");
    expect(localStorage.getItem("assets-toolbox-active-theme")).toBe("forest");
    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("#10241a");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#4ade80");
    expect(document.documentElement.style.getPropertyValue("--text")).toBe("#e8f5e9");
    expect(document.documentElement.hasAttribute("data-custom-bg")).toBe(true);
    expect(resolveTheme()).toBe("dark");
  });

  it("derives the base palette from a custom theme's background brightness", () => {
    expect(
      resolveTheme({
        mode: "custom",
        activeThemeId: "forest",
        systemDark: false,
        uiScale: 1,
        textScale: 1,
        accent: null,
        background: "#0b0f0c",
        text: null,
      }),
    ).toBe("dark");
    expect(
      resolveTheme({
        mode: "custom",
        activeThemeId: "moonlight",
        systemDark: true,
        uiScale: 1,
        textScale: 1,
        accent: null,
        background: "#f2f0ea",
        text: null,
      }),
    ).toBe("light");
  });

  it("clears the active custom colours when switching to a built-in mode", () => {
    applyCustomTheme(forest);
    setThemeMode("light");

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--text")).toBe("");
    expect(document.documentElement.hasAttribute("data-custom-bg")).toBe(false);
    expect(localStorage.getItem("assets-toolbox-active-theme")).toBeNull();
    expect(localStorage.getItem("assets-toolbox-background")).toBeNull();

    // Opening the saved theme again puts the custom look straight back.
    applyCustomTheme(forest);
    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("#10241a");
    expect(localStorage.getItem("assets-toolbox-theme")).toBe("custom");
  });

  it("clears an active custom theme through the quick toggle too", () => {
    applyCustomTheme(forest);
    toggleTheme();

    expect(document.documentElement.dataset.theme).not.toBe("custom");
    expect(document.documentElement.hasAttribute("data-custom-bg")).toBe(false);
    expect(localStorage.getItem("assets-toolbox-active-theme")).toBeNull();
  });

  it("forgets the active custom theme on reset", () => {
    applyCustomTheme(forest);
    resetAppearance();

    expect(isSystemDefault()).toBe(true);
    expect(localStorage.getItem("assets-toolbox-active-theme")).toBeNull();
  });
});

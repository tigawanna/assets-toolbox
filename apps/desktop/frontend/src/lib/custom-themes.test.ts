import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  applyCustomThemesStorageEvent,
  deleteCustomTheme,
  getCustomTheme,
  listCustomThemes,
  saveCustomTheme,
  updateCustomTheme,
} from "./custom-themes";
import { resetAppearance, setThemeMode } from "./theme";

const moonlight = {
  name: "Moonlight",
  background: "#dfe7ff",
  accent: "#6366f1",
  text: "#1e1b4b",
};

function freshStore(): void {
  applyCustomThemesStorageEvent(
    new StorageEvent("storage", { key: "assets-toolbox-custom-themes", newValue: null }),
  );
}

beforeEach(() => {
  localStorage.clear();
  resetAppearance();
  freshStore();
});

describe("saved custom themes", () => {
  it("saves, names and lists themes", () => {
    const saved = saveCustomTheme(moonlight);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Moonlight");
    expect(saved?.id).toBeTruthy();

    expect(listCustomThemes()).toHaveLength(1);
    expect(getCustomTheme(saved!.id)?.background).toBe("#dfe7ff");
    expect(localStorage.getItem("assets-toolbox-custom-themes")).toContain("Moonlight");
  });

  it("trims names and canonicalises colours", () => {
    const saved = saveCustomTheme({
      name: "  Forest  ",
      background: "#10241A",
      accent: "#4ADE80",
      text: "#E8F5E9",
    });

    expect(saved?.name).toBe("Forest");
    expect(saved?.background).toBe("#10241a");
    expect(saved?.accent).toBe("#4ade80");
  });

  it("rejects empty names and invalid colours", () => {
    expect(saveCustomTheme({ ...moonlight, name: "   " })).toBeNull();
    expect(saveCustomTheme({ ...moonlight, background: "not-a-colour" })).toBeNull();
    expect(listCustomThemes()).toHaveLength(0);
  });

  it("updates and deletes a saved theme", () => {
    const saved = saveCustomTheme(moonlight)!;
    expect(updateCustomTheme(saved.id, { ...moonlight, name: "Nightfall" })).toBe(true);
    expect(getCustomTheme(saved.id)?.name).toBe("Nightfall");

    expect(updateCustomTheme("missing", moonlight)).toBe(false);
    deleteCustomTheme(saved.id);
    expect(listCustomThemes()).toHaveLength(0);
    expect(getCustomTheme(saved.id)).toBeUndefined();
  });

  it("keeps saved themes intact after switching to a built-in mode", () => {
    saveCustomTheme(moonlight);
    setThemeMode("light");

    expect(document.documentElement.style.getPropertyValue("--canvas")).toBe("");
    expect(listCustomThemes()).toHaveLength(1);
  });

  it("syncs the saved list from another tab", () => {
    saveCustomTheme(moonlight);
    const raw = localStorage.getItem("assets-toolbox-custom-themes");
    freshStore();
    expect(listCustomThemes()).toHaveLength(0);

    expect(
      applyCustomThemesStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-custom-themes", newValue: raw }),
      ),
    ).toBe(true);
    expect(listCustomThemes()[0].name).toBe("Moonlight");
    expect(
      applyCustomThemesStorageEvent(
        new StorageEvent("storage", { key: "assets-toolbox-unrelated", newValue: raw }),
      ),
    ).toBe(false);
  });
});

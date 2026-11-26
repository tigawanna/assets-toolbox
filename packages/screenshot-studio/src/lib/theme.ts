"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "screenshot-studio-theme";
export const THEME_CHANGE_EVENT = "screenshot-studio-themechange";
export const DESKTOP_THEME_STORAGE_KEY = "assets-toolbox-theme";
export const DESKTOP_THEME_CHANGE_EVENT = "assets-toolbox-themechange";

export type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#121a14" : "#f7f9f5");
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const datasetTheme = document.documentElement.dataset.theme;
  if (datasetTheme === "light" || datasetTheme === "dark") return datasetTheme;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(DESKTOP_THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled; the theme still applies for this session.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
  // The desktop shell listens on its shared event so both surfaces stay in sync.
  window.dispatchEvent(new CustomEvent<Theme>(DESKTOP_THEME_CHANGE_EVENT, { detail: theme }));
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setActive] = useState<Theme>(currentTheme);

  useEffect(() => {
    const sync = () => setActive(currentTheme());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") {
        applyTheme(next);
        setActive(next);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== DESKTOP_THEME_STORAGE_KEY) return;
      if (event.newValue !== "light" && event.newValue !== "dark") return;
      applyTheme(event.newValue);
      setActive(event.newValue);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    sync();
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    window.addEventListener(DESKTOP_THEME_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, onChange);
      window.removeEventListener(DESKTOP_THEME_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [theme, setTheme];
}

"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "assets-toolbox-theme";
export const THEME_CHANGE_EVENT = "assets-toolbox-themechange";

export type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled; the theme still applies for this session.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setActive] = useState<Theme>(currentTheme);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") {
        applyTheme(next);
        setActive(next);
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  return [theme, setTheme];
}

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "assets-toolbox-theme";
const THEME_EVENT = "assets-toolbox-themechange";
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function applyThemeStorageEvent(event: StorageEvent): boolean {
  if (event.key !== THEME_KEY) return false;
  if (event.newValue !== "light" && event.newValue !== "dark") return false;
  applyTheme(event.newValue);
  return true;
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (applyThemeStorageEvent(event)) listener();
  };

  listeners.add(listener);
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(THEME_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The in-memory theme still works when WebKit storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

export function toggleTheme(): void {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}

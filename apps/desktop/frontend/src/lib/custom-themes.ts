import { useSyncExternalStore } from "react";

import { normalizeColor, type CustomTheme } from "./theme";

export { applyCustomTheme } from "./theme";

const STORAGE_KEY = "assets-toolbox-custom-themes";
const CHANGE_EVENT = "assets-toolbox-customthemeschange";
const EMPTY: readonly CustomTheme[] = [];

/** The editable fields of a custom theme; its id is assigned on save. */
export type CustomThemeInput = Pick<CustomTheme, "name" | "background" | "accent" | "text">;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(raw: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // In-memory themes still work when WebKit storage is unavailable.
  }
}

function parseThemes(raw: string | null): CustomTheme[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CustomTheme => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        normalizeColor(typeof candidate.background === "string" ? candidate.background : null) !==
          null &&
        normalizeColor(typeof candidate.accent === "string" ? candidate.accent : null) !== null &&
        normalizeColor(typeof candidate.text === "string" ? candidate.text : null) !== null
      );
    });
  } catch {
    return [];
  }
}

function sanitize(input: CustomThemeInput): CustomThemeInput | null {
  const name = input.name.trim();
  const background = normalizeColor(input.background);
  const accent = normalizeColor(input.accent);
  const text = normalizeColor(input.text);
  if (!name || background === null || accent === null || text === null) return null;
  return { name, background, accent, text };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let themes: CustomTheme[] = typeof window === "undefined" ? [] : parseThemes(readStorage());
const listeners = new Set<() => void>();

function persist(): void {
  writeStorage(JSON.stringify(themes));
}

function publish(next: CustomTheme[]): void {
  themes = next;
  persist();
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<readonly CustomTheme[]>(CHANGE_EVENT, { detail: themes }));
  }
}

/** Saves the current look under a name and returns the new theme. */
export function saveCustomTheme(input: CustomThemeInput): CustomTheme | null {
  const clean = sanitize(input);
  if (clean === null) return null;
  const theme: CustomTheme = { id: makeId(), ...clean };
  publish([...themes, theme]);
  return theme;
}

/** Overwrites an existing theme's colours and name. */
export function updateCustomTheme(id: string, input: CustomThemeInput): boolean {
  const clean = sanitize(input);
  if (clean === null || !themes.some((theme) => theme.id === id)) return false;
  publish(themes.map((theme) => (theme.id === id ? { ...theme, ...clean } : theme)));
  return true;
}

export function deleteCustomTheme(id: string): void {
  if (!themes.some((theme) => theme.id === id)) return;
  publish(themes.filter((theme) => theme.id !== id));
}

export function getCustomTheme(id: string | null): CustomTheme | undefined {
  return id === null ? undefined : themes.find((theme) => theme.id === id);
}

export function listCustomThemes(): readonly CustomTheme[] {
  return themes;
}

/** Applies a preference list arriving from another window/tab. */
export function applyCustomThemesStorageEvent(event: StorageEvent): boolean {
  if (event.key !== STORAGE_KEY) return false;
  themes = parseThemes(event.newValue);
  for (const listener of listeners) listener();
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") return () => listeners.delete(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent): void {
  applyCustomThemesStorageEvent(event);
}

const getSnapshot = () => themes;

export function useCustomThemes(): readonly CustomTheme[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

import { useSyncExternalStore } from "react";

/** The theme actually painted on screen, after resolving "system"/"custom". */
export type Theme = "light" | "dark" | "black";
/** A user-facing theme choice. "system" follows the OS preference live;
 *  "custom" applies a saved, named look. */
export type ThemeMode = Theme | "system" | "custom";

/** A saved, named appearance preset that can be switched back to at any time. */
export interface CustomTheme {
  id: string;
  name: string;
  background: string;
  accent: string;
  text: string;
}

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "black", "system", "custom"];
export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  black: "Pitch black",
};

/** Per-theme defaults, used by CSS when no custom accent is stored. */
export const DEFAULT_ACCENTS: Record<Theme, string> = {
  light: "#b65e37",
  dark: "#dd8558",
  black: "#dd8558",
};
export const DEFAULT_BACKGROUNDS: Record<Theme, string> = {
  light: "#f2f0ea",
  dark: "#151714",
  black: "#000000",
};
export const DEFAULT_TEXTS: Record<Theme, string> = {
  light: "#252922",
  dark: "#ecece4",
  black: "#fafafa",
};

export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.05;
export const DEFAULT_UI_SCALE = 1;
export const DEFAULT_TEXT_SCALE = 1;

const THEME_KEY = "assets-toolbox-theme";
const ACTIVE_THEME_KEY = "assets-toolbox-active-theme";
const UI_SCALE_KEY = "assets-toolbox-ui-scale";
const TEXT_SCALE_KEY = "assets-toolbox-text-scale";
const ACCENT_KEY = "assets-toolbox-accent";
const BACKGROUND_KEY = "assets-toolbox-background";
const TEXT_KEY = "assets-toolbox-text";
const CHANGE_EVENT = "assets-toolbox-appearancechange";
const HEX_COLOR = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

export interface AppearanceState {
  mode: ThemeMode;
  /** Id of the saved custom theme currently in use, or null for a built-in mode. */
  activeThemeId: string | null;
  systemDark: boolean;
  /** Scales the whole UI (text, spacing, controls). Written to `--ui-scale`. */
  uiScale: number;
  /** Scales font sizes only. Written to `--text-scale`. */
  textScale: number;
  /** Custom primary color, or null for the theme's built-in accent. */
  accent: string | null;
  /** Custom canvas color, or null for the theme's built-in background. */
  background: string | null;
  /** Custom body text color, or null for the theme's built-in text. */
  text: string | null;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // In-memory preferences still work when WebKit storage is unavailable.
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const bounded = Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));
  return Math.round(bounded * 100) / 100;
}

function parseScale(raw: string | null): number {
  return raw === null ? DEFAULT_UI_SCALE : clampScale(Number(raw));
}

function parseMode(raw: string | null): ThemeMode {
  return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : "system";
}

/** Validates a stored/entered colour and returns it in canonical lower case. */
export function normalizeColor(raw: string | null): string | null {
  return raw !== null && HEX_COLOR.test(raw) ? raw.toLowerCase() : null;
}

function parseAccent(raw: string | null): string | null {
  return normalizeColor(raw);
}

/** Perceived brightness of a hex colour, used to derive a custom theme's base
 *  palette (dark backgrounds get dark-style surfaces, light ones get light). */
function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const red = parseInt(full.slice(1, 3), 16);
  const green = parseInt(full.slice(3, 5), 16);
  const blue = parseInt(full.slice(5, 7), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

export function customThemeBase(background: string | null): Theme {
  return background !== null && luminance(background) < 0.5 ? "dark" : "light";
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readState(): AppearanceState {
  return {
    mode: parseMode(readStorage(THEME_KEY)),
    activeThemeId: readStorage(ACTIVE_THEME_KEY),
    systemDark: prefersDark(),
    uiScale: parseScale(readStorage(UI_SCALE_KEY)),
    textScale: parseScale(readStorage(TEXT_SCALE_KEY)),
    accent: parseAccent(readStorage(ACCENT_KEY)),
    background: parseAccent(readStorage(BACKGROUND_KEY)),
    text: parseAccent(readStorage(TEXT_KEY)),
  };
}

const DEFAULT_STATE: AppearanceState = {
  mode: "system",
  activeThemeId: null,
  systemDark: false,
  uiScale: DEFAULT_UI_SCALE,
  textScale: DEFAULT_TEXT_SCALE,
  accent: null,
  background: null,
  text: null,
};

let state: AppearanceState = typeof window === "undefined" ? DEFAULT_STATE : readState();
const listeners = new Set<() => void>();

export function resolveTheme(value: AppearanceState = state): Theme {
  if (value.mode === "system") return value.systemDark ? "dark" : "light";
  if (value.mode === "custom") return customThemeBase(value.background);
  return value.mode;
}

/** The quick theme toggle cycles light → dark → pitch black → light. */
export function nextTheme(theme: Theme): Theme {
  if (theme === "light") return "dark";
  if (theme === "dark") return "black";
  return "light";
}

export function isSystemDefault(value: AppearanceState = state): boolean {
  return (
    value.mode === "system" &&
    value.activeThemeId === null &&
    value.uiScale === DEFAULT_UI_SCALE &&
    value.textScale === DEFAULT_TEXT_SCALE &&
    value.accent === null &&
    value.background === null &&
    value.text === null
  );
}

function apply(value: AppearanceState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = resolveTheme(value);
  root.dataset.theme = theme;
  // Studio's embedded stylesheet keys its dark tokens off `.dark`; pitch black
  // is a darker variant of the same mode, so it needs the class too.
  root.classList.toggle("dark", theme === "dark" || theme === "black");
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  root.style.setProperty("--ui-scale", String(value.uiScale));
  root.style.setProperty("--text-scale", String(value.textScale));
  if (value.accent === null) root.style.removeProperty("--accent");
  else root.style.setProperty("--accent", value.accent);
  if (value.background === null) {
    root.style.removeProperty("--canvas");
    root.removeAttribute("data-custom-bg");
  } else {
    root.style.setProperty("--canvas", value.background);
    root.setAttribute("data-custom-bg", "");
  }
  if (value.text === null) {
    root.style.removeProperty("--text");
    root.removeAttribute("data-custom-text");
  } else {
    root.style.setProperty("--text", value.text);
    root.setAttribute("data-custom-text", "");
  }
}

// Match the pre-hydration script in index.html before React mounts.
apply(state);

function publish(next: AppearanceState): void {
  state = next;
  apply(state);
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AppearanceState>(CHANGE_EVENT, { detail: state }));
  }
}

/** Leaving a custom theme for a built-in mode drops the custom colours so the
 *  selected theme is painted in full. The saved themes themselves are kept. */
const CLEARED_CUSTOM_STATE: Pick<
  AppearanceState,
  "activeThemeId" | "accent" | "background" | "text"
> = { activeThemeId: null, accent: null, background: null, text: null };

function clearActiveCustomColors(): Partial<AppearanceState> {
  removeStorage(ACTIVE_THEME_KEY);
  removeStorage(ACCENT_KEY);
  removeStorage(BACKGROUND_KEY);
  removeStorage(TEXT_KEY);
  return CLEARED_CUSTOM_STATE;
}

export function setThemeMode(mode: ThemeMode): void {
  if (!THEME_MODES.includes(mode)) return;
  writeStorage(THEME_KEY, mode);
  const cleared = mode === "custom" ? {} : clearActiveCustomColors();
  publish({ ...state, ...cleared, mode });
}

/** Switches to a saved custom theme, restoring all of its colours at once. */
export function applyCustomTheme(theme: CustomTheme): void {
  const accent = normalizeColor(theme.accent);
  const background = normalizeColor(theme.background);
  const text = normalizeColor(theme.text);
  writeStorage(THEME_KEY, "custom");
  writeStorage(ACTIVE_THEME_KEY, theme.id);
  if (accent === null) removeStorage(ACCENT_KEY);
  else writeStorage(ACCENT_KEY, accent);
  if (background === null) removeStorage(BACKGROUND_KEY);
  else writeStorage(BACKGROUND_KEY, background);
  if (text === null) removeStorage(TEXT_KEY);
  else writeStorage(TEXT_KEY, text);
  publish({
    ...state,
    mode: "custom",
    activeThemeId: theme.id,
    accent,
    background,
    text,
  });
}

/** Kept for existing callers. */
export function setTheme(theme: Theme): void {
  setThemeMode(theme);
}

export function toggleTheme(): void {
  setThemeMode(nextTheme(resolveTheme()));
}

export function setUiScale(value: number): void {
  const scale = clampScale(value);
  writeStorage(UI_SCALE_KEY, String(scale));
  publish({ ...state, uiScale: scale });
}

export function setTextScale(value: number): void {
  const scale = clampScale(value);
  writeStorage(TEXT_SCALE_KEY, String(scale));
  publish({ ...state, textScale: scale });
}

export function setAccent(color: string | null): void {
  const accent = parseAccent(color);
  if (accent === null) removeStorage(ACCENT_KEY);
  else writeStorage(ACCENT_KEY, accent);
  publish({ ...state, accent });
}

export function setBackground(color: string | null): void {
  const background = parseAccent(color);
  if (background === null) removeStorage(BACKGROUND_KEY);
  else writeStorage(BACKGROUND_KEY, background);
  publish({ ...state, background });
}

export function setTextColor(color: string | null): void {
  const text = parseAccent(color);
  if (text === null) removeStorage(TEXT_KEY);
  else writeStorage(TEXT_KEY, text);
  publish({ ...state, text });
}

export function resetAppearance(): void {
  removeStorage(THEME_KEY);
  removeStorage(ACTIVE_THEME_KEY);
  removeStorage(UI_SCALE_KEY);
  removeStorage(TEXT_SCALE_KEY);
  removeStorage(ACCENT_KEY);
  removeStorage(BACKGROUND_KEY);
  removeStorage(TEXT_KEY);
  publish({ ...DEFAULT_STATE, systemDark: prefersDark() });
}

/** Applies a persisted preference arriving from another window/tab. */
export function applyThemeStorageEvent(event: StorageEvent): boolean {
  switch (event.key) {
    case THEME_KEY: {
      const mode = parseMode(event.newValue);
      publish({
        ...state,
        ...(mode === "custom" ? {} : CLEARED_CUSTOM_STATE),
        mode,
      });
      return true;
    }
    case ACTIVE_THEME_KEY:
      publish({ ...state, activeThemeId: event.newValue });
      return true;
    case UI_SCALE_KEY:
      publish({ ...state, uiScale: parseScale(event.newValue) });
      return true;
    case TEXT_SCALE_KEY:
      publish({ ...state, textScale: parseScale(event.newValue) });
      return true;
    case ACCENT_KEY:
      publish({ ...state, accent: parseAccent(event.newValue) });
      return true;
    case BACKGROUND_KEY:
      publish({ ...state, background: parseAccent(event.newValue) });
      return true;
    case TEXT_KEY:
      publish({ ...state, text: parseAccent(event.newValue) });
      return true;
    default:
      return false;
  }
}

let systemQuery: MediaQueryList | null = null;
function onSystemChange(event: MediaQueryListEvent): void {
  if (state.mode !== "system") return;
  publish({ ...state, systemDark: event.matches });
}
function onStorage(event: StorageEvent): void {
  applyThemeStorageEvent(event);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") return () => listeners.delete(listener);

  window.addEventListener("storage", onStorage);
  if (window.matchMedia) {
    systemQuery ??= window.matchMedia("(prefers-color-scheme: dark)");
    if (systemQuery.addEventListener) systemQuery.addEventListener("change", onSystemChange);
    else systemQuery.addListener?.(onSystemChange);
  }

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    if (systemQuery) {
      if (systemQuery.removeEventListener) {
        systemQuery.removeEventListener("change", onSystemChange);
      } else {
        systemQuery.removeListener?.(onSystemChange);
      }
    }
  };
}

const getSnapshot = () => state;

export function useAppearance(): AppearanceState {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE);
}

export function useTheme(): Theme {
  return resolveTheme(useAppearance());
}

export function useThemeMode(): ThemeMode {
  return useAppearance().mode;
}

export function useActiveThemeId(): string | null {
  return useAppearance().activeThemeId;
}

export function useUiScale(): number {
  return useAppearance().uiScale;
}

export function useTextScale(): number {
  return useAppearance().textScale;
}

export function useAccent(): string | null {
  return useAppearance().accent;
}

export type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function initialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

const themeState = $state<{ value: Theme }>({ value: initialTheme() });

if (typeof window !== "undefined") {
  applyTheme(themeState.value);
  window.addEventListener("assets-toolbox-themechange", (event) => {
    const next = (event as CustomEvent<Theme>).detail;
    if (next === "light" || next === "dark") {
      themeState.value = next;
      applyTheme(next);
    }
  });
}

export function getTheme(): Theme {
  return themeState.value;
}

export function toggleTheme() {
  themeState.value = themeState.value === "dark" ? "light" : "dark";
  applyTheme(themeState.value);

  try {
    localStorage.setItem("assets-toolbox-theme", themeState.value);
  } catch {
    // The shell still works when WebKit storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<Theme>("assets-toolbox-themechange", { detail: themeState.value }),
  );
}

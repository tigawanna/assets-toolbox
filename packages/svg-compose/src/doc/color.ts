/** Color helpers for the inspector's native color input. */

export const SWATCHES = [
  "#1f2937",
  "#ffffff",
  "#6366f1",
  "#818cf8",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#ec4899",
  "#a5b4fc",
];

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  none: "#ffffff",
};

/** Convert common SVG color forms to the #rrggbb needed by <input type="color">. */
export function toHexColor(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return NAMED[color] ?? fallback;
}

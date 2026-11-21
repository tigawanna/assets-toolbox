import type { ColorRef } from "./schema";

export function resolveColor(ref: ColorRef | undefined, tokens: Record<string, string>): string {
  if (ref === undefined) return "#ffffff";
  if (typeof ref === "string") return ref;
  return tokens[ref.token] ?? "#ffffff";
}

export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (!/^[\da-fA-F]{6}$/i.test(full)) return hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

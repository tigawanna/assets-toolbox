import type { ChangeEvent } from "react";

import "./asset-controls.css";

export function normalizeHexColor(value: string, fallback = "#000000"): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    const [red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  return fallback;
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
}

export function ColorField({ label, value, onChange, fallback = "#000000" }: ColorFieldProps) {
  function pick(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="asset-color-field">
      <span>{label}</span>
      <div className="asset-color-controls">
        <input
          type="color"
          value={normalizeHexColor(value, fallback)}
          onChange={pick}
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} hex value`}
        />
      </div>
    </label>
  );
}

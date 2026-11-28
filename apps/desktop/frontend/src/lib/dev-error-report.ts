import { useSyncExternalStore } from "react";

/**
 * Dev-only error diagnostics. The router's error boundary only shows the
 * message by default, which hides the stack (and Vite's real compile error
 * when a lazily imported module fails). Keep everything here as plain text so
 * the report can be copied straight out of the app.
 */

export interface ViteErrorPayload {
  message?: string;
  stack?: string;
  frame?: string;
  plugin?: string;
  id?: string;
  [key: string]: unknown;
}

const viteErrorListeners = new Set<() => void>();
let lastViteError: ViteErrorPayload | null = null;

if (import.meta.hot) {
  import.meta.hot.on("vite:error", (payload: unknown) => {
    if (payload && typeof payload === "object") {
      lastViteError = payload as ViteErrorPayload;
      for (const listener of viteErrorListeners) listener();
    }
  });
}

function subscribe(listener: () => void) {
  viteErrorListeners.add(listener);
  return () => {
    viteErrorListeners.delete(listener);
  };
}

function getSnapshot() {
  return lastViteError;
}

export function useViteError() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
  try {
    return (
      JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? `${item}n` : item), 2) ??
      String(value)
    );
  } catch {
    return String(value); // circular or otherwise unserializable
  }
}

function describeError(error: unknown, seen: Set<unknown>, depth: number): string {
  if (error === null || error === undefined || typeof error !== "object") {
    return stringifyValue(error);
  }
  if (seen.has(error)) return "[circular reference]";
  seen.add(error);

  const record = error as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "Error";
  const message = typeof record.message === "string" ? record.message : stringifyValue(error);
  const lines = [`${name}: ${message}`];

  if (typeof record.stack === "string" && record.stack.trim()) lines.push(record.stack);

  const ignored = new Set(["name", "message", "stack", "cause", "toJSON"]);
  const extras = Object.keys(record)
    .filter((key) => !ignored.has(key) && typeof record[key] !== "function")
    .map((key) => `${key}: ${stringifyValue(record[key])}`);
  if (extras.length) lines.push(`\nAdditional fields:\n${extras.join("\n")}`);

  if ("cause" in record && depth < 6) {
    lines.push(`\nCaused by:\n${describeError(record.cause, seen, depth + 1)}`);
  }

  return lines.join("\n");
}

function describeViteError(payload: ViteErrorPayload | null): string {
  if (!payload) return "";

  // Vite wraps the real error in `err` on the HMR channel.
  const nested = payload.err;
  const source: ViteErrorPayload =
    nested && typeof nested === "object" ? (nested as ViteErrorPayload) : payload;
  const lines = ["Vite dev-server error:"];

  const message = source.message ?? payload.message;
  if (typeof message === "string") lines.push(message);
  const id = source.id ?? payload.id;
  if (typeof id === "string") lines.push(`Module: ${id}`);
  const plugin = source.plugin ?? payload.plugin;
  if (typeof plugin === "string") lines.push(`Plugin: ${plugin}`);
  const frame = source.frame ?? payload.frame;
  if (typeof frame === "string") lines.push(`\nSource frame:\n${frame}`);
  const stack = source.stack ?? payload.stack;
  if (typeof stack === "string") lines.push(`\nVite stack:\n${stack}`);

  const ignored = new Set(["message", "stack", "frame", "plugin", "id", "err", "type"]);
  const extras: string[] = [];
  for (const record of [payload, source]) {
    for (const key of Object.keys(record)) {
      if (ignored.has(key) || typeof record[key] === "function") continue;
      extras.push(`${key}: ${stringifyValue(record[key])}`);
    }
  }
  if (extras.length) lines.push(`\nAdditional fields:\n${[...new Set(extras)].join("\n")}`);

  return lines.join("\n");
}

export function buildErrorReport(
  error: unknown,
  options: {
    status?: number;
    componentStack?: string;
    viteError?: ViteErrorPayload | null;
  } = {},
): string {
  const sections = [
    "Assets Toolbox — development error report",
    `Time: ${new Date().toISOString()}`,
    `URL: ${typeof window === "undefined" ? "n/a" : window.location.href}`,
    `Status: ${options.status ?? "n/a"}`,
    `User agent: ${typeof navigator === "undefined" ? "n/a" : navigator.userAgent}`,
  ];

  if (error !== undefined) {
    sections.push(`\nCaught error:\n${describeError(error, new Set(), 0)}`);
  }
  if (options.componentStack?.trim()) {
    sections.push(`\nReact component stack:\n${options.componentStack.trim()}`);
  }

  const viteError = describeViteError(options.viteError ?? null);
  if (viteError) sections.push(`\n${viteError}`);

  return `${sections.join("\n")}\n`;
}

type RuntimeClipboard = {
  ClipboardSetText?: (text: string) => Promise<boolean>;
};

/** Wails' native clipboard first, then the web clipboard, then a textarea. */
export async function copyText(text: string): Promise<boolean> {
  const runtime = (window as Window & { runtime?: RuntimeClipboard }).runtime;
  if (runtime?.ClipboardSetText) {
    try {
      if (await runtime.ClipboardSetText(text)) return true;
    } catch {
      // fallback below
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

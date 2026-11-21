import type { UrlTarget } from "./types";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
const PRIVATE_V4 = /^(10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|0)\./;
const PRIVATE_V6_PREFIXES = ["fc", "fd", "fe80"];

function looksPrivate(host: string): boolean {
  if (LOCAL_HOSTS.has(host)) return true;
  if (PRIVATE_V4.test(host)) return true;
  const lower = host.toLowerCase();
  if (PRIVATE_V6_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  return lower.endsWith(".local") || lower.endsWith(".localhost");
}

/**
 * Accept a bare host, a host with a path, or a full URL. Bare inputs default
 * to https unless they are explicitly local.
 */
export function normalizeTarget(input: string): UrlTarget {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is empty");

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  const rawHost = url.hostname.replace(/^\[|\]$/g, "");
  const isLocal = looksPrivate(rawHost);
  url.hash = "";

  return { input: trimmed, url: url.toString(), isLocal };
}

/** Guard against fetching internal services when inspecting a remote URL. */
export function assertFetchAllowed(target: UrlTarget, allowPrivate: boolean): void {
  if (!allowPrivate && target.isLocal) {
    throw new Error(
      `Refusing to fetch private/local address ${target.url}. Pass allowPrivate: true to override.`,
    );
  }
}

/** Resolve a possibly-relative asset URL against the page it came from. */
export function resolveAsset(base: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

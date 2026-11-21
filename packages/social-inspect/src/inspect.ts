import { imageSize } from "image-size";

import { analyze } from "./analyze";
import { parsePage } from "./parse";
import type { ImageInfo, InspectOptions, InspectReport } from "./types";
import { assertFetchAllowed, normalizeTarget, resolveAsset } from "./url";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; social-inspect/1.0; +https://github.com/tigawanna/social-inspect)";

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort metadata for the OG image (dimensions + byte size). */
async function inspectImage(url: string, timeout: number, userAgent: string): Promise<ImageInfo> {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": userAgent } },
      Math.min(timeout, 8000),
    );
    if (!response.ok) return {};
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get("content-type")?.split(";")[0] || undefined;
    try {
      const dimensions = imageSize(bytes);
      return { width: dimensions.width, height: dimensions.height, bytes: bytes.byteLength, type };
    } catch {
      return { bytes: bytes.byteLength, type };
    }
  } catch {
    return {};
  }
}

/** Fetch a URL and return normalized metadata plus an analysis report. */
export async function inspectUrl(
  input: string,
  options: InspectOptions = {},
): Promise<InspectReport> {
  const target = normalizeTarget(input);
  assertFetchAllowed(target, options.allowPrivate ?? false);

  const timeout = options.timeout ?? 10_000;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const started = performance.now();

  let response: Response;
  try {
    response = await fetchWithTimeout(
      target.url,
      {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      timeout,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not fetch ${target.url}: ${reason}`);
  }

  const html = await response.text();
  const responseTimeMs = Math.round(performance.now() - started);

  const metadata = parsePage(html, {
    url: target.url,
    finalUrl: response.url || target.url,
    status: response.status,
    responseTimeMs,
    htmlSizeBytes: Buffer.byteLength(html),
    fetchedAt: new Date().toISOString(),
  });

  const analysis = analyze({
    url: metadata.finalUrl,
    title: metadata.title,
    description: metadata.description,
    faviconCount: metadata.favicons.length,
    og: metadata.og,
    twitter: metadata.twitter,
  });

  const imageUrl = resolveAsset(metadata.finalUrl, metadata.og.image ?? metadata.twitter.image);
  const ogImageInfo = imageUrl ? await inspectImage(imageUrl, timeout, userAgent) : undefined;

  return { ...metadata, analysis, ogImageInfo };
}

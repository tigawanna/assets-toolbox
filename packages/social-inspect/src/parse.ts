import { load } from "cheerio";

import type { FaviconResult, MetaTag, PageMetadata } from "./types";
import { resolveAsset } from "./url";

/** Collect the attributes of every meta/link/title node in the head. */
export function collectRawTags(html: string): MetaTag[] {
  const $ = load(html);
  const tags: MetaTag[] = [];

  $("meta, link, title").each((_, element) => {
    const node = element as { name?: string; attribs?: Record<string, string> };
    const attrs = node.attribs ?? {};
    const normalized: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(attrs)) normalized[key.toLowerCase()] = value;
    tags.push({ tagName: node.name ?? "", attrs: normalized });
  });

  return tags;
}

function first(
  tags: MetaTag[],
  selector: (attrs: Record<string, string | undefined>) => boolean,
): string | undefined {
  for (const tag of tags) {
    if (selector(tag.attrs)) return tag.attrs.content?.trim();
  }
  return undefined;
}

/**
 * Turn raw HTML into a normalized PageMetadata object. Property, name and
 * `itemprop` forms are all supported for Open Graph / Twitter / generic tags.
 */
export function parsePage(
  html: string,
  context: Pick<PageMetadata, "url" | "finalUrl" | "status" | "responseTimeMs" | "fetchedAt"> & {
    htmlSizeBytes?: number;
  },
): PageMetadata {
  const $ = load(html);
  const rawTags = collectRawTags(html);

  const title =
    first(rawTags, (a) => a.property?.toLowerCase() === "og:title") ??
    ($("title").first().text().trim() || undefined);
  const description =
    first(rawTags, (a) => a.property?.toLowerCase() === "og:description") ??
    first(rawTags, (a) => a.name?.toLowerCase() === "description") ??
    undefined;

  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const other: Record<string, string> = {};

  for (const tag of rawTags) {
    const content = tag.attrs.content?.trim();
    if (!content) continue;
    const property = tag.attrs.property?.toLowerCase();
    const name = tag.attrs.name?.toLowerCase();
    const itemprop = tag.attrs.itemprop?.toLowerCase();

    if (property?.startsWith("og:")) {
      og[property.slice(3)] = content;
    } else if (name?.startsWith("og:")) {
      og[name.slice(3)] = content;
    } else if (name?.startsWith("twitter:")) {
      twitter[name.slice(8)] = content;
    } else if (property?.startsWith("twitter:")) {
      twitter[property.slice(8)] = content;
    } else if (itemprop) {
      other[itemprop] = content;
    } else if (name && name !== "description" && name !== "keywords" && name !== "viewport") {
      other[name] = content;
    }
  }

  const keywordsRaw = first(rawTags, (a) => a.name?.toLowerCase() === "keywords");
  const keywords = keywordsRaw
    ? keywordsRaw
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean)
    : undefined;

  const favicons: FaviconResult[] = [];
  const seenIcons = new Set<string>();
  $("link[rel]").each((_, element) => {
    const attrs = (element as { attribs?: Record<string, string> }).attribs ?? {};
    const rel = (attrs.rel ?? "").toLowerCase();
    if (!/(^|\s)(icon|shortcut|apple-touch-icon|mask-icon)(\s|$)/.test(rel)) return;
    const href = resolveAsset(context.finalUrl, attrs.href);
    if (!href || seenIcons.has(href)) return;
    seenIcons.add(href);
    favicons.push({ url: href, rel, sizes: attrs.sizes, type: attrs.type });
  });

  const canonical = $('link[rel="canonical"]').first().attr("href");

  return {
    ...context,
    htmlSizeBytes: context.htmlSizeBytes ?? Buffer.byteLength(html),
    title,
    description,
    canonical: canonical ? resolveAsset(context.finalUrl, canonical) : undefined,
    themeColor: first(rawTags, (a) => a.name?.toLowerCase() === "theme-color"),
    keywords,
    og,
    twitter,
    other,
    favicons,
    rawTags,
  };
}

export type HtmlAttribute = Record<string, string | undefined>;

/** A meta tag reduced to the attributes we care about. */
export interface MetaTag {
  tagName: string;
  attrs: HtmlAttribute;
}

export interface FaviconResult {
  url: string;
  sizes?: string | undefined;
  type?: string | undefined;
  rel: string;
}

/** Normalized, deduplicated tags from a page's `<head>`. */
export interface PageMetadata {
  url: string;
  finalUrl: string;
  status: number;
  responseTimeMs: number;
  htmlSizeBytes: number;
  fetchedAt: string;
  title?: string | undefined;
  description?: string | undefined;
  canonical?: string | undefined;
  themeColor?: string | undefined;
  keywords?: string[] | undefined;
  og: Record<string, string>;
  twitter: Record<string, string>;
  other: Record<string, string>;
  favicons: FaviconResult[];
  /** Raw tags for the "Copy All" view. */
  rawTags: MetaTag[];
}

/** One actionable fix, readable by a human and copyable by an agent. */
export interface Issue {
  level: "error" | "warning" | "info";
  code: string;
  /** Short human sentence used in the issues sidebar. */
  message: string;
  /** Short imperative title, e.g. "Add an Open Graph URL". */
  name: string;
  /** Human explanation of why this matters and what to do. */
  description: string;
  /** Concrete markup to add to the page's <head>. */
  html: string;
  /** Ready-to-paste instruction for a coding agent. */
  prompt: string;
}

export interface Analysis {
  score: number;
  verdict: string;
  issues: Issue[];
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
    weight: number;
  }>;
}

/** Dimensions of a fetched image. */
export interface ImageInfo {
  width?: number | undefined;
  height?: number | undefined;
  bytes?: number | undefined;
  type?: string | undefined;
}

export interface InspectReport extends PageMetadata {
  analysis: Analysis;
  ogImageInfo?: ImageInfo | undefined;
}

/** Flattened view used by the scoring checks. */
export interface CheckInput {
  url?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  faviconCount: number;
  og: Record<string, string>;
  twitter: Record<string, string>;
}

export interface InspectOptions {
  /** Request timeout in milliseconds. Default 10000. */
  timeout?: number | undefined;
  /** Override the User-Agent header. */
  userAgent?: string | undefined;
  /** Bypass the private-network guard (use with care). */
  allowPrivate?: boolean | undefined;
}

export interface UrlTarget {
  input: string;
  url: string;
  isLocal: boolean;
}

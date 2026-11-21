import type { Analysis, CheckInput, Issue } from "./types";

interface Check {
  label: string;
  weight: number;
  key: (input: CheckInput) => string | undefined;
  level: Issue["level"];
  code: string;
  message: string;
  name: string;
  description: string;
  html: (input: CheckInput) => string;
  prompt: (input: CheckInput) => string;
  detail: (value: string | undefined) => string;
}

/** Placeholder used when the caller did not provide a target URL. */
function site(input: CheckInput): string {
  return input.url ?? "https://example.com";
}

/** Base URL without a trailing slash, for appending asset paths. */
function assetBase(input: CheckInput): string {
  return site(input).replace(/\/+$/, "");
}

const checks: Check[] = [
  {
    label: "Page title",
    weight: 20,
    key: (input) => input.title,
    level: "error",
    code: "MISSING_TITLE",
    message: "Add a <title> or og:title tag.",
    name: "Give the page a title",
    description:
      "The title is the main headline in search results and link previews. Keep it under 60 characters and use the same text for og:title.",
    html: () => "<title>Your page title</title>",
    prompt: () =>
      "Add a descriptive <title> element to the page's <head>. Keep it under 60 characters and keep it in sync with og:title if that tag exists.",
    detail: (value) => value ?? "Missing <title> and og:title",
  },
  {
    label: "Description",
    weight: 15,
    key: (input) => input.description,
    level: "error",
    code: "MISSING_DESCRIPTION",
    message: "Add a meta description or og:description tag.",
    name: "Describe the page",
    description:
      "A description of 150–160 characters is what search engines and social networks show under the title. Write it for someone who has not visited the page yet.",
    html: () => '<meta name="description" content="A concise summary of what this page offers." />',
    prompt: () =>
      'Write a 150–160 character meta description for this page based on its actual content, then add it as <meta name="description"> in <head>. Use plain language and avoid keyword stuffing.',
    detail: (value) => value ?? "Missing description",
  },
  {
    label: "og:title",
    weight: 10,
    key: (input) => input.og.title,
    level: "warning",
    code: "MISSING_OG_TITLE",
    message: "Add an og:title tag for social sharing.",
    name: "Add an Open Graph title",
    description:
      "Social networks prefer og:title over <title>. It can be slightly punchier, but it should still describe the same page.",
    html: () => '<meta property="og:title" content="Your page title" />',
    prompt: () =>
      "Add an og:title meta tag to <head>. Match the page's <title> unless a shorter, more social-friendly variant is more accurate.",
    detail: (value) => value ?? "Missing og:title",
  },
  {
    label: "og:description",
    weight: 10,
    key: (input) => input.og.description,
    level: "warning",
    code: "MISSING_OG_DESCRIPTION",
    message: "Add an og:description tag.",
    name: "Add an Open Graph description",
    description:
      "This is the summary shown on Facebook, LinkedIn, Slack and most other previews. It usually matches the meta description.",
    html: () =>
      '<meta property="og:description" content="A concise summary of what this page offers." />',
    prompt: () =>
      "Add an og:description meta tag to <head>. Reuse the meta description when one exists, otherwise write a 150–160 character summary from the page content.",
    detail: (value) => value ?? "Missing og:description",
  },
  {
    label: "og:image",
    weight: 15,
    key: (input) => input.og.image,
    level: "error",
    code: "MISSING_OG_IMAGE",
    message: "Add an og:image so links render with a preview image.",
    name: "Add a share image",
    description:
      "An absolute, 1200×630 image is the safest share image. Use an absolute URL so crawlers on other domains can fetch it.",
    html: (input) => `<meta property="og:image" content="${assetBase(input)}/og.png" />`,
    prompt: (input) =>
      `Create or reuse a 1200×630 PNG share image for ${site(input)}, then add an og:image meta tag with its absolute URL. The image must be publicly reachable without authentication.`,
    detail: (value) => value ?? "Missing og:image",
  },
  {
    label: "og:image dimensions",
    weight: 5,
    key: (input) =>
      input.og["image:width"] && input.og["image:height"]
        ? `${input.og["image:width"]}x${input.og["image:height"]}`
        : undefined,
    level: "info",
    code: "MISSING_OG_DIMENSIONS",
    message: "Declare og:image:width and og:image:height for consistent previews.",
    name: "Declare the share image size",
    description:
      "Stating the dimensions lets crawlers reserve the right space before the image loads, which avoids layout shift in previews.",
    html: () =>
      '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />',
    prompt: () =>
      "Add og:image:width and og:image:height meta tags matching the actual pixel dimensions of the og:image file (1200×630 is recommended).",
    detail: (value) => value ?? "No og:image:width / og:image:height",
  },
  {
    label: "og:type",
    weight: 3,
    key: (input) => input.og.type,
    level: "info",
    code: "MISSING_OG_TYPE",
    message: "Declare og:type (e.g. website).",
    name: "Declare the content type",
    description:
      'og:type tells crawlers what kind of page this is. "website" is correct for most pages; articles and products have their own types.',
    html: () => '<meta property="og:type" content="website" />',
    prompt: () =>
      'Add an og:type meta tag. Use "website" for general pages, or the correct Open Graph type such as "article" for blog posts.',
    detail: (value) => value ?? "Missing og:type",
  },
  {
    label: "og:url",
    weight: 3,
    key: (input) => input.og.url,
    level: "info",
    code: "MISSING_OG_URL",
    message: "Declare a canonical og:url.",
    name: "Declare a canonical URL",
    description:
      "og:url is the permanent address of this page. It stops likes and shares being attributed to a different URL when the page is reached via a redirect or query string.",
    html: (input) => `<meta property="og:url" content="${site(input)}" />`,
    prompt: (input) =>
      `Add an og:url meta tag pointing to the canonical address of this page (${site(input)}). Use an absolute URL with no tracking parameters.`,
    detail: (value) => value ?? "Missing og:url",
  },
  {
    label: "Twitter card",
    weight: 8,
    key: (input) => input.twitter.card,
    level: "warning",
    code: "MISSING_TWITTER_CARD",
    message: "Add twitter:card for X/Twitter previews.",
    name: "Choose an X card type",
    description:
      'twitter:card selects the layout on X. "summary_large_image" gives you a full-width image and is the usual choice when a share image exists.',
    html: () => '<meta name="twitter:card" content="summary_large_image" />',
    prompt: () =>
      'Add a twitter:card meta tag. Use "summary_large_image" when an og:image is available, otherwise "summary".',
    detail: (value) => value ?? "Missing twitter:card",
  },
  {
    label: "Twitter image",
    weight: 5,
    key: (input) => input.twitter.image,
    level: "info",
    code: "MISSING_TWITTER_IMAGE",
    message: "Add twitter:image; many platforms fall back to og:image.",
    name: "Add an X share image",
    description:
      "X will fall back to og:image, but an explicit twitter:image guarantees the right image is used and lets you tailor it per network.",
    html: (input) => `<meta name="twitter:image" content="${assetBase(input)}/og.png" />`,
    prompt: (input) =>
      `Add a twitter:image meta tag with an absolute URL to the share image (${assetBase(input)}/og.png is a sensible default when og:image already points there).`,
    detail: (value) => value ?? "Missing twitter:image",
  },
  {
    label: "Favicon",
    weight: 6,
    key: (input) => (input.faviconCount > 0 ? `${input.faviconCount} found` : undefined),
    level: "warning",
    code: "MISSING_FAVICON",
    message: "Add a favicon link so browsers and Google results show an icon.",
    name: "Add a favicon",
    description:
      "The favicon appears in browser tabs, bookmarks and Google search results. An SVG icon scales cleanly; keep a PNG fallback for older clients.",
    html: () => '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    prompt: () =>
      'Add a <link rel="icon"> to <head>. Prefer an SVG icon at /favicon.svg and keep a 32×32 PNG fallback. Reuse the brand mark already used elsewhere in the project.',
    detail: (value) => value ?? 'No <link rel="icon"> found',
  },
];

/** Score a page out of 100 using weighted presence checks. */
export function analyze(input: CheckInput): Analysis {
  const issues: Issue[] = [];
  const results = checks.map((check) => {
    const value = check.key(input);
    const passed = Boolean(value);
    if (!passed) {
      issues.push({
        level: check.level,
        code: check.code,
        message: check.message,
        name: check.name,
        description: check.description,
        html: check.html(input),
        prompt: check.prompt(input),
      });
    }
    return {
      label: check.label,
      passed,
      detail: check.detail(value),
      weight: check.weight,
    };
  });

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = results.reduce((sum, result) => sum + (result.passed ? result.weight : 0), 0);
  const score = Math.round((earned / total) * 100);

  const errors = issues.filter((issue) => issue.level === "error").length;
  let verdict = "Good setup — minor improvements possible.";
  if (score === 100) verdict = "Excellent! Your Open Graph tags are well-configured.";
  else if (errors > 0) verdict = "A few important social tags are missing.";

  return { score, verdict, issues, checks: results };
}

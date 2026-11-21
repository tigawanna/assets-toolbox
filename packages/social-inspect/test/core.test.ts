import { describe, expect, it } from "vite-plus/test";

import { analyze } from "../src/analyze";
import { parsePage } from "../src/parse";
import { buildAgentBrief } from "../src/suggestions";
import { normalizeTarget } from "../src/url";

const context = {
  url: "https://example.com",
  finalUrl: "https://example.com/",
  status: 200,
  responseTimeMs: 50,
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

describe("normalizeTarget", () => {
  it("defaults bare hosts to https", () => {
    expect(normalizeTarget("example.com").url).toBe("https://example.com/");
  });

  it("keeps explicit local URLs local", () => {
    const target = normalizeTarget("http://localhost:3000/path");
    expect(target.isLocal).toBe(true);
    expect(target.url).toBe("http://localhost:3000/path");
  });

  it("rejects unsupported protocols", () => {
    expect(() => normalizeTarget("ftp://example.com")).toThrow(/Unsupported protocol/);
  });
});

describe("parsePage", () => {
  it("extracts OG, Twitter, description and favicons", () => {
    const html = `<html><head>
      <title>My Site</title>
      <meta name="description" content="A great site" />
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG description" />
      <meta property="og:image" content="/og.png" />
      <meta property="og:image:width" content="1200" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple.png" sizes="180x180" />
      <link rel="canonical" href="/" />
    </head></html>`;

    const page = parsePage(html, context);
    expect(page.title).toBe("OG Title");
    expect(page.description).toBe("OG description");
    expect(page.og.image).toBe("/og.png");
    expect(page.og["image:width"]).toBe("1200");
    expect(page.twitter.card).toBe("summary_large_image");
    expect(page.favicons).toHaveLength(2);
    expect(page.favicons[0]?.url).toBe("https://example.com/favicon.svg");
    expect(page.canonical).toBe("https://example.com/");
  });

  it("handles empty documents", () => {
    const page = parsePage("<html></html>", context);
    expect(page.title).toBeUndefined();
    expect(page.og).toEqual({});
    expect(page.favicons).toEqual([]);
  });
});

describe("analyze", () => {
  it("scores a fully configured page 100 with no issues", () => {
    const result = analyze({
      title: "Title",
      description: "Description",
      faviconCount: 1,
      og: {
        title: "Title",
        description: "Description",
        image: "https://example.com/og.png",
        "image:width": "1200",
        "image:height": "630",
        type: "website",
        url: "https://example.com",
      },
      twitter: { card: "summary_large_image", image: "https://example.com/og.png" },
    });
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.verdict).toContain("Excellent");
  });

  it("drops the score and reports errors for a bare page", () => {
    const result = analyze({ faviconCount: 0, og: {}, twitter: {} });
    expect(result.score).toBeLessThan(50);
    expect(result.issues.some((issue) => issue.code === "MISSING_OG_IMAGE")).toBe(true);
  });

  it("attaches a named, human-readable and agent-ready fix to every issue", () => {
    const result = analyze({ url: "https://example.com", faviconCount: 0, og: {}, twitter: {} });
    for (const issue of result.issues) {
      expect(issue.name.length).toBeGreaterThan(3);
      expect(issue.description.length).toBeGreaterThan(20);
      expect(issue.html).toContain("<");
      expect(issue.prompt.length).toBeGreaterThan(20);
    }
    const ogUrl = result.issues.find((issue) => issue.code === "MISSING_OG_URL");
    expect(ogUrl?.html).toContain("https://example.com");
    expect(ogUrl?.prompt).toContain("https://example.com");
  });
});

describe("buildAgentBrief", () => {
  it("assembles a paste-ready brief with the concrete markup", () => {
    const result = analyze({ url: "https://example.com", faviconCount: 0, og: {}, twitter: {} });
    const brief = buildAgentBrief({ url: "https://example.com", issues: result.issues });
    expect(brief).toContain("Fix the social metadata for https://example.com");
    expect(brief).toContain("Why:");
    expect(brief).toContain("Add this to <head>:");
    expect(brief).toContain("Instruction:");
    expect(brief).toContain(result.issues[0]?.name);
  });

  it("reports a clean result when there are no issues", () => {
    expect(buildAgentBrief({ issues: [] })).toContain("No social metadata changes needed");
  });
});

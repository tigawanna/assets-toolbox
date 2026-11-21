import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { PreviewCards } from "../components/PreviewCards";
import { buildAgentBrief } from "@inspect/suggestions";
import type { InspectReport } from "@inspect/types";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
  }),
  component: InspectorPage,
});

const proxy = (url: string) => `/api/asset?url=${encodeURIComponent(url)}`;

const EXAMPLES = [
  { label: "cravfted.vercel.app", url: "https://cravfted.vercel.app" },
  { label: "github.com", url: "https://github.com" },
  { label: "localhost:3000", url: "http://localhost:3000" },
];

type MainTab = "cards" | "assets" | "meta" | "checks" | "fixes";
const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: "cards", label: "Previews" },
  { id: "assets", label: "Assets" },
  { id: "meta", label: "Meta tags" },
  { id: "fixes", label: "Fixes" },
  { id: "checks", label: "Checks" },
];

function Skeleton() {
  return (
    <div className="skeleton-grid" aria-busy="true" aria-label="Inspecting page">
      <div className="skel-card">
        <div className="skel skel-line" style={{ width: "40%" }} />
        <div className="skel skel-ring" />
        <div className="skel skel-line" style={{ width: "80%" }} />
        <div className="skel skel-line" style={{ width: "60%" }} />
        <div className="skel skel-line" style={{ width: "70%", marginTop: 28 }} />
        <div className="skel skel-line" style={{ width: "50%" }} />
      </div>
      <div>
        <div className="skel-tabs">
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
        </div>
        <div className="skel skel-preview" />
      </div>
    </div>
  );
}

function InspectorPage() {
  const { url: initialUrl } = Route.useSearch();
  const [input, setInput] = useState(initialUrl);
  const [report, setReport] = useState<InspectReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<MainTab>("cards");
  const [copied, setCopied] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const inspect = useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.trim() }),
      });
      const data = (await response.json()) as InspectReport & { error?: string };
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setReport(data);
      setTab("cards");
      window.history.replaceState(null, "", `/?url=${encodeURIComponent(target.trim())}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUrl) void inspect(initialUrl);
  }, [initialUrl, inspect]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copyAll = async () => {
    if (!report) return;
    const lines = report.rawTags.map((tag) => {
      const attrs = Object.entries(tag.attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag.tagName}${attrs ? ` ${attrs}` : ""}>`;
    });
    await copy(lines.join("\n"), "meta");
  };

  const score = report?.analysis.score ?? 0;
  let ringColor = "var(--bad)";
  if (score === 100) ringColor = "var(--good)";
  else if (score >= 60) ringColor = "var(--warn)";
  const hasErrors = report?.analysis.issues.some((issue) => issue.level === "error") ?? false;
  let verdict = "Good";
  if (score === 100) verdict = "Excellent";
  else if (hasErrors) verdict = "Needs work";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Social Inspect</span>
          <span className="brand-version">v0.1</span>
        </div>
        <div className="topmeta">local · nothing uploaded</div>
      </header>

      <div className="command-wrap">
        <p className="command-label">Inspect a URL</p>
        <form
          className="command"
          onSubmit={(event) => {
            event.preventDefault();
            void inspect(input);
          }}
        >
          <span className="prompt" aria-hidden="true">
            ›
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="cravfted.vercel.app  ·  http://localhost:3000"
            aria-label="URL to inspect"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="shortcut" aria-hidden="true">
            /
          </span>
          <button className="btn" type="submit" disabled={loading || !input.trim()}>
            {loading ? "Running" : "Inspect"}
          </button>
        </form>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <span className="error-tag">ERROR</span>
          <span className="error-msg">{error}</span>
        </div>
      ) : null}

      {loading && !report ? <Skeleton /> : null}

      {!report && !loading && !error ? (
        <div className="empty-stage">
          <div className="empty-glyph" aria-hidden="true" />
          <h1 className="empty-title">See what the internet sees.</h1>
          <p className="empty-copy">
            Fetch any local or remote page and inspect its Open Graph tags, favicons and social
            previews — the exact way Google, X, Slack and others render it.
          </p>
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button
                key={example.url}
                type="button"
                className="example"
                onClick={() => {
                  setInput(example.url);
                  void inspect(example.url);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {report && !loading ? (
        <div className="results">
          <div className="target-strip">
            <div className="target-host">{new URL(report.finalUrl).host}</div>
            <div className="target-metric">
              status <b>{report.status}</b>
            </div>
            <div className="target-metric">
              ttfb <b>{report.responseTimeMs}ms</b>
            </div>
            <div className="target-metric">
              html <b>{(report.htmlSizeBytes / 1024).toFixed(1)}kb</b>
            </div>
            <div className="target-metric">
              <b>{report.rawTags.length}</b> tags
            </div>
          </div>

          <div className="grid">
            <aside className="side">
              <section className="panel panel-pad">
                <h2 className="panel-label">Score</h2>
                <div className="score-block">
                  <div
                    className="score-ring"
                    style={
                      {
                        "--pct": score,
                        "--ring": ringColor,
                      } as React.CSSProperties
                    }
                  >
                    <span className="score-num">
                      <span className="score-value">{score}</span>
                      <span className="score-total">/100</span>
                    </span>
                  </div>
                  <div className="score-side-text">
                    <div className="score-word">{verdict}</div>
                    <div className="score-hint">{report.analysis.issues.length} issues found</div>
                  </div>
                </div>
                <dl className="stat-list">
                  <div className="stat">
                    <dt>title</dt>
                    <dd>{report.title || "—"}</dd>
                  </div>
                  <div className="stat">
                    <dt>canonical</dt>
                    <dd>{report.canonical ? new URL(report.canonical).host : "—"}</dd>
                  </div>
                  <div className="stat">
                    <dt>image</dt>
                    <dd>
                      {report.ogImageInfo?.width
                        ? `${report.ogImageInfo.width}×${report.ogImageInfo.height}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>favicons</dt>
                    <dd>{report.favicons.length}</dd>
                  </div>
                </dl>
              </section>

              <section className="panel panel-pad">
                <div className="meta-head">
                  <h2 className="panel-label" style={{ margin: 0 }}>
                    Issues
                  </h2>
                  {report.analysis.issues.length > 0 ? (
                    <button
                      className="copy-mini"
                      type="button"
                      onClick={() =>
                        void copy(
                          buildAgentBrief({ url: report.finalUrl, issues: report.analysis.issues }),
                          "brief",
                        )
                      }
                    >
                      {copied === "brief" ? "Copied" : "Copy for agent"}
                    </button>
                  ) : null}
                </div>
                {report.analysis.issues.length === 0 ? (
                  <div className="all-clear">
                    <span className="check">✓</span> All checks passed
                  </div>
                ) : (
                  report.analysis.issues.map((issue) => (
                    <div className={`issue ${issue.level}`} key={issue.code}>
                      <span className="issue-bar" />
                      <span className="issue-text">
                        {issue.message}
                        <span className="issue-code">{issue.code}</span>
                      </span>
                    </div>
                  ))
                )}
              </section>
            </aside>

            <main>
              <div className="tabs" role="tablist" aria-label="Inspection views">
                {MAIN_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={`tab ${tab === item.id ? "active" : ""}`}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === "cards" ? <PreviewCards report={report} proxy={proxy} /> : null}

              {tab === "assets" ? (
                <section className="panel panel-pad">
                  <h2 className="panel-label">Share assets</h2>
                  <div className="asset-grid">
                    {report.og.image ? (
                      <a
                        className="asset"
                        href={proxy(report.og.image)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="asset-preview og">
                          <img src={proxy(report.og.image)} alt="Open Graph image" />
                        </span>
                        <span className="asset-label">og:image</span>
                        <span className="asset-sub">
                          {report.ogImageInfo?.width
                            ? `${report.ogImageInfo.width}×${report.ogImageInfo.height} · `
                            : ""}
                          {report.ogImageInfo?.bytes
                            ? `${(report.ogImageInfo.bytes / 1024).toFixed(0)}kb`
                            : "image"}
                        </span>
                      </a>
                    ) : null}
                    {report.favicons.map((icon, index) => (
                      <a
                        className="asset"
                        key={icon.url}
                        href={proxy(icon.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="asset-preview">
                          <img src={proxy(icon.url)} alt="Favicon" />
                        </span>
                        <span className="asset-label">{icon.sizes || icon.rel}</span>
                        <span className="asset-sub">icon {String(index + 1).padStart(2, "0")}</span>
                      </a>
                    ))}
                  </div>
                  {!report.og.image && report.favicons.length === 0 ? (
                    <p className="empty-copy" style={{ margin: 0 }}>
                      No share assets were declared by this page.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {tab === "meta" ? (
                <section className="panel panel-pad">
                  <div className="meta-head">
                    <h2 className="meta-title">Raw head tags · {report.rawTags.length}</h2>
                    <button className="btn btn-ghost" type="button" onClick={() => void copyAll()}>
                      {copied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                  <table className="meta-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rawTags.map((tag, index) => (
                        <tr key={`${tag.tagName}-${index}`}>
                          <td>{tag.attrs.property || tag.attrs.name || tag.tagName}</td>
                          <td>{tag.attrs.content || tag.attrs.href || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}

              {tab === "fixes" ? (
                <section className="panel panel-pad">
                  <div className="meta-head">
                    <h2 className="meta-title">
                      {report.analysis.issues.length > 0
                        ? `${report.analysis.issues.length} suggested fixes`
                        : "Nothing to fix"}
                    </h2>
                    {report.analysis.issues.length > 0 ? (
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() =>
                          void copy(
                            buildAgentBrief({
                              url: report.finalUrl,
                              issues: report.analysis.issues,
                            }),
                            "all-fixes",
                          )
                        }
                      >
                        {copied === "all-fixes" ? "Copied" : "Copy all for agent"}
                      </button>
                    ) : null}
                  </div>

                  {report.analysis.issues.length === 0 ? (
                    <div className="all-clear">
                      <span className="check">✓</span> Every check passed — no changes suggested.
                    </div>
                  ) : (
                    <div className="fix-list">
                      {report.analysis.issues.map((issue, index) => (
                        <article className="fix" key={issue.code}>
                          <div className="fix-head">
                            <span className={`fix-level ${issue.level}`}>{issue.level}</span>
                            <span className="fix-index">{String(index + 1).padStart(2, "0")}</span>
                            <h3 className="fix-name">{issue.name}</h3>
                            <code className="fix-code">{issue.code}</code>
                          </div>
                          <p className="fix-desc">{issue.description}</p>
                          <div className="fix-snippets">
                            <div className="fix-snippet">
                              <div className="fix-snippet-head">
                                <span>HTML to add</span>
                                <button
                                  className="copy-mini"
                                  type="button"
                                  onClick={() => void copy(issue.html, `html-${issue.code}`)}
                                >
                                  {copied === `html-${issue.code}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre>{issue.html}</pre>
                            </div>
                            <div className="fix-snippet">
                              <div className="fix-snippet-head">
                                <span>Agent prompt</span>
                                <button
                                  className="copy-mini"
                                  type="button"
                                  onClick={() => void copy(issue.prompt, `prompt-${issue.code}`)}
                                >
                                  {copied === `prompt-${issue.code}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre>{issue.prompt}</pre>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {tab === "checks" ? (
                <section className="panel panel-pad">
                  <h2 className="panel-label">All checks</h2>
                  {report.analysis.checks.map((check) => (
                    <div
                      className={`check-row ${check.passed ? "pass" : "fail"}`}
                      key={check.label}
                    >
                      <span className="check-mark">{check.passed ? "✓" : "×"}</span>
                      <div>
                        <div className="check-name">{check.label}</div>
                        <div className="check-detail">{check.detail}</div>
                      </div>
                      <span className="check-weight">{check.weight}pts</span>
                    </div>
                  ))}
                </section>
              ) : null}
            </main>
          </div>
        </div>
      ) : null}

      <p className="footer">
        SOCIAL INSPECT · TARGET FETCHED BY LOCAL SERVER · NO DATA LEAVES THIS MACHINE
      </p>
    </div>
  );
}

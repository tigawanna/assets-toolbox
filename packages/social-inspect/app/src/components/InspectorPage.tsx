import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { buildAgentBrief } from "@inspect/suggestions";
import type { InspectReport } from "@inspect/types";

import { inspectorApiPath, inspectorAssetUrl, isEditableElement } from "../inspector-utils";
import { AssetPreviewGallery, type AssetPreviewItem } from "./AssetPreviewGallery";
import { PreviewCards } from "./PreviewCards";

export interface InspectorPageProps {
  initialUrl?: string | undefined;
  embedded?: boolean | undefined;
  onUrlChange?: ((url: string) => void) | undefined;
  apiBase?: string | undefined;
}

const EXAMPLES = [
  { label: "cravfted.vercel.app", url: "https://cravfted.vercel.app" },
  { label: "github.com", url: "https://github.com" },
  { label: "localhost:3000", url: "http://localhost:3000" },
];

type MainTab = "cards" | "assets" | "meta" | "fixes" | "checks";
const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: "cards", label: "Previews" },
  { id: "assets", label: "Assets" },
  { id: "meta", label: "Meta tags" },
  { id: "fixes", label: "Fixes" },
  { id: "checks", label: "Checks" },
];

function Skeleton() {
  return (
    <div className="inspect-skeleton-grid" aria-busy="true" aria-label="Inspecting page">
      <div className="inspect-skel-card">
        <div className="inspect-skel inspect-skel-line" style={{ width: "40%" }} />
        <div className="inspect-skel inspect-skel-ring" />
        <div className="inspect-skel inspect-skel-line" style={{ width: "80%" }} />
        <div className="inspect-skel inspect-skel-line" style={{ width: "60%" }} />
        <div className="inspect-skel inspect-skel-line" style={{ width: "70%", marginTop: 28 }} />
        <div className="inspect-skel inspect-skel-line" style={{ width: "50%" }} />
      </div>
      <div>
        <div className="inspect-skel-tabs">
          <div className="inspect-skel" />
          <div className="inspect-skel" />
          <div className="inspect-skel" />
        </div>
        <div className="inspect-skel inspect-skel-preview" />
      </div>
    </div>
  );
}

export function InspectorPage({
  initialUrl = "",
  embedded = false,
  onUrlChange,
  apiBase = "",
}: InspectorPageProps) {
  const [input, setInput] = useState(initialUrl);
  const [report, setReport] = useState<InspectReport | null>(null);
  const [error, setError] = useState("");
  const [clipboardError, setClipboardError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<MainTab>("cards");
  const [copied, setCopied] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequestRef = useRef(0);
  const onUrlChangeRef = useRef(onUrlChange);
  const lastNotifiedRef = useRef<{ url: string; apiBase: string } | null>(null);

  useEffect(() => {
    onUrlChangeRef.current = onUrlChange;
  }, [onUrlChange]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      copyRequestRef.current += 1;
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(async (text: string, key: string) => {
    const requestId = ++copyRequestRef.current;
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setClipboardError("");

    try {
      await navigator.clipboard.writeText(text);
      if (copyRequestRef.current !== requestId) return;
      setCopied(key);
      copyTimerRef.current = setTimeout(() => {
        setCopied((current) => (current === key ? "" : current));
        copyTimerRef.current = null;
      }, 1600);
    } catch (cause) {
      if (copyRequestRef.current !== requestId) return;
      setCopied("");
      const message = cause instanceof Error ? cause.message : String(cause);
      setClipboardError(`Could not copy to clipboard: ${message}`);
    }
  }, []);

  const inspect = useCallback(
    async (target: string) => {
      const url = target.trim();
      if (!url) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      lastNotifiedRef.current = null;
      setLoading(true);
      setError("");
      setClipboardError("");
      setReport(null);

      try {
        const response = await fetch(inspectorApiPath(apiBase, "inspect"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        const data = (await response.json()) as InspectReport & { error?: string };
        if (controller.signal.aborted || requestRef.current !== controller) return;
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

        setReport(data);
        setTab("cards");
        lastNotifiedRef.current = { url, apiBase };
        onUrlChangeRef.current?.(url);
      } catch (cause) {
        if (controller.signal.aborted || requestRef.current !== controller) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      }
    },
    [apiBase],
  );

  useEffect(() => {
    setInput(initialUrl);
    if (!initialUrl) {
      requestRef.current?.abort();
      requestRef.current = null;
      lastNotifiedRef.current = null;
      setReport(null);
      setError("");
      setClipboardError("");
      setLoading(false);
      return;
    }

    const lastNotified = lastNotifiedRef.current;
    if (lastNotified?.url === initialUrl && lastNotified.apiBase === apiBase) return;
    void inspect(initialUrl);
  }, [apiBase, initialUrl, inspect]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.target instanceof Element && isEditableElement(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const proxy = useCallback((url: string) => inspectorAssetUrl(apiBase, url), [apiBase]);

  const assetItems: AssetPreviewItem[] = report
    ? [
        ...(report.og.image
          ? [
              {
                src: proxy(report.og.image),
                label: "og:image",
                sub: report.ogImageInfo?.width
                  ? `${report.ogImageInfo.width}×${report.ogImageInfo.height} · ${report.ogImageInfo.bytes ?? 0}b`
                  : "Open Graph image",
                meta: "image",
              },
            ]
          : []),
        ...report.favicons.map((icon, index) => ({
          src: proxy(icon.url),
          label: icon.sizes || icon.rel,
          sub: `icon ${String(index + 1).padStart(2, "0")}`,
          meta: icon.type ?? "icon",
        })),
      ]
    : [];

  const copyAll = async () => {
    if (!report) return;
    const lines = report.rawTags.map((tag) => {
      const attrs = Object.entries(tag.attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag.tagName}${attrs ? ` ${attrs}` : ""}>`;
    });
    await copy(lines.join("\n"), "all-meta");
  };

  const score = report?.analysis.score ?? 0;
  let ringColor = "var(--inspect-bad)";
  if (score === 100) ringColor = "var(--inspect-good)";
  else if (score >= 60) ringColor = "var(--inspect-warn)";
  const hasErrors = report?.analysis.issues.some((issue) => issue.level === "error") ?? false;
  let verdict = "Good";
  if (score === 100) verdict = "Excellent";
  else if (hasErrors) verdict = "Needs work";

  const page = (
    <>
      {!embedded ? (
        <header className="inspect-topbar">
          <div className="inspect-brand">
            <span className="inspect-brand-mark" aria-hidden="true" />
            <span className="inspect-brand-name">Social Inspect</span>
            <span className="inspect-brand-version">v0.1</span>
          </div>
          <div className="inspect-topmeta">local · nothing uploaded</div>
        </header>
      ) : null}

      <div className="inspect-command-wrap">
        <form
          className="inspect-command"
          onSubmit={(event) => {
            event.preventDefault();
            void inspect(input);
          }}
        >
          <span className="inspect-prompt" aria-hidden="true">
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
          <span className="inspect-shortcut" aria-hidden="true">
            /
          </span>
          <button
            className="inspect-btn"
            type="submit"
            data-tour="inspect-button"
            disabled={loading || !input.trim()}
          >
            {loading ? "Running" : "Inspect"}
          </button>
        </form>
      </div>

      {error ? (
        <div className="inspect-error-banner" role="alert">
          <span className="inspect-error-tag">ERROR</span>
          <span className="inspect-error-msg">{error}</span>
        </div>
      ) : null}

      {clipboardError ? (
        <div className="inspect-copy-error" role="status">
          {clipboardError}
        </div>
      ) : null}

      {loading && !report ? <Skeleton /> : null}

      {!report && !loading && !error ? (
        <div className="inspect-empty-stage">
          <div className="inspect-empty-glyph" aria-hidden="true" />
          <h1 className="inspect-empty-title">See what the internet sees.</h1>
          <p className="inspect-empty-copy">
            Fetch any local or remote page and inspect its Open Graph tags, favicons and social
            previews — the exact way Google, X, Slack and others render it.
          </p>
          <div className="inspect-examples">
            {EXAMPLES.map((example) => (
              <button
                key={example.url}
                type="button"
                data-tour="sample-url"
                className="inspect-example"
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
        <div className="inspect-results">
          <div className="inspect-target-strip">
            <div className="inspect-target-host">{new URL(report.finalUrl).host}</div>
            <div className="inspect-target-metric">
              status <b>{report.status}</b>
            </div>
            <div className="inspect-target-metric">
              ttfb <b>{report.responseTimeMs}ms</b>
            </div>
            <div className="inspect-target-metric">
              html <b>{(report.htmlSizeBytes / 1024).toFixed(1)}kb</b>
            </div>
            <div className="inspect-target-metric">
              <b>{report.rawTags.length}</b> tags
            </div>
          </div>

          <div className="inspect-grid">
            <aside className="inspect-side">
              <section className="inspect-panel inspect-panel-pad">
                <h2 className="inspect-panel-label">Score</h2>
                <div className="inspect-score-block">
                  <div
                    className="inspect-score-ring"
                    style={
                      {
                        "--inspect-pct": score,
                        "--inspect-ring": ringColor,
                      } as CSSProperties
                    }
                  >
                    <span className="inspect-score-num">
                      <span className="inspect-score-value">{score}</span>
                      <span className="inspect-score-total">/100</span>
                    </span>
                  </div>
                  <div className="inspect-score-side-text">
                    <div className="inspect-score-word">{verdict}</div>
                    <div className="inspect-score-hint">
                      {report.analysis.issues.length} issues found
                    </div>
                  </div>
                </div>
                <dl className="inspect-stat-list">
                  <div className="inspect-stat">
                    <dt>title</dt>
                    <dd>{report.title || "—"}</dd>
                  </div>
                  <div className="inspect-stat">
                    <dt>canonical</dt>
                    <dd>{report.canonical ? new URL(report.canonical).host : "—"}</dd>
                  </div>
                  <div className="inspect-stat">
                    <dt>image</dt>
                    <dd>
                      {report.ogImageInfo?.width
                        ? `${report.ogImageInfo.width}×${report.ogImageInfo.height}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="inspect-stat">
                    <dt>favicons</dt>
                    <dd>{report.favicons.length}</dd>
                  </div>
                </dl>
              </section>

              <section className="inspect-panel inspect-panel-pad">
                <div className="inspect-meta-head">
                  <h2 className="inspect-panel-label" style={{ margin: 0 }}>
                    Issues
                  </h2>
                  {report.analysis.issues.length > 0 ? (
                    <button
                      className="inspect-copy-mini"
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
                  <div className="inspect-all-clear">
                    <span className="inspect-check">✓</span> All checks passed
                  </div>
                ) : (
                  report.analysis.issues.map((issue) => (
                    <div className={`inspect-issue inspect-${issue.level}`} key={issue.code}>
                      <span className="inspect-issue-bar" />
                      <span className="inspect-issue-text">
                        {issue.message}
                        <span className="inspect-issue-code">{issue.code}</span>
                      </span>
                    </div>
                  ))
                )}
              </section>
            </aside>

            <main>
              <div className="inspect-tabs" role="tablist" aria-label="Inspection views">
                {MAIN_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={`inspect-tab ${tab === item.id ? "inspect-active" : ""}`}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === "cards" ? <PreviewCards report={report} proxy={proxy} /> : null}

              {tab === "assets" ? (
                <section className="inspect-panel inspect-panel-pad">
                  <h2 className="inspect-panel-label">Share assets</h2>
                  <AssetPreviewGallery items={assetItems} />
                </section>
              ) : null}

              {tab === "meta" ? (
                <section className="inspect-panel inspect-panel-pad">
                  <div className="inspect-meta-head">
                    <h2 className="inspect-meta-title">Raw head tags · {report.rawTags.length}</h2>
                    <button
                      className="inspect-btn inspect-btn-ghost"
                      type="button"
                      onClick={() => void copyAll()}
                    >
                      {copied === "all-meta" ? "Copied" : "Copy all"}
                    </button>
                  </div>
                  <table className="inspect-meta-table">
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
                <section className="inspect-panel inspect-panel-pad">
                  <div className="inspect-meta-head">
                    <h2 className="inspect-meta-title">
                      {report.analysis.issues.length > 0
                        ? `${report.analysis.issues.length} suggested fixes`
                        : "Nothing to fix"}
                    </h2>
                    {report.analysis.issues.length > 0 ? (
                      <button
                        className="inspect-btn inspect-btn-ghost"
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
                    <div className="inspect-all-clear">
                      <span className="inspect-check">✓</span> Every check passed — no changes
                      suggested.
                    </div>
                  ) : (
                    <div className="inspect-fix-list">
                      {report.analysis.issues.map((issue, index) => (
                        <article className="inspect-fix" key={issue.code}>
                          <div className="inspect-fix-head">
                            <span className={`inspect-fix-level inspect-${issue.level}`}>
                              {issue.level}
                            </span>
                            <span className="inspect-fix-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 className="inspect-fix-name">{issue.name}</h3>
                            <code className="inspect-fix-code">{issue.code}</code>
                          </div>
                          <p className="inspect-fix-desc">{issue.description}</p>
                          <div className="inspect-fix-snippets">
                            <div className="inspect-fix-snippet">
                              <div className="inspect-fix-snippet-head">
                                <span>HTML to add</span>
                                <button
                                  className="inspect-copy-mini"
                                  type="button"
                                  onClick={() => void copy(issue.html, `html-${issue.code}`)}
                                >
                                  {copied === `html-${issue.code}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre>{issue.html}</pre>
                            </div>
                            <div className="inspect-fix-snippet">
                              <div className="inspect-fix-snippet-head">
                                <span>Agent prompt</span>
                                <button
                                  className="inspect-copy-mini"
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
                <section className="inspect-panel inspect-panel-pad">
                  <h2 className="inspect-panel-label">All checks</h2>
                  {report.analysis.checks.map((check) => (
                    <div
                      className={`inspect-check-row ${check.passed ? "inspect-pass" : "inspect-fail"}`}
                      key={check.label}
                    >
                      <span className="inspect-check-mark">{check.passed ? "✓" : "×"}</span>
                      <div>
                        <div className="inspect-check-name">{check.label}</div>
                        <div className="inspect-check-detail">{check.detail}</div>
                      </div>
                      <span className="inspect-check-weight">{check.weight}pts</span>
                    </div>
                  ))}
                </section>
              ) : null}
            </main>
          </div>
        </div>
      ) : null}

      {!embedded ? (
        <p className="inspect-footer">
          SOCIAL INSPECT · TARGET FETCHED BY LOCAL SERVER · NO DATA LEAVES THIS MACHINE
        </p>
      ) : null}
    </>
  );

  return (
    <div className={`social-inspect-root ${embedded ? "inspect-embedded" : "inspect-standalone"}`}>
      {embedded ? page : <div className="inspect-shell">{page}</div>}
    </div>
  );
}

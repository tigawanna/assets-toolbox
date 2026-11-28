import { useMemo, useState } from "react";
import { ArrowLeft, Clipboard, ClipboardCheck, TriangleAlert } from "lucide-react";

import { ShellLink } from "../components/ShellLink";
import { buildErrorReport, copyText, useViteError } from "../lib/dev-error-report";

const COPY_LABELS = {
  idle: "Copy error report",
  copied: "Copied to clipboard",
  failed: "Copy failed — select the text",
} as const;

export function ErrorPage({
  status = 500,
  message = "This page could not be opened.",
  error,
  componentStack,
}: {
  status?: number;
  message?: string;
  error?: unknown;
  componentStack?: string;
}) {
  const viteError = useViteError();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const showDebug = import.meta.env.DEV && (error !== undefined || viteError !== null);
  const report = useMemo(
    () => (showDebug ? buildErrorReport(error, { status, componentStack, viteError }) : ""),
    [showDebug, error, status, componentStack, viteError],
  );

  async function handleCopy() {
    const copied = await copyText(report);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 2400);
  }

  return (
    <div className="error-page">
      <span className="error-icon">
        <TriangleAlert size={28} aria-hidden="true" />
      </span>
      <p className="error-code">{status}</p>
      <h1>{message}</h1>
      <ShellLink to="/">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to library
      </ShellLink>

      {showDebug ? (
        <section className="error-debug" aria-label="Development error details">
          <details open>
            <summary>
              Developer details <span>(dev only)</span>
            </summary>
            <pre className="error-debug-text">{report}</pre>
            <div className="error-debug-actions">
              <button type="button" onClick={handleCopy}>
                {copyState === "copied" ? (
                  <ClipboardCheck size={13} aria-hidden="true" />
                ) : (
                  <Clipboard size={13} aria-hidden="true" />
                )}
                {COPY_LABELS[copyState]}
              </button>
              <span className="error-debug-hint">Includes the full stack and Vite error.</span>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

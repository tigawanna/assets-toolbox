import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { toolPackages } from "../lib/catalog";
import { getHelpGuide, HELP_TOOL_PACKAGES, QUICK_STARTS } from "../lib/help-content";
import "./help.css";

export function HelpPage() {
  const navigate = useNavigate();

  function openGuide(slug: string) {
    void navigate({ to: "/help/$slug", params: { slug } });
  }

  return (
    <section className="help-page help-index">
      <ToolHeader
        icon={<span className="help-header-mark">?</span>}
        title="Help"
        description="learn the tools · find a workflow"
        actions={
          <>
            <ToolHeaderButton
              onClick={() => window.dispatchEvent(new Event("assets-toolbox:replay-tour"))}
            >
              Replay tour
            </ToolHeaderButton>
            <ToolHeaderButton onClick={() => void navigate({ to: "/mcp" })}>
              MCP settings
            </ToolHeaderButton>
          </>
        }
      />

      <header className="help-hero">
        <p className="help-eyebrow">Help centre</p>
        <h1>Get something made.</h1>
        <p className="help-hero-lead">
          Every tool has a guide that walks through real jobs — draw a mark, check a link, build a
          screenshot strip, export a sound — with the exact steps and the shortcuts that make them
          quick.
        </p>
      </header>

      <section className="help-block">
        <div className="help-block-head">
          <p className="help-eyebrow">Start here</p>
          <h2>Common jobs, step by step</h2>
          <p>Pick a job and follow it from the first click to the exported file.</p>
        </div>
        <ol className="help-steps-list">
          {QUICK_STARTS.map((start, index) => {
            const guide = getHelpGuide(start.slug);
            const workflow = guide?.workflows[start.workflow];
            if (!guide || !workflow) return null;
            return (
              <li key={start.slug}>
                <button type="button" onClick={() => openGuide(start.slug)}>
                  <span className="help-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="help-step-copy">
                    <span className="help-step-tool">{guide.name}</span>
                    <strong>{workflow.title}</strong>
                    <span>{workflow.summary}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="help-block">
        <div className="help-block-head">
          <p className="help-eyebrow">Reference</p>
          <h2>All tool guides</h2>
          <p>What each tool is for, where it falls short, and every control it offers.</p>
        </div>
        <ul className="help-guide-list">
          {toolPackages.map((tool) => {
            const slug = Object.entries(HELP_TOOL_PACKAGES).find(
              ([, packageId]) => packageId === tool.id,
            )?.[0];
            if (!slug) return null;
            const guide = getHelpGuide(slug);
            return (
              <li key={tool.id}>
                <button type="button" onClick={() => openGuide(slug)}>
                  <span className="help-guide-icon">
                    <PackageIcon name={tool.icon} size={20} />
                  </span>
                  <span className="help-guide-copy">
                    <strong>{tool.name}</strong>
                    <span>{guide?.summary ?? tool.description}</span>
                  </span>
                  <span className="help-guide-tags">{tool.tags.join(" · ")}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

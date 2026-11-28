import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Play, Search } from "lucide-react";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { findPackage } from "../lib/catalog";
import { getHelpGuide, HELP_TOOL_PACKAGES, searchHelpControl } from "../lib/help-content";
import { getActiveProjectId } from "../lib/projects/client";
import { projectToolSlug } from "./ProjectHome";
import { replayToolTour } from "../lib/tool-tours";
import { ErrorPage } from "./ErrorPage";
import "./help.css";

export function HelpToolPage() {
  const { slug } = useParams({ from: "/help/$slug" });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const guide = getHelpGuide(slug);

  if (!guide) {
    return <ErrorPage status={404} message="That tool guide could not be found." />;
  }

  const pkg = findPackage(HELP_TOOL_PACKAGES[slug] ?? "");
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const workflows = guide.workflows
    .map((workflow) => ({
      ...workflow,
      steps: workflow.steps.filter((step) =>
        matches(`${workflow.title} ${step.title} ${step.detail}`),
      ),
    }))
    .filter((workflow) => workflow.steps.length > 0 || matches(workflow.summary));

  const features = guide.features.filter(matches);
  const controls = guide.controls.filter((control) => searchHelpControl(control, query));
  const total = workflows.length + features.length + controls.length;

  function openTool() {
    const projectId = getActiveProjectId();
    if (!projectId) {
      void navigate({ to: "/" });
      return;
    }
    void navigate({
      to: "/projects/$projectId/$tool",
      params: { projectId, tool: projectToolSlug(pkg?.id ?? "") },
    });
  }

  return (
    <section className="help-page help-detail">
      <ToolHeader
        icon={<PackageIcon name={pkg?.icon ?? "shapes"} size={17} />}
        title={guide.name}
        description={guide.summary}
        actions={
          <>
            <ToolHeaderButton onClick={() => void navigate({ to: "/help" })}>
              <ArrowLeft size={13} aria-hidden="true" />
              All guides
            </ToolHeaderButton>
            <ToolHeaderButton onClick={() => replayToolTour(slug)}>
              <Play size={13} aria-hidden="true" />
              Replay tour
            </ToolHeaderButton>
            <ToolHeaderButton variant="primary" onClick={openTool}>
              <ExternalLink size={13} aria-hidden="true" />
              Open tool
            </ToolHeaderButton>
          </>
        }
      />

      <header className="help-hero help-hero-detail">
        <p className="help-eyebrow">Tool guide</p>
        <h1>{guide.name}</h1>
        <p className="help-hero-lead">{guide.whatItIs}</p>
        <p className="help-hero-note">
          A guided tour starts the first time you open this tool. Use Replay tour above to see it
          again.
        </p>
      </header>

      <div className="help-search-wrap">
        <label className="help-search help-search-large">
          <Search size={16} aria-hidden="true" />
          <span className="help-sr-only">Search this guide</span>
          <input
            type="search"
            value={query}
            placeholder="Search a step, a feature or a shortcut…"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <span className="help-search-count">
            {query ? `${total} result${total === 1 ? "" : "s"}` : "Search this guide"}
          </span>
        </label>
      </div>

      {workflows.length > 0 ? (
        <section className="help-block">
          <div className="help-block-head">
            <p className="help-eyebrow">How to</p>
            <h2>Workflows</h2>
            <p>Follow these in order to get from a blank start to a finished file.</p>
          </div>
          <div className="help-workflows">
            {workflows.map((workflow) => (
              <section className="help-workflow" key={workflow.title}>
                <h3>{workflow.title}</h3>
                <p className="help-workflow-summary">{workflow.summary}</p>
                <ol>
                  {workflow.steps.map((step, index) => (
                    <li key={step.title}>
                      <span className="help-workflow-number">{index + 1}</span>
                      <span>
                        <strong>{step.title}</strong>
                        <span>{step.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <section className="help-block help-columns">
        <div>
          <div className="help-block-head">
            <p className="help-eyebrow">Use it for</p>
            <h2>Good at</h2>
          </div>
          <ul className="help-list">
            {guide.goodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="help-block-head">
            <p className="help-eyebrow">Don't expect</p>
            <h2>Not good at</h2>
          </div>
          <ul className="help-list help-list-muted">
            {guide.notGoodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {features.length > 0 ? (
        <section className="help-block">
          <div className="help-block-head">
            <p className="help-eyebrow">Details</p>
            <h2>Things worth knowing</h2>
          </div>
          <ul className="help-list help-list-features">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="help-block">
        <div className="help-block-head">
          <p className="help-eyebrow">Reference</p>
          <h2>Controls &amp; shortcuts</h2>
          <p>
            {controls.length} of {guide.controls.length} shown.
          </p>
        </div>
        {controls.length === 0 ? (
          <p className="help-empty">
            Nothing matches “{query}”. Try a key like “⌘Z” or a control name.
          </p>
        ) : (
          <ul className="help-controls">
            {controls.map((control) => (
              <li className="help-control" key={control.title}>
                <span className="help-control-keys">
                  {control.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
                <span className="help-control-copy">
                  <strong>{control.title}</strong>
                  <span>{control.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

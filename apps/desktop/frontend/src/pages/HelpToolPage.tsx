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
  const controls = guide.controls.filter((control) => searchHelpControl(control, query));

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

      <div className="help-detail-intro">
        <span className="help-detail-eyebrow">Guide</span>
        <h1>{guide.name}</h1>
        <p>{guide.whatItIs}</p>
        <p className="help-detail-tour-note">
          Opening this tool for the first time starts a short guided tour. Use Replay tour any time
          to see it again.
        </p>
      </div>

      <div className="help-detail-columns">
        <section className="help-detail-panel">
          <h2>Good for</h2>
          <ul>
            {guide.goodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="help-detail-panel help-detail-panel-muted">
          <h2>Not good at</h2>
          <ul>
            {guide.notGoodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="help-detail-panel">
        <h2>Features worth knowing</h2>
        <ul>
          {guide.features.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="help-detail-panel">
        <div className="help-detail-panel-head">
          <h2>Controls &amp; shortcuts</h2>
          <span>
            {controls.length} of {guide.controls.length}
          </span>
        </div>
        <label className="help-search">
          <Search size={14} aria-hidden="true" />
          <span className="help-sr-only">Search controls and shortcuts</span>
          <input
            type="search"
            value={query}
            placeholder="Search controls, keys or actions…"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        {controls.length === 0 ? (
          <p className="help-empty">
            Nothing matches “{query}”. Try a key like “⌘Z” or a control name.
          </p>
        ) : (
          <div className="help-controls">
            {controls.map((control) => (
              <article className="help-control" key={control.title}>
                <span className="help-control-keys">
                  {control.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
                <span className="help-control-copy">
                  <strong>{control.title}</strong>
                  <span>{control.detail}</span>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

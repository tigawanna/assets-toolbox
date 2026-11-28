import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Play } from "lucide-react";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { findPackage } from "../lib/catalog";
import { getHelpGuide, HELP_TEXT_LINKS, HELP_TOOL_PACKAGES } from "../lib/help-content";
import { getActiveProjectId } from "../lib/projects/client";
import { projectToolSlug } from "./ProjectHome";
import { ErrorPage } from "./ErrorPage";
import "./help.css";

export function HelpToolPage() {
  const { slug } = useParams({ from: "/help/$slug" });
  const navigate = useNavigate();
  const guide = getHelpGuide(slug);

  if (!guide) {
    return <ErrorPage status={404} message="That tool guide could not be found." />;
  }

  const pkg = findPackage(HELP_TOOL_PACKAGES[slug] ?? "");
  const workflows = guide.workflows;
  const features = guide.features;
  const controls = guide.controls;

  function openToolFor(targetSlug: string) {
    const projectId = getActiveProjectId();
    if (!projectId) {
      void navigate({ to: "/" });
      return;
    }
    const targetPackage = findPackage(HELP_TOOL_PACKAGES[targetSlug] ?? "");
    void navigate({
      to: "/projects/$projectId/$tool",
      params: { projectId, tool: projectToolSlug(targetPackage?.id ?? "") },
    });
  }

  function openTool() {
    openToolFor(slug);
  }

  function replayTour() {
    const projectId = getActiveProjectId();
    if (!projectId) {
      void navigate({ to: "/" });
      return;
    }
    const targetPackage = findPackage(HELP_TOOL_PACKAGES[slug] ?? "");
    void navigate({
      to: "/projects/$projectId/$tool",
      params: { projectId, tool: projectToolSlug(targetPackage?.id ?? "") },
      search: { replayTour: "1" },
    });
  }

  function HelpLine({ text }: { text: string }) {
    const link = HELP_TEXT_LINKS[text];
    if (!link) return <>{text}</>;
    const at = text.indexOf(link.label);
    return (
      <>
        {text.slice(0, at)}
        <a
          href={`#${link.slug}`}
          onClick={(event) => {
            event.preventDefault();
            openToolFor(link.slug);
          }}
        >
          {link.label}
        </a>
        {text.slice(at + link.label.length)}
      </>
    );
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
            <ToolHeaderButton onClick={replayTour}>
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
              <li key={item}>
                <HelpLine text={item} />
              </li>
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
              <li key={item}>
                <HelpLine text={item} />
              </li>
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
              <li key={item}>
                <HelpLine text={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="help-block">
        <div className="help-block-head">
          <p className="help-eyebrow">Reference</p>
          <h2>Controls &amp; shortcuts</h2>
          <p>{controls.length} controls and shortcuts in this tool.</p>
        </div>
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
      </section>
    </section>
  );
}

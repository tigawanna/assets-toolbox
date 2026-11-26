import { ArrowLeft, ArrowRight, Check, Code } from "lucide-react";

import { PackageIcon } from "../components/PackageIcon";
import { ShellLink } from "../components/ShellLink";
import type { ToolPackage } from "../lib/catalog";
import { ErrorPage } from "./ErrorPage";

export function PackagePlaceholderPage({ tool }: { tool?: ToolPackage }) {
  if (!tool) {
    return <ErrorPage status={404} message="This tool is not in the workspace catalog." />;
  }

  return (
    <>
      <ShellLink to="/" className="back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to library
      </ShellLink>

      <header className="module-heading">
        <div className="module-icon">
          <PackageIcon name={tool.icon} size={34} />
        </div>
        <div className="module-heading-copy">
          <div className="module-eyebrow">
            <span>{tool.category}</span>
            <span className="status-badge">{tool.mounted ? "Mounted" : "Not mounted"}</span>
          </div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
          <div className="tag-list" aria-label="Tool capabilities">
            {tool.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="module-layout">
        <section className="mount-plan" aria-labelledby="mount-title">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <h2 id="mount-title">Integration plan</h2>
              <p>The route is ready. The package integration comes next.</p>
            </div>
          </div>

          <div className="mount-strategy">
            <span>Recommended path</span>
            <strong>{tool.mount}</strong>
          </div>

          <ol className="mount-steps">
            <li>
              <span className="step-check">
                <Check size={13} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <div>
                <strong>Route reserved</strong>
                <p>TanStack Router navigates here without a full page reload.</p>
              </div>
            </li>
            <li>
              <span className="step-index">2</span>
              <div>
                <strong>Import the React package UI</strong>
                <p>Use the canonical package source instead of copied or translated components.</p>
              </div>
            </li>
            <li>
              <span className="step-index">3</span>
              <div>
                <strong>Connect native services</strong>
                <p>Keep filesystem, persistence, and platform work behind focused adapters.</p>
              </div>
            </li>
          </ol>
        </section>

        <aside className="module-details" aria-labelledby="details-title">
          <div className="details-heading">
            <Code size={18} aria-hidden="true" />
            <h2 id="details-title">Module details</h2>
          </div>
          <dl>
            <div>
              <dt>Reserved route</dt>
              <dd>
                <code>{tool.route}</code>
              </dd>
            </div>
            <div>
              <dt>Source package</dt>
              <dd>
                <code>{tool.source}</code>
              </dd>
            </div>
            <div>
              <dt>Current stack</dt>
              <dd>{tool.stack}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="detail-status">
                {tool.mounted ? "Mounted in desktop shell" : "Catalogued for mounting"}
              </dd>
            </div>
          </dl>
          <ShellLink to="/" className="details-link">
            Browse all modules
            <ArrowRight size={15} aria-hidden="true" />
          </ShellLink>
        </aside>
      </div>

      <footer className="module-footer">
        <span className="footer-mark" aria-hidden="true" />
        <p>This placeholder is intentional while the package gets a desktop-ready integration.</p>
      </footer>
    </>
  );
}

import { ArrowLeft } from "lucide-react";

import type { ToolPackage } from "../lib/catalog";
import { PackageIcon } from "./PackageIcon";
import { ShellLink } from "./ShellLink";

export function ModuleHeader({ tool }: { tool: ToolPackage }) {
  return (
    <header className="module-header">
      <ShellLink
        to="/"
        className="back-button"
        aria-label="Back to library"
        title="Back to library"
      >
        <ArrowLeft size={17} aria-hidden="true" />
      </ShellLink>
      <span className="module-icon">
        <PackageIcon name={tool.icon} size={22} />
      </span>
      <div className="module-title">
        <h1>{tool.name}</h1>
        <p>{tool.description}</p>
      </div>
      <span className="mounted-badge">Mounted</span>
    </header>
  );
}

import { ArrowUpRight } from "lucide-react";

import type { ToolPackage } from "../lib/catalog";
import { PackageIcon } from "./PackageIcon";
import { ShellLink } from "./ShellLink";

export function PackageCard({ tool }: { tool: ToolPackage }) {
  return (
    <ShellLink
      to={tool.route}
      className={`package-card${tool.featured ? " featured" : ""}`}
      aria-label={`Open ${tool.name}`}
    >
      <div className="card-topline">
        <span className="package-icon">
          <PackageIcon name={tool.icon} size={27} />
        </span>
        <span className="card-arrow">
          <ArrowUpRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </div>

      <div className="card-copy">
        <span className="category">{tool.category}</span>
        <h3>{tool.name}</h3>
        <p>{tool.description}</p>
      </div>

      <div className="card-footer">
        <span className="mount-state">{tool.mounted ? "Mounted" : "Route ready"}</span>
        <span className="stack">{tool.stack}</span>
      </div>
    </ShellLink>
  );
}

import type { ReactNode } from "react";

import "./tool-header.css";

interface ToolHeaderProps {
  icon: ReactNode;
  title: string;
  meta?: string;
  actions?: ReactNode;
}

export function ToolHeader({ icon, title, meta, actions }: ToolHeaderProps) {
  return (
    <header className="tool-header">
      <div className="tool-header-identity">
        <span className="tool-header-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="tool-header-copy">
          <strong>{title}</strong>
          {meta ? <span>{meta}</span> : null}
        </div>
      </div>
      {actions ? <div className="tool-header-actions">{actions}</div> : null}
    </header>
  );
}

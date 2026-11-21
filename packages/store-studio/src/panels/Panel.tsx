import type { ReactNode } from "react";

import { useLayout } from "../session/layout";

export interface PanelProps {
  id: string;
  title: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Collapsible panel shell shared by the sidebars and the slice strip. */
export function Panel({ id, title, className = "", actions, children }: PanelProps) {
  const collapsed = useLayout((state) => state.collapsed[id] ?? false);
  const togglePanel = useLayout((state) => state.togglePanel);
  return (
    <section className={`panel ${className}${collapsed ? " collapsed" : ""}`}>
      <div className="panel-title">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          onClick={() => togglePanel(id)}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <span className="panel-title-text">{title}</span>
        {actions === undefined ? null : <span className="panel-actions">{actions}</span>}
      </div>
      {collapsed ? null : children}
    </section>
  );
}

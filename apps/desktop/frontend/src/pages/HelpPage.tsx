import { useNavigate } from "@tanstack/react-router";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { projectToolSlug } from "./ProjectHome";
import { toolPackages } from "../lib/catalog";
import { getActiveProjectId } from "../lib/projects/client";
import "./help.css";

const TIPS: Array<{ title: string; body: string }> = [
  {
    title: "Press ? anywhere",
    body: "Opens the full keyboard shortcut list for the current screen. Esc closes it.",
  },
  {
    title: "One project, one place",
    body: "Pick a project on the launch screen. Every tool, asset, and saved form lives inside it.",
  },
  {
    title: "Reuse source artwork",
    body: "A mark chosen in Brand Assets is stored in the project. Expo Assets can use it without re-uploading.",
  },
  {
    title: "Starred sounds lead",
    body: "Favorites in Cabra Sound float to the top of the list and are saved per project.",
  },
  {
    title: "Gallery navigation",
    body: "Arrow keys move through asset previews, Home/End jump to the ends, Escape closes. Wheel zooms.",
  },
  {
    title: "Edit MCP results",
    body: "Generated files are saved as editable tool documents — open the tool again to tweak and re-export.",
  },
  {
    title: "MCP in three steps",
    body: "Call assets_toolbox with op=list to discover tools, op=describe for a schema, then op=call.",
  },
];

export function HelpPage() {
  const navigate = useNavigate();

  return (
    <section className="help-page">
      <ToolHeader
        icon={<span className="help-header-mark">?</span>}
        title="Help"
        description="tools · workflows · tips"
        actions={
          <ToolHeaderButton onClick={() => void navigate({ to: "/mcp" })}>
            MCP settings
          </ToolHeaderButton>
        }
      />

      <section className="help-section">
        <h2>Tools</h2>
        <div className="help-tools">
          {toolPackages.map((tool) => (
            <button
              type="button"
              className="help-tool"
              key={tool.id}
              onClick={() => {
                const projectId = getActiveProjectId();
                if (!projectId) {
                  void navigate({ to: "/" });
                  return;
                }
                void navigate({
                  to: "/projects/$projectId/$tool",
                  params: { projectId, tool: projectToolSlug(tool.id) },
                });
              }}
            >
              <span className="help-tool-icon">
                <PackageIcon name={tool.icon} size={18} />
              </span>
              <span className="help-tool-copy">
                <strong>{tool.name}</strong>
                <span>{tool.description}</span>
                <span className="help-tool-tags">{tool.tags.join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="help-section">
        <h2>Tips &amp; tricks</h2>
        <div className="help-tips">
          {TIPS.map((tip) => (
            <article className="help-tip" key={tip.title}>
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

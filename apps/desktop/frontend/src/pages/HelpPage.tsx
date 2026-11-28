import { useNavigate } from "@tanstack/react-router";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { HELP_TOOL_PACKAGES } from "../lib/help-content";
import { toolPackages } from "../lib/catalog";
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

      <section className="help-section">
        <h2>Tool guides</h2>
        <p className="help-section-note">
          Open a guide for what the tool is for, what it cannot do, and a searchable list of every
          control. The first time you open a tool, a short tour shows the essentials.
        </p>
        <div className="help-tools">
          {toolPackages.map((tool) => (
            <button
              type="button"
              className="help-tool"
              key={tool.id}
              onClick={() => {
                const slug = Object.entries(HELP_TOOL_PACKAGES).find(
                  ([, packageId]) => packageId === tool.id,
                )?.[0];
                if (slug) void navigate({ to: "/help/$slug", params: { slug } });
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

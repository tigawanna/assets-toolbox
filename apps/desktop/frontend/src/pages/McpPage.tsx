import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { Check, Copy, Search } from "lucide-react";

import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import "./mcp.css";

interface McpCall {
  at: string;
  op: string;
  tool?: string;
  args?: Record<string, unknown>;
  ok: boolean;
  error?: string;
}

interface NestedTool {
  id: string;
  summary: string;
  mutating?: boolean;
}

type WailsRuntime = {
  EventsOn: (event: string, callback: (...data: unknown[]) => void) => () => void;
};

const TOOL_GROUPS: Record<string, string> = {
  projects: "Projects",
  assets: "Assets",
  brand: "Brand Assets",
  compose: "Icon Compose",
  expo: "Expo Assets",
  studio: "Screenshot Studio",
  sound: "Cabra Sound",
  inspect: "Social Inspect",
  documents: "Documents",
  templates: "Templates",
  jobs: "Jobs",
};

function toolGroup(id: string): string {
  return id.split(".")[0] ?? "other";
}

function groupLabel(group: string): string {
  return (
    TOOL_GROUPS[group] ??
    group.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function snippet(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function McpPage() {
  const [calls, setCalls] = useState<McpCall[]>([]);
  const [tools, setTools] = useState<NestedTool[]>([]);
  const [toolQuery, setToolQuery] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function copyConfig(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("Clipboard access was blocked.");
    }
  }

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp/log");
      if (!response.ok) throw new Error(`Log request failed (${response.status})`);
      const payload = (await response.json()) as { calls?: McpCall[] };
      setCalls(payload.calls ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the MCP log.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    void fetch("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "assets_toolbox",
          arguments: { op: "list" },
        },
      }),
    })
      .then((response) => response.json())
      .then((payload: { result?: { content?: Array<{ text: string }> } }) => {
        const text = payload.result?.content?.[0]?.text;
        if (!text) return;
        const parsed = JSON.parse(text) as { tools?: NestedTool[] };
        setTools(parsed.tools ?? []);
      })
      .catch(() => {
        // The MCP screen still works when the native backend is unavailable.
      });
  }, [refresh]);

  useEffect(() => {
    const runtime = (window as Window & { runtime?: WailsRuntime }).runtime;
    if (!runtime) return;
    return runtime.EventsOn("mcp:call", (entry: unknown) => {
      setCalls((current) => [...current.slice(-199), entry as McpCall]);
    });
  }, []);

  const httpServer = { url: `${window.location.origin}/mcp` };
  const stdioServer = { command: "assets-toolbox", env: { ASSETS_TOOLBOX_MCP_STDIO: "1" } };
  const httpConfig = snippet({ mcpServers: { "assets-toolbox": httpServer } });
  const stdioConfig = snippet({ mcpServers: { "assets-toolbox": stdioServer } });
  const httpServerOnly = snippet(httpServer);
  const stdioServerOnly = snippet(stdioServer);

  const needle = toolQuery.trim().toLowerCase();
  const filteredTools = tools.filter((tool) =>
    `${tool.id} ${tool.summary} ${groupLabel(toolGroup(tool.id))}`.toLowerCase().includes(needle),
  );
  const groupedTools = useMemo(() => {
    const groups = new Map<string, NestedTool[]>();
    for (const tool of filteredTools) {
      const group = toolGroup(tool.id);
      const items = groups.get(group) ?? [];
      items.push(tool);
      groups.set(group, items);
    }
    const preferred = Object.keys(TOOL_GROUPS);
    return [...groups.entries()].sort(([left], [right]) => {
      const leftIndex = preferred.indexOf(left);
      const rightIndex = preferred.indexOf(right);
      return (
        (leftIndex < 0 ? preferred.length : leftIndex) -
          (rightIndex < 0 ? preferred.length : rightIndex) || left.localeCompare(right)
      );
    });
  }, [filteredTools]);

  return (
    <section className="mcp-page">
      <ToolHeader
        icon={<span className="mcp-header-mark">M</span>}
        title="MCP"
        description="native tool bridge · local only"
        actions={<ToolHeaderButton onClick={() => void refresh()}>Refresh log</ToolHeaderButton>}
      />

      {error ? <p className="mcp-error">{error}</p> : null}

      <section className="mcp-section">
        <h2>Configuration</h2>
        <div className="mcp-config-grid">
          <div>
            <div className="mcp-config-head">
              <h3>HTTP (Wails app)</h3>
              <div className="mcp-copy-actions">
                <button type="button" onClick={() => void copyConfig(httpConfig, "http")}>
                  {copied === "http" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "http" ? "Copied" : "Copy config"}
                </button>
                <button type="button" onClick={() => void copyConfig(httpServerOnly, "httpServer")}>
                  {copied === "httpServer" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "httpServer" ? "Copied" : "Server only"}
                </button>
              </div>
            </div>
            <pre>{httpConfig}</pre>
            <details>
              <summary>Server entry only (no mcpServers wrapper)</summary>
              <pre>{httpServerOnly}</pre>
            </details>
          </div>
          <div>
            <div className="mcp-config-head">
              <h3>Stdio (headless)</h3>
              <div className="mcp-copy-actions">
                <button type="button" onClick={() => void copyConfig(stdioConfig, "stdio")}>
                  {copied === "stdio" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "stdio" ? "Copied" : "Copy config"}
                </button>
                <button
                  type="button"
                  onClick={() => void copyConfig(stdioServerOnly, "stdioServer")}
                >
                  {copied === "stdioServer" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "stdioServer" ? "Copied" : "Server only"}
                </button>
              </div>
            </div>
            <pre>{stdioConfig}</pre>
            <details>
              <summary>Server entry only (no mcpServers wrapper)</summary>
              <pre>{stdioServerOnly}</pre>
            </details>
          </div>
        </div>
        <div className="mcp-env">
          <span>ASSETS_TOOLBOX_MCP_HTTP</span> serve the JSON-RPC endpoint on an address
          <span>ASSETS_TOOLBOX_MCP_STDIO</span> speak JSON-RPC lines on stdin/stdout
          <span>ASSETS_TOOLBOX_WORKER</span> override the generation sidecar path
        </div>
      </section>

      <section className="mcp-section">
        <h2>Available tools</h2>
        <p className="mcp-note">
          One registered tool — <code>assets_toolbox</code> — with {tools.length} nested tools. Use
          <code> op=list</code>, <code>op=describe</code>, then <code>op=call</code>.
        </p>
        {tools.length === 0 ? (
          <p className="mcp-note">Connect the native backend to load the tool catalog.</p>
        ) : (
          <>
            <div className="mcp-toolbar">
              <label className="mcp-search">
                <Search size={13} aria-hidden="true" />
                <span className="sr-only">Filter available tools</span>
                <input
                  type="search"
                  value={toolQuery}
                  placeholder="Filter tools…"
                  onChange={(event) => setToolQuery(event.currentTarget.value)}
                />
              </label>
              <span className="mcp-tool-count">
                {filteredTools.length} of {tools.length} tools
              </span>
            </div>
            {groupedTools.length === 0 ? (
              <p className="mcp-note">No tools match “{toolQuery}”.</p>
            ) : (
              <div className="mcp-tools">
                {groupedTools.map(([group, items]) => (
                  <Fragment key={group}>
                    <h3 className="mcp-group-head">
                      {groupLabel(group)}
                      <span>{items.length}</span>
                    </h3>
                    {items.map((tool) => (
                      <article className="mcp-tool" key={tool.id}>
                        <div className="mcp-tool-top">
                          <code>{tool.id}</code>
                          {tool.mutating ? <span className="mcp-tool-mutating">writes</span> : null}
                        </div>
                        <span className="mcp-tool-summary">{tool.summary}</span>
                      </article>
                    ))}
                  </Fragment>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mcp-section">
        <h2>Call history</h2>
        <p className="mcp-note">Live log of every tool call, newest last.</p>
        {calls.length === 0 ? (
          <p className="mcp-note">No calls recorded yet.</p>
        ) : (
          <div className="mcp-log">
            {calls.map((call, index) => (
              <article className="mcp-log-row" key={`${call.at}-${index}`}>
                <div className="mcp-log-top">
                  <span className="mcp-log-status" data-ok={call.ok}>
                    {call.ok ? "ok" : "error"}
                  </span>
                  <code>{call.op}</code>
                  <code>{call.tool ?? "—"}</code>
                  <time>{new Date(call.at).toLocaleTimeString()}</time>
                </div>
                <pre className="mcp-log-detail">{call.error ?? snippet(call.args ?? {})}</pre>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

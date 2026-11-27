import { useCallback, useEffect, useState } from "react";

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

function snippet(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function McpPage() {
  const [calls, setCalls] = useState<McpCall[]>([]);
  const [tools, setTools] = useState<NestedTool[]>([]);
  const [error, setError] = useState("");

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

  const httpConfig = snippet({
    mcpServers: {
      "assets-toolbox": { url: `${window.location.origin}/mcp` },
    },
  });
  const stdioConfig = snippet({
    mcpServers: {
      "assets-toolbox": { command: "assets-toolbox", env: { ASSETS_TOOLBOX_MCP_STDIO: "1" } },
    },
  });

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
            <h3>HTTP (Wails app)</h3>
            <pre>{httpConfig}</pre>
          </div>
          <div>
            <h3>Stdio (headless)</h3>
            <pre>{stdioConfig}</pre>
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
          <div className="mcp-tools">
            {tools.map((tool) => (
              <div className="mcp-tool" key={tool.id}>
                <code>{tool.id}</code>
                <span>{tool.summary}</span>
                {tool.mutating ? <span className="mcp-tool-mutating">writes</span> : null}
              </div>
            ))}
          </div>
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
              <div className="mcp-log-row" key={`${call.at}-${index}`}>
                <span className="mcp-log-status" data-ok={call.ok}>
                  {call.ok ? "ok" : "error"}
                </span>
                <code>{call.op}</code>
                <code>{call.tool ?? "—"}</code>
                <span>{call.error ?? JSON.stringify(call.args ?? {}).slice(0, 120)}</span>
                <time>{new Date(call.at).toLocaleTimeString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

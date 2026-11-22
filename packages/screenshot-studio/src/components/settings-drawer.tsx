import { Check, Copy, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { StudioSheet } from "@/components/studio-sheet";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { loadSettings } from "@/server/fns";
import type { StudioSettings } from "@/server/settings";

function AppearanceRow() {
  const [theme, setTheme] = useTheme();
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium text-foreground">Appearance</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Follows your system preference until you pick one.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["light", "dark"] as const).map((option) => {
          const Icon = option === "light" ? Sun : Moon;
          const active = option === theme;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(option)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium capitalize shadow-xs transition-colors",
                active
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CopyRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <Button variant="ghost" size="xs" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {multiline ? (
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
          {value}
        </pre>
      ) : (
        <p className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs break-all text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}

export function SettingsDrawer({
  projectId,
  align = "ghost",
}: {
  projectId?: string;
  align?: "ghost" | "header";
}) {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSettings({ data: { projectId } })
      .then(setSettings)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Could not load settings"),
      );
  }, [projectId]);

  const origin = typeof window === "undefined" ? settings?.origin : window.location.origin;
  const mcpUrl = origin === undefined ? "" : `${origin}/mcp`;
  const mcpJson =
    mcpUrl === ""
      ? ""
      : JSON.stringify({ mcpServers: { "screenshot-studio": { url: mcpUrl } } }, null, 2);

  return (
    <StudioSheet
      side="right"
      title="Settings"
      description="Where boards live on disk, and how Cursor talks to this studio over MCP."
      trigger={
        <Button
          variant="ghost"
          size={align === "header" ? "xs" : "xs"}
          title="Open settings"
          aria-label="Open settings"
          data-testid="open-settings"
        >
          <Settings />
          Settings
        </Button>
      }
    >
      {error === "" ? null : <p className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-6">
        <AppearanceRow />
        {settings === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <section className="grid gap-3">
              <h3 className="text-sm text-foreground">Files</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each board is its own SQLite file. Override the folder with the{" "}
                <code className="text-foreground">{settings.dataRootEnv}</code> environment
                variable, then restart the studio.
              </p>
              <CopyRow label="Data folder" value={settings.dataRoot} />
              <CopyRow label="Boards folder" value={settings.projectsDir} />
              {settings.boardFile === undefined ? null : (
                <CopyRow label="This board file" value={settings.boardFile} />
              )}
              <p className="text-xs text-muted-foreground">
                {settings.dataRootOverridden
                  ? "Using SCREENSHOT_STUDIO_DATA from the environment."
                  : "Default: .screenshot-studio next to the process working directory."}
              </p>
            </section>
            <section className="grid gap-3">
              <h3 className="text-sm text-foreground">MCP</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Keep this studio running, then add the snippet to Cursor MCP settings (or{" "}
                <code className="text-foreground">.cursor/mcp.json</code>). Agents call tools on the
                same boards you edit here.
              </p>
              <CopyRow label="MCP URL" value={mcpUrl} />
              <CopyRow label="Cursor snippet" value={mcpJson} multiline />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tools: list_boards, get_open_board, get_board, create_board, clone_collection,
                delete_collection, apply_store_rules. get_open_board is the board in the focused
                studio tab. Live updates: GET /api/live?projectId=… (SSE).
              </p>
            </section>
          </>
        )}
      </div>
    </StudioSheet>
  );
}

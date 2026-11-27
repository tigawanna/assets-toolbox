import { listBoards, loadStudio, putStudio } from "@assets/screenshot-studio/desktop/browser-fns";
import type { StudioSnapshot } from "@assets/screenshot-studio/lib/studio";

import { deleteTemplate, listTemplates, saveTemplate } from "./templates/client";
import type { TemplateTool } from "./templates/types";

type WailsRuntime = {
  EventsOn: (event: string, callback: (...data: unknown[]) => void) => () => void;
  EventsEmit: (event: string, ...data: unknown[]) => void;
};

type BridgeArgs = Record<string, unknown>;

async function runBridgeTool(tool: string, args: BridgeArgs): Promise<unknown> {
  const projectId = typeof args.projectId === "string" ? args.projectId : "";
  switch (tool) {
    case "studio.list_boards":
      return { boards: await listBoards() };
    case "studio.get_board":
      return { snapshot: await loadStudio({ data: { projectId } }) };
    case "studio.put_board": {
      const snapshot = args.snapshot as StudioSnapshot | undefined;
      if (!snapshot) throw new Error("snapshot is required");
      return { snapshot: await putStudio({ data: { projectId, snapshot } }) };
    }
    case "templates.list":
      return { templates: await listTemplates(args.tool as TemplateTool) };
    case "templates.save": {
      const name = typeof args.name === "string" ? args.name : "";
      if (!name) throw new Error("name is required");
      return {
        template: await saveTemplate({
          tool: args.tool as TemplateTool,
          name,
          description: typeof args.description === "string" ? args.description : "",
          data: args.data,
        }),
      };
    }
    case "templates.delete":
      return {
        ok: true,
        deleted: await deleteTemplate(typeof args.id === "string" ? args.id : ""),
      };
    default:
      throw new Error(`Frontend bridge does not implement ${tool}`);
  }
}

/** Lets native MCP call tools whose state lives in the WebView. */
export function registerMcpBridge(): () => void {
  const runtime = (window as Window & { runtime?: WailsRuntime }).runtime;
  if (!runtime) return () => undefined;
  return runtime.EventsOn("mcp:request", (...data: unknown[]) => {
    const [id, tool, args] = data as [string, string, BridgeArgs];
    void runBridgeTool(tool, args ?? {})
      .then((result) => runtime.EventsEmit("mcp:response", id, result, null))
      .catch((cause: unknown) =>
        runtime.EventsEmit(
          "mcp:response",
          id,
          null,
          cause instanceof Error ? cause.message : String(cause),
        ),
      );
  });
}

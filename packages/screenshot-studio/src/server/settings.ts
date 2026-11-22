import { join, resolve } from "node:path";

import { projectDatabasePath, studioRoot } from "./connection";

export function studioOrigin(): string {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = process.env.PORT ?? "4320";
  return `http://${host}:${port}`;
}

export function studioSettings(projectId?: string) {
  const dataRoot = resolve(studioRoot());
  const origin = studioOrigin();
  const mcpUrl = `${origin}/mcp`;
  return {
    dataRoot,
    projectsDir: join(dataRoot, "projects"),
    dataRootEnv: "SCREENSHOT_STUDIO_DATA",
    dataRootOverridden: process.env.SCREENSHOT_STUDIO_DATA !== undefined,
    origin,
    mcpUrl,
    mcpConfig: {
      mcpServers: {
        "screenshot-studio": {
          url: mcpUrl,
        },
      },
    },
    boardFile:
      projectId === undefined || projectId === "" ? undefined : projectDatabasePath(projectId),
  };
}

export type StudioSettings = ReturnType<typeof studioSettings>;

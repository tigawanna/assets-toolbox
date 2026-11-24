import type { IncomingMessage, ServerResponse } from "node:http";

export function createWorkspaceApi(options?: {
  databasePath?: string;
}): (
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void | Promise<void>,
) => Promise<void>;

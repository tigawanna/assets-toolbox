import { createFileRoute } from "@tanstack/react-router";

import { handleMcpBody } from "@/server/mcp";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers }),
      GET: async () =>
        Response.json(
          {
            name: "screenshot-studio",
            transport: "streamable-http",
            hint: "POST JSON-RPC 2.0 here after initialize. The studio must stay running.",
          },
          { headers },
        ),
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const reply = await handleMcpBody(body);
        if (reply === null) return new Response(null, { status: 202, headers });
        return Response.json(reply, { headers });
      },
    },
  },
});

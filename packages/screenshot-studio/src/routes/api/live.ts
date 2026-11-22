import { createFileRoute } from "@tanstack/react-router";

import { subscribeLive, type LiveEvent } from "@/server/live";

const encoder = new TextEncoder();

function frame(event: LiveEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
        const stream = new ReadableStream({
          start(controller) {
            const send = (event: LiveEvent) => controller.enqueue(frame(event));
            send({ type: "hello", projectId });
            const stop = subscribeLive(projectId, send);
            const ping = setInterval(() => send({ type: "ping", projectId }), 15000);
            const close = () => {
              clearInterval(ping);
              stop();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            };
            request.signal.addEventListener("abort", close);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});

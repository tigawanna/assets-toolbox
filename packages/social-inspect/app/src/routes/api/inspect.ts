import { createFileRoute } from "@tanstack/react-router";
import { inspectUrl } from "@inspect/index";

interface InspectBody {
  url?: string;
  allowPrivate?: boolean;
}

/**
 * Server route used by the inspector UI. Running the fetch here avoids browser
 * CORS limits and lets the CLI call local dev servers.
 */
export const Route = createFileRoute("/api/inspect")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as InspectBody;
          if (!body.url) {
            return Response.json({ error: "A url is required." }, { status: 400 });
          }
          const report = await inspectUrl(body.url, {
            allowPrivate: body.allowPrivate ?? true,
          });
          return Response.json(report);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});

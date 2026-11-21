import { createFileRoute } from "@tanstack/react-router";
import { readStudio } from "@/server/queries";

/** Node can read the same log the canvas writes: `GET /api/events`. */
export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(readStudio());
      },
    },
  },
});

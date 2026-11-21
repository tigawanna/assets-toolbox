import { createFileRoute } from "@tanstack/react-router";
import { normalizeTarget } from "@inspect/url";

const MAX_BYTES = 8 * 1024 * 1024;

/** Stream a remote image through the local server so the UI can display it. */
export const Route = createFileRoute("/api/asset")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const raw = new URL(request.url).searchParams.get("url") ?? "";
        try {
          const { url } = normalizeTarget(raw);
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; social-inspect/1.0)",
              Accept: "image/*,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) return new Response(null, { status: 502 });

          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength > MAX_BYTES) return new Response(null, { status: 413 });

          return new Response(bytes, {
            headers: {
              "Content-Type": response.headers.get("content-type") || "application/octet-stream",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});

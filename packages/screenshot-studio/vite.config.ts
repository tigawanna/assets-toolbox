import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";

/**
 * Same TanStack Start wiring as agentic-json-resume/apps/web:
 * `vp dev` is the Vite server, `vp build` emits the Node server.
 */
const config = defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4320,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  ssr: {
    external: ["drizzle-orm", "konva", "react-konva", "canvas"],
  },
  optimizeDeps: {
    include: [
      "@tanstack/react-router > @tanstack/react-store",
      "@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
    ],
  },
  plugins: [nitro(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;

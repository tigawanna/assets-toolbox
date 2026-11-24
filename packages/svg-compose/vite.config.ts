import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

/** Client-only SPA — the document is a live SVG DOM, rendered by the browser. */
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4330,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});

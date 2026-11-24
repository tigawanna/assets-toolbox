import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { createWorkspaceApi } from "./server/api.mjs";

const workspaceApi = createWorkspaceApi();

/** Live SVG DOM in the browser; workspace persistence is handled by Node. */
export default defineConfig({
  plugins: [
    react(),
    {
      name: "svg-compose-workspace-api",
      configureServer(server) {
        server.middlewares.use(workspaceApi);
      },
      configurePreviewServer(server) {
        server.middlewares.use(workspaceApi);
      },
    },
  ],
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

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const studioSource = fileURLToPath(
  new URL("../../../packages/screenshot-studio/src/", import.meta.url),
);
const studioBrowserApi = fileURLToPath(
  new URL("../../../packages/screenshot-studio/src/desktop/browser-fns.ts", import.meta.url),
);
const socialAppSource = fileURLToPath(
  new URL("../../../packages/social-inspect/app/src/", import.meta.url),
);
const socialCoreSource = fileURLToPath(
  new URL("../../../packages/social-inspect/src/", import.meta.url),
);
const socialApiTarget =
  process.env.SOCIAL_INSPECT_API_URL ??
  `http://${process.env.SOCIAL_INSPECT_API_ADDR ?? "127.0.0.1:4332"}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@tigawanna/cabra-sound",
        replacement: fileURLToPath(
          new URL("../../../packages/cabra-sound/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@\/server\/fns$/,
        replacement: studioBrowserApi,
      },
      {
        find: /^@\//,
        replacement: studioSource,
      },
      {
        find: "@assets/screenshot-studio",
        replacement: studioSource,
      },
      {
        find: /^@inspect\//,
        replacement: socialCoreSource,
      },
      {
        find: "@assets/social-inspect",
        replacement: socialAppSource,
      },
      {
        find: "@assets/svg-compose",
        replacement: fileURLToPath(new URL("../../../packages/svg-compose/src/", import.meta.url)),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["wails.localhost"],
    proxy: {
      "/api": {
        target: socialApiTarget,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": {
        target: socialApiTarget,
        changeOrigin: false,
      },
    },
  },
  optimizeDeps: {
    include: [
      "@tanstack/react-router > @tanstack/react-store",
      "@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
    ],
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

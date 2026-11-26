import adapter from "@sveltejs/adapter-static";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({
        pages: "build",
        assets: "build",
        fallback: "index.html",
        precompress: false,
        strict: true,
      }),
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: "@tanstack/react-router",
        replacement: fileURLToPath(
          new URL("./src/lib/modules/screenshot-studio/local/router-shim.tsx", import.meta.url),
        ),
      },
      {
        find: "@/server/fns",
        replacement: fileURLToPath(
          new URL("./src/lib/modules/screenshot-studio/local/fns.ts", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src/lib/modules/screenshot-studio", import.meta.url)),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["wails.localhost"],
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});

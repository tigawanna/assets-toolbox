import tsdownConfig from "./tsdown.config.js";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: tsdownConfig,
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5177",
    },
  },
  build: {
    outDir: "dist/app",
    emptyOutDir: false,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});

import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@inspect": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
  plugins: [tanstackStart(), react()],
  server: {
    hmr: { overlay: false },
  },
});

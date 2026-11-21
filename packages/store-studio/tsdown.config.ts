import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["server/cli.ts"],
  outDir: "dist",
  clean: true,
});

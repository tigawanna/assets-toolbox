import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/sizes.ts"],
});

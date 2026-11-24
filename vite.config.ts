import { defineConfig } from "vite-plus";

/**
 * Same Vite+ lint setup as agentic-json-resume.
 * `@shadcn/lint` is the design-system check: raw palette colors, arbitrary
 * values, inline styles, and classes Tailwind cannot generate.
 */
export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist/**", "references/**"],
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    ignorePatterns: ["**/dist/**", "references/**"],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: ["@shadcn/lint"],
    categories: { correctness: "error" },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-nested-ternary": "warn",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
    },
    overrides: [
      {
        files: ["packages/social-inspect/**"],
        rules: {
          "shadcn/no-unknown-classes": "off",
          "shadcn/no-inline-styles": "off",
        },
      },
      {
        // Takumi OG components style with inline objects. That is the render format.
        files: ["packages/brand-assets/**"],
        rules: { "shadcn/no-inline-styles": "off" },
      },
      {
        // Vendored shadcn primitives set width tokens and use the sidebar's own utilities.
        files: ["packages/screenshot-studio/src/components/ui/**"],
        rules: {
          "shadcn/no-inline-styles": "off",
          "shadcn/no-arbitrary-values": "off",
          "shadcn/no-unknown-classes": "off",
        },
      },
      {
        // Canvas overlays use runtime pointer coordinates.
        files: ["packages/screenshot-studio/src/canvas/**"],
        rules: { "shadcn/no-inline-styles": "off" },
      },
      {
        // svg-compose uses hand-written CSS rather than Tailwind utilities.
        files: ["packages/svg-compose/**"],
        rules: { "shadcn/no-unknown-classes": "off" },
      },
    ],
  },
});

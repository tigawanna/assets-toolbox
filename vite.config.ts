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
        // Takumi marketing frames use the same flexbox-in-JS style dialect.
        files: ["packages/play-screenshots/**"],
        rules: { "shadcn/no-inline-styles": "off" },
      },
      {
        // The editor draws with Konva and ships its own stylesheet, not Tailwind.
        files: ["packages/store-studio/**"],
        rules: {
          "shadcn/no-inline-styles": "off",
          "shadcn/no-unknown-classes": "off",
          "shadcn/no-raw-colors": "off",
          "shadcn/no-arbitrary-values": "off",
        },
      },
      {
        // Vendored shadcn primitives set width tokens and use the sidebar's own utilities.
        files: ["packages/screenshot-studio/src/components/ui/**"],
        rules: {
          "shadcn/no-inline-styles": "off",
          "shadcn/no-arbitrary-values": "off",
        },
      },
      {
        // Frame positions are runtime coordinates, not a design-system scale.
        files: ["packages/screenshot-studio/src/components/canvas/**"],
        rules: { "shadcn/no-inline-styles": "off" },
      },
    ],
  },
});

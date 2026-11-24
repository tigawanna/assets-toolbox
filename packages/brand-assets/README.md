# @tigawanna/brand-assets

Generate a complete brand asset set from **one SVG icon path**:

- `favicon.ico` (16/32/48), `favicon-32x32.png`, `favicon-96x96.png`
- `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`
- `og.png` — rendered with [takumi-js](https://github.com/kane50613/takumi) from either the built-in template or **your own React component**
- optionally `site.webmanifest`

Point it at an icon and a component file, and it figures out the rest. The SVG is also injected into the OG component as an `iconDataUrl` prop automatically.

> **Usage guide:** [docs/usage.md](./docs/usage.md) covers every CLI flag, the custom OG component contract, the programmatic API, and troubleshooting. Release notes: [CHANGELOG.md](./CHANGELOG.md).

## Install

```bash
pnpm add -D @tigawanna/brand-assets react
```

`react` is a peer dependency (needed to load your OG component).

## CLI

```bash
# everything from one SVG, using the built-in OG template
pnpm dlx @tigawanna/brand-assets --icon ./public/logo.svg --out ./public \
  --title "My site" --description "Something great" --site-label "My site"

# bring your own OG component
pnpm dlx @tigawanna/brand-assets --icon ./public/logo.svg --out ./public \
  --title "My site" --component ./src/components/og/OgImage.tsx

# just the icons / just the OG image
brand-assets icons --icon ./public/logo.svg --out ./public
brand-assets og --icon ./public/logo.svg --title "My site" --component ./src/og/OgImage.tsx

# also emit site.webmanifest
brand-assets --icon ./public/logo.svg --out ./public --title "My site" --manifest --site-name "My site"
```

Run `brand-assets --help` for all options.

### OG component contract

Your component can be a default export or a named export (`--export-name`). It receives:

| Prop          | Description                                       |
| ------------- | ------------------------------------------------- |
| `title`       | From `--title` (required for OG generation)       |
| `description` | From `--description`                              |
| `siteLabel`   | From `--site-label`                               |
| `iconDataUrl` | `data:image/svg+xml;utf8,...` built from `--icon` |

The file is loaded at runtime with `jiti`, so plain `.tsx` works without a build step. Any props you pass via the `props` option (programmatic API) override the built-in ones.

## Programmatic API

```ts
import {
  generateBrandAssets,
  generateIconSet,
  renderOgImage,
  type OgImageProps,
} from "@tigawanna/brand-assets";

// all at once
const { icons, og, manifest } = await generateBrandAssets({
  icon: "public/logo.svg",
  outDir: "public",
  plate: "#0f100f",
  og: {
    title: "My site",
    component: "./src/og/OgImage.tsx",
  },
  manifest: { name: "My site" },
});

// or piece by piece
await generateIconSet({ icon: "public/logo.svg", outDir: "public" });
await renderOgImage({ icon: "public/logo.svg", title: "My site", outDir: "public" });
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm check-exports
pnpm lint
pnpm fmt
```

Built with `tsdown`, checked with `attw`, formatted/linted with `oxfmt`/`oxlint`, and tested with `vitest` — matching the rest of the `@tigawanna` package toolchain.

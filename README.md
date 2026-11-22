# assets-toolbox

Tools for most of a product’s asset needs: React on the web, React Native, React on the server, then Google Play and App Store listing screenshots.

| Package | What it does |
| --- | --- |
| [`@tigawanna/brand-assets`](./packages/brand-assets) | Favicon set plus an OG image from one SVG icon. Optional custom React OG component. |
| [`@tigawanna/social-inspect`](./packages/social-inspect) | Local inspector for any URL: OG tags, favicons, social cards, scored issues, copyable fixes. |
| [`@tigawanna/expo-assets`](./packages/expo-assets) | Expo app icon, Android adaptive/monochrome icons, splash, web favicon, notification icon, and an `app.json` fragment from one logo. |
| [`@tigawanna/screenshot-studio`](./packages/screenshot-studio) | **MCP.** Local canvas for Google Play and App Store listing screenshots. Boards are SQLite files; clone scene strips per store and export PNGs. Needs **Node.js with `node:sqlite`** (Node 22.12+). |

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm check-types
pnpm lint
pnpm format
pnpm check-exports
pnpm quality
```

```bash
pnpm --filter @tigawanna/brand-assets build
pnpm --filter @tigawanna/social-inspect dev
pnpm --filter @tigawanna/expo-assets build
pnpm --filter @tigawanna/screenshot-studio dev
```

## Quick use

```bash
npx @tigawanna/brand-assets --icon ./public/logo.svg --out ./public \
  --title "My site" --component ./src/og/OgImage.tsx

npx @tigawanna/social-inspect https://example.com

npx @tigawanna/expo-assets --icon ./logo.svg --out ./assets/images \
  --brand-color '#0f100f' --splash-bg '#ffffff' --image-width 200

pnpm --filter @tigawanna/screenshot-studio dev
# http://127.0.0.1:4320  ·  MCP http://127.0.0.1:4320/mcp
npx @tigawanna/screenshot-studio
```

Screenshot studio boards default to `.screenshot-studio/projects/`. See the [package README](./packages/screenshot-studio/README.md).

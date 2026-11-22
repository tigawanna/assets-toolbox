# assets-toolbox

Local-first tools for brand, social, Expo, and store-listing assets. Each package is an `npx` CLI (or a local app) you can run from this pnpm + Turborepo workspace.

Store screenshots used to live in three packages (`play-screenshots`, `appstore-screenshots`, `store-studio`). Those are gone. Play and App Store strips now live in **screenshot studio**.

| Package | What it does |
| --- | --- |
| [`@tigawanna/brand-assets`](./packages/brand-assets) | Favicon set plus an OG image from one SVG icon. Optional custom React OG component. |
| [`@tigawanna/social-inspect`](./packages/social-inspect) | Local TanStack Start inspector for any URL: OG tags, favicons, social cards, scored issues, copyable fixes. |
| [`@tigawanna/expo-assets`](./packages/expo-assets) | Expo app icon, Android adaptive/monochrome icons, splash, web favicon, notification icon, and an `app.json` fragment from one logo. |
| [`@tigawanna/screenshot-studio`](./packages/screenshot-studio) | Local Konva canvas for **Google Play** and **App Store** listing screenshots. Boards are SQLite files. Clone scene strips per store, export PNGs, talk to the same server over MCP. |

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

Per package:

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
# http://127.0.0.1:4320
npx @tigawanna/screenshot-studio
```

Keep screenshot studio running if you want Cursor MCP (`http://127.0.0.1:4320/mcp`). Board files default to `.screenshot-studio/projects/`. Details: [screenshot-studio README](./packages/screenshot-studio/README.md).

## Conventions

- CLI packages build with Vite+ (`vp pack`), keep explicit `exports`, and stay `attw`-clean.
- Screenshot studio is a TanStack Start app (`vp dev` / `vp build`); its bin serves the built output.
- `oxfmt` / `oxlint` (plus `@shadcn/lint` on the studio UI) and `vitest`.
- Generated config is plain JSON so humans and agents read the same file.

## References

- [Expo — splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [Play Console Help — preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [App Store screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)

Node `>=22.12.0` (TanStack Start). Other CLIs also run on Node 20 if you only use those packages.

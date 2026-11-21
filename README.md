# assets-toolbox

A pnpm + Turborepo monorepo for local-first asset generators. Every package is an `npx`-able CLI with a programmatic API, built with `tsdown`, checked with `attw`, and tested with `vitest`.

| Package                                                              | What it does                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@tigawanna/brand-assets`](./packages/brand-assets)                 | Favicon set + OG image from one SVG icon and, optionally, your own React OG component.                                                                                                                           |
| [`@tigawanna/social-inspect`](./packages/social-inspect)             | Boots a local TanStack Start inspector for any URL: OG tags, favicons, social preview cards, scored issues, and copyable agent-ready fixes.                                                                      |
| [`@tigawanna/expo-assets`](./packages/expo-assets)                   | Expo app icon, Android adaptive/monochrome icons, splash icon, web favicon and notification icon from one logo, plus an `app.json` fragment.                                                                     |
| [`@tigawanna/play-screenshots`](./packages/play-screenshots)         | Fit raw app captures to Google Play Console sizes (phone, tablet, feature graphic, …) and write a JSON inventory. Marketing frames are specified in that package's `PLAN.md`.                                    |
| [`@tigawanna/appstore-screenshots`](./packages/appstore-screenshots) | Fit simulator captures to App Store Connect sizes and write a deliver inventory.                                                                                                                                 |
| [`@tigawanna/screenshot-studio`](./packages/screenshot-studio)       | Local TanStack Start canvas for placing Play and App Store screenshot frames. Moves are stored in an event log the Node server can read. `pnpm dev` runs the dev server; the published package starts with Node. |

## Commands

```bash
pnpm install
pnpm build          # turbo → all packages
pnpm test           # turbo → all packages
pnpm check-types
pnpm lint
pnpm format
pnpm check-exports  # attw for every package
pnpm quality        # lint + format + types + tests
```

Per-package work:

```bash
pnpm --filter @tigawanna/expo-assets build
pnpm --filter @tigawanna/social-inspect dev
pnpm --filter @tigawanna/screenshot-studio dev
```

## Quick use

```bash
# brand assets
npx @tigawanna/brand-assets --icon ./public/logo.svg --out ./public \
  --title "My site" --component ./src/og/OgImage.tsx

# social inspector
npx @tigawanna/social-inspect https://example.com

# expo assets
npx @tigawanna/expo-assets --icon ./logo.svg --out ./assets/images \
  --brand-color '#0f100f' --splash-bg '#ffffff' --image-width 200

# play store screenshots
npx @tigawanna/play-screenshots --shot ./shots/home.png --shot ./shots/search.png \
  --preset phone-portrait --feature-graphic --out ./store/google

# screenshot canvas — `vp dev` while iterating, the Node launcher once it's packaged
pnpm --filter @tigawanna/screenshot-studio dev
npx @tigawanna/screenshot-studio
```

## Conventions

- One tsdown build per package, with explicit `exports` so `attw` stays green.
- `oxfmt` / `oxlint` for formatting and linting, `vitest` for tests.
- CLIs are thin; the real logic lives in importable library modules.
- Generated config is written as plain JSON so both humans and coding agents can consume the same artifact.

## References

Expo package:

- [Expo — splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [isalin/expo-icon-generator](https://github.com/isalin/expo-icon-generator) — asset filename/size conventions and adaptive icon guidance
- [WebNaresh/expo-icon-generator](https://github.com/WebNaresh/expo-icon-generator) — sharp-based generation and `app.json` integration

Play screenshots package:

- [Play Console Help — preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Capture screenshots with the Android CLI](https://developer.android.com/google/play/requirements/screenshots-android-cli)

Node `>=22.12.0` (TanStack Start requirement for the inspector; the other packages support `>=20`).

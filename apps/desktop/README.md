# Assets Toolbox desktop app

A Wails + Go desktop application with a React 19 and TanStack Router frontend.
The previous SvelteKit implementation is archived at `apps/desktop-svelte`; it is
not part of the pnpm workspace and is not used by the active desktop build.

## Requirements

- Go 1.26+
- Node.js 22.17+
- pnpm 10.27+
- Wails v2.17.1
- Linux: GTK 3, WebKitGTK 4.1, libsoup 3, and pkg-config

## Develop

From the repository root:

```bash
vp install
pnpm run desktop:dev
```

For browser-only UI work:

```bash
pnpm --filter @assets-toolbox/desktop dev
```

`pnpm run desktop:dev` also starts the headless Social Inspect API used by Vite's
`/api` proxy. Set `SOCIAL_INSPECT_DEV_API=0` to skip it.

The frontend uses one React root and one TanStack Router instance. Browser history
is used for shell and Screenshot Studio board routes; the Go asset server returns
`index.html` for client-side routes while missing assets still return 404.

## Build and test

```bash
pnpm run desktop:build
pnpm --filter @assets-toolbox/desktop test
pnpm --filter @assets-toolbox/desktop typecheck
(cd apps/desktop && go test ./...)
```

The executable is written to `apps/desktop/build/bin/assets-toolbox`.

## Package integration

The desktop does not copy package applications or translate them into another
framework. Vite aliases import the canonical React sources directly:

- `@assets/svg-compose/*` → `packages/svg-compose/src/*`
- `@assets/screenshot-studio/*` → `packages/screenshot-studio/src/*`
- `@assets/social-inspect/*` → `packages/social-inspect/app/src/*`
- `@assets/brand-assets/*` → `packages/brand-assets/src/*`
- `@assets/expo-assets/*` → `packages/expo-assets/src/*`
- `@/server/fns` → Screenshot Studio's IndexedDB-backed browser adapter

SVG Compose keeps its native Go workspace bridge and HTTP/browser fallback.
Screenshot Studio uses IndexedDB in the desktop and real TanStack routes for
board navigation. Social Inspect uses its canonical React page with Go-backed
`/api/inspect` and `/api/asset` handlers. Cabra Sound uses the canonical Web Audio
engine with a native React interface. Expo Assets runs the canonical Sharp
generators in a per-job Node sidecar; Go stages inputs, handles native file
dialogs, validates artifacts, and saves previews or ZIP sets. Native open/save
dialogs remember their last folders in `assets-toolbox/dialogs.json`. Brand Assets
also includes a visual OG card editor for placing text, shapes, and images before exporting a PNG.

## Routes

- `/` — package library
- `/packages/:slug` — package details or integration placeholder
- `/packages/svg-compose` — SVG editor
- `/packages/screenshot-studio` — Studio board list
- `/packages/screenshot-studio/board/:projectId` — Studio editor
- `/packages/social-inspect` — social metadata inspector
- `/packages/brand-assets` — favicon, OG card, and manifest generator
- `/packages/expo-assets` — Expo asset generator
- `/packages/cabra-sound` — sound browser and exporter
- `/settings` — appearance preferences

## Settings

The `/settings` page controls the shell's appearance: theme (`Light`, `Dark`,
`Pitch black`, or `System`, which follows the OS live), **Scale everything**
(root `zoom`, applied through `--ui-scale`), **Scale text only** (a `--text-scale`
multiplier used by every font-size declaration), and a **Colors** section for the
primary accent (presets plus custom), background, and text color. The two scales
are independent and combine multiplicatively. The accent is written to `--accent`
and picked up by the shell and the embedded tool stylesheets, which derive their
highlight and focus tokens from it. Custom background and text colors set
`--canvas` and `--text` plus `data-custom-bg` / `data-custom-text` attributes;
the remaining palette is derived from them only while those preferences exist,
so default themes stay as authored. **Reset to system defaults** clears every
preference. The sidebar theme button cycles light → dark → pitch black → light.

Preferences are saved in local storage and applied by the pre-hydration script in
`frontend/index.html`, so they take effect before React mounts. Keep the storage
keys, defaults and clamping in that script in sync with `src/lib/theme.ts`.

## App icon

The source artwork is `appicon.svg`. It is copied to
`frontend/public/app-icon.svg` for the UI (sidebar brand mark and favicon), and
`build/appicon.png` is the 512×512 raster Wails uses to generate the platform
app icons during `wails build`. Keep the PNG in sync when the SVG changes.
`main.go` also embeds that PNG for the Linux window icon and the macOS About
dialog.

## Persistence

SVG Compose stores its native draft under the desktop config directory and mirrors
it to workspace-namespaced local storage. Screenshot Studio boards use IndexedDB.
The Go close-time flush handshake waits for active editors to acknowledge durable
writes before quitting.

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
- `@/server/fns` → Screenshot Studio's IndexedDB-backed browser adapter

SVG Compose keeps its native Go workspace bridge and HTTP/browser fallback.
Screenshot Studio uses IndexedDB in the desktop and real TanStack routes for
board navigation. Social Inspect uses its canonical React page with Go-backed
`/api/inspect` and `/api/asset` handlers. Cabra Sound uses the canonical Web Audio
engine with a native React interface.

## Routes

- `/` — package library
- `/packages/:slug` — package details or integration placeholder
- `/packages/svg-compose` — SVG editor
- `/packages/screenshot-studio` — Studio board list
- `/packages/screenshot-studio/board/:projectId` — Studio editor
- `/packages/social-inspect` — social metadata inspector
- `/packages/cabra-sound` — sound browser and exporter

## Persistence

SVG Compose stores its native draft under the desktop config directory and mirrors
it to workspace-namespaced local storage. Screenshot Studio boards use IndexedDB.
The Go close-time flush handshake waits for active editors to acknowledge durable
writes before quitting.

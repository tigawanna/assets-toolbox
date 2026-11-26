# Assets Toolbox desktop shell

A Wails + Go desktop application with a SvelteKit frontend. SVG Compose, Cabra
Sound, and Screenshot Studio are mounted as working tools. The remaining packages
in `packages/` have stable route placeholders, ready for their real UIs.

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

The command starts Vite, generates Wails bindings, and opens the native window.
SVG Compose uses the bound Go workspace methods in both development and packaged
builds; browser previews retain the HTTP/local-storage fallback.
Use `Ctrl+B` (`Cmd+B` on macOS) to collapse or expand the root workspace
sidebar. Inside SVG Compose, `[` toggles the tool rail, `]` toggles the
inspector, and `Shift+?` opens the keyboard shortcut dialog. The root
`pnpm run desktop:dev` and `pnpm run desktop:build` scripts use
`scripts/desktop.mjs` to run Wails from the Go module directory on every platform.
You can also run the frontend by itself for browser-based UI work:

```bash
pnpm --filter @assets-toolbox/desktop-ui dev
```

## Build

```bash
pnpm run desktop:build
```

The executable is written to `apps/desktop/build/bin/assets-toolbox`.
Turborepo also understands the Go module. These commands exercise the same tasks
used by the repository-wide build:

```bash
pnpm exec turbo run build --filter=desktop
pnpm exec turbo run test --filter=desktop
pnpm exec turbo run lint --filter=desktop
```

`go.work` enables Turborepo's experimental Go workspace discovery. The desktop
build depends on `@assets-toolbox/desktop-ui#build`, so the SvelteKit bundle is
embedded before Wails compiles the binary.

## Data storage

SVG Compose stores its native draft in `workspace.json` under the desktop config
directory. `SVG_COMPOSE_DATA` can override the directory. This file is separate
from the Node package's `.svg-compose/workspace.sqlite`; there is no automatic
SQLite migration, so use a new directory when evaluating the desktop app.
Browser backups are namespaced by the native workspace path. Screenshot Studio
boards use browser IndexedDB storage.

## Mounting a package

1. Copy the package UI into this frontend for the first pass.
2. Add its component under `src/lib/modules/<package>/`.
3. Add a static route at `src/routes/packages/<package>/` so it takes precedence
   over the generic `[slug]` placeholder.
4. Keep `src/lib/catalog.ts` as the source of truth for shell metadata and mark the
   package as `mounted`.

The shell intentionally does not import the remaining package applications yet.
This keeps their Vite, React, and server dependencies isolated until each mount
is designed. SVG Compose is mounted as a scoped React island; Cabra Sound reuses
the lifted Web Audio engine through a native Svelte interface. Screenshot Studio
uses a browser-local snapshot adapter, so its editor, history, and export work
without a Node sidecar. Its MCP and SSE server endpoints are not available in
this embedded mode.

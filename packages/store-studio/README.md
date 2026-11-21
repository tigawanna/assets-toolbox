# @tigawanna/store-studio

A local, template-driven screenshot editor for **Google Play** and the **Apple App Store**. One continuous wide canvas is cut into slices; each slice exports as a store-legal PNG. Devices, glows and backgrounds can run across slice edges, which produces the "fades into the next shot" look.

```bash
npx @tigawanna/store-studio store/studio --open
```

The project directory holds `project.json` and `assets/`. The editor binds to `127.0.0.1` and refuses any path outside that directory.

## What works today

- **Boards and slices** in output pixels. A phone board is `1080×1920 × N`; slice `i` covers `x ∈ [i·W, (i+1)·W)`. Nodes belong to the board, so a tilted device can straddle a cut.
- **Devices** with pinned screenshots: punch-hole phone, flat phone, tablet, foldable (open/cover), laptop, browser, monitor, and iPhone/iPad variants. The capture lives in screen-local space, so moving or rotating the device cannot un-pin it. Crop ghost, dashed source bounds and crop percentages are visible on the selected device.
- **Editing**: Konva `Transformer`, multi-select, snapping to slice edges, layers panel, undo/redo (one step per gesture), arrow-key nudge, overlaid textarea for text, theme tokens, glows/fades/shapes/images, live lint panel and a store preview with gaps.
- **Workspace**: drag the **Canvas ⠿** bar to pan just the board (the stage); the toolbar and slice strip stay put. **Dock** returns it. Every panel header has a collapse arrow, and the ◧ / ◨ buttons in the top bar hide the left and right sidebars entirely.
- **Templates**: `text-top`, `aurora-panorama`, `full-bleed`, `duo-overlap`, `split-landscape`, and two feature-graphic layouts. "Generate all boards" re-lays out the same copy for phone, tablet, foldable, Chromebook and feature graphic rather than letterboxing a phone capture.
- **Export**: exact-size, flattened PNG/JPEG through the same `sharp` path as `play-screenshots`, with flat/fastlane/deliver layouts, the JSON inventory and an optional ZIP download.
- **Two hosts**: HTTP (`npx`) and an in-memory fake (tests). The Wails binding is a stub until the desktop app; `getHost()` switches on `window.runtime`.

## Architecture

```
server/                     HTTP host only — Hono, sharp, disk. Never imported by src/.
src/
  data-access-layer/        the ONLY code allowed to touch a host
    host/                   types, http, wails (stub), memory, getHost()
    project assets export   DAL functions the UI calls
    collections.ts          TanStack DB collections; queryFns call the DAL
  model/                    zod schema (single source of truth), geometry, migrate
  session/                  zustand: selection, viewport, history (ephemeral)
  canvas/                   StudioStage, BoardRenderer, nodes, overlays
  devices/                  parametric vector catalog + frames
  templates/                families, factory, registry
  panels/                   editor panels
  render/                   offscreen slice renderer, fonts, palette, zip
  lint/                     pure lint rules
skills/store-studio/         agent skill + CREDITS.md
```

**Import rule.** UI folders may import from `data-access-layer` and `model` only — never from `host/*`, `server/`, or `fetch`/`window.go`/`window.runtime`. That seam is the whole Wails migration strategy: only `host/wails.ts` and a new Go package change when the desktop app lands.

**Two stores.** The document lives in TanStack DB collections with live queries; zustand holds only selection, viewport, tool and undo stack. Persistence is a debounced adapter in the DAL that serialises the document and calls `host.writeProject`.

**One renderer.** `BoardRenderer` is a pure `(board, tokens) → Konva tree`. The viewport wraps it with interaction; export mounts it into a fresh offscreen stage sized exactly `W × H` with the board offset by `-i·W`, so view zoom never affects output and no 20 000px canvas is allocated.

## Host contract

| Method         | Route                     |
| -------------- | ------------------------- |
| `readProject`  | `GET /api/project`        |
| `writeProject` | `PUT /api/project`        |
| `importAsset`  | `POST /api/assets`        |
| `assetUrl`     | `GET /api/assets/:file`   |
| `exportSlice`  | `POST /api/export/slice`  |
| `finishExport` | `POST /api/export/finish` |
| `subscribe`    | `GET /api/events` (SSE)   |

Pure policy checks (dimensions, banned words, alt length, counts, inventory paths) come from `@tigawanna/play-screenshots/policy` and run in the webview. Byte-level checks (flatten, alpha, file size) run in the host with `sharp`, because `sharp` cannot run inside a Wails webview. App Store projects use `@tigawanna/appstore-screenshots`.

## CLI

```
store-studio [projectDir] [--port 5177] [--open]
```

Built with Vite + React 19, react-konva, TanStack DB, zustand, zod, Hono and sharp. See [`CREDITS.md`](./skills/store-studio/CREDITS.md) for the two reference projects this work acknowledges.

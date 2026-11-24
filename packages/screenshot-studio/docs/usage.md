# @tigawanna/screenshot-studio — usage guide

A local canvas for Google Play and App Store listing screenshots. Boards are SQLite files on disk; scene strips can be cloned per store and exported as PNGs. This page expands the [README](../README.md).

> **MCP status:** the `/mcp` endpoint is experimental and not production ready. See [docs/mcp.md](./mcp.md) before relying on it.

## Requirements

- **Node.js 22.12+** — the server uses `node:sqlite`, which is still an experimental Node feature.
- A browser on the same machine (default bind is `127.0.0.1`).
- No external database or cloud service: board data lives in local `.sqlite` files.

## 1. Run it

```bash
# from npm
npx @tigawanna/screenshot-studio

# from a source checkout
pnpm --filter @tigawanna/screenshot-studio dev   # http://127.0.0.1:4320
```

### CLI options

| Flag / env                 | Default                    | Notes                         |
| -------------------------- | -------------------------- | ----------------------------- |
| `--port <n>`, `-p`, `PORT` | `4320`                     | Port for the built server.    |
| `--host <host>`, `HOST`    | `127.0.0.1`                | Bind address.                 |
| `--no-open`                | off                        | Do not open a browser window. |
| `SCREENSHOT_STUDIO_DATA`   | `<cwd>/.screenshot-studio` | Override the data folder.     |
| `-h, --help`               | —                          | Print help.                   |

The published `screenshot-studio` binary spawns the prebuilt `.output/server/index.mjs` from the tarball. The source-checkout `dev` script runs Vite directly.

## 2. Editor workflow

1. **Create a board** from the landing list. Set size and slice count — these apply to the **active scene strip**, not the whole project.
2. **Place devices and text.** Drop Play and App Store devices on the same strip if one layout serves both stores. **Phones · both stores** stacks a pair.
3. **Clone per store.** Right-click a strip title bar for **Duplicate strip** or **Delete strip**. The header **Clone** can retarget Apple / Android; the home **Clone** duplicates the whole board file. The last remaining strip cannot be deleted.
4. **Arrange.** Drag the strip title bar to move a collection; ordinary drag moves devices and text. **Recenter** (or `0`) fits every strip back into view after zooming/panning.
5. **Style slices.** Click a numbered slice to give it its own fill. Rename the strip in the header or inspector.
6. **Export.** **Export** zips every scene strip on the board as PNGs.

## 3. Where files live

```
.screenshot-studio/
  projects/
    <board-id>.sqlite     # strips, layers, assets, and event log for one board
```

Each board is one self-contained SQLite file — copy it to share a board, or point `SCREENSHOT_STUDIO_DATA` at a different folder to keep work separated. **Settings** on the board list (or inside a board) shows the live paths. Changing the data folder requires a restart.

## 4. Live updates

`GET /api/live?projectId=<id>` is an SSE stream. Open a board in the browser, subscribe with `curl`, then mutate it from the UI (or from MCP — see [mcp.md](./mcp.md)) to receive events like:

```json
{ "type": "change", "projectId": "606e334d", "seq": 12, "label": "clone_collection" }
```

## 5. Troubleshooting

- **"Screenshot Studio has not been built"** — the published binary expects `.output/server/index.mjs`. From a source checkout run `pnpm build` in this package first.
- **`node:sqlite` warning** — expected on Node 22.12+; the module is experimental and its API may change between Node versions.
- **Port clash** — pass `--port 4321` (or set `PORT`); copy URLs from **Settings** rather than guessing when you change host/port.
- **Board does not appear after copying a `.sqlite`** — put it under `<data root>/projects/` and restart the studio so the file watcher picks it up.
- **Export looks empty** — export writes every scene strip of the currently open board; make sure the board has at least one device or text layer.

Status and release notes: [CHANGELOG.md](../CHANGELOG.md).

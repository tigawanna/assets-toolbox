# Desktop shell pilot: Wails + Go for svg-compose

**Status (2026-11-25):** the pilot builds, runs, saves through Go, survives close/reopen, and passes a shared Node/Go HTTP contract suite. Phase 2 (embeddable component), native dialogs, and the launcher are still open.

Goal: serve the existing tool UI unchanged in a small desktop app, keeping relative-URL HTTP as the UI/backend contract. Start with `svg-compose`; expand only after the pilot remains reliable.

## What exists now

- `desktop/` is a standalone Go module using Wails v2.17.1 and `modernc.org/sqlite`.
- `desktop/main.go` embeds `desktop/frontend/svg-compose/` and routes `/api/*` to Go before Wails serves static files.
- `desktop/internal/svgcompose/` ports the Node workspace API and SQLite storage.
- `desktop/scripts/build-frontend.sh` builds the existing Vite SPA and copies `dist/` into the embed directory.
- `desktop/scripts/test-contract.mjs` runs the same black-box suite against Node and a tiny Go server, including restart persistence.
- `packages/svg-compose/src/lib/desktop.ts` adds a browser-safe Wails close-flush bridge. Browser mode does nothing when `window.runtime` is absent.

## Quick start

Prerequisites:

- Go 1.26+ (tested with 1.27.1)
- Node 22.12+ and pnpm 10.27
- Wails v2.17.1
- Linux: GTK 3, WebKitGTK 4.1, libsoup 3, compiler and pkg-config

```bash
vp install
go install github.com/wailsapp/wails/v2/cmd/wails@v2.17.1
export PATH="$PATH:$(go env GOPATH)/bin"

# Debian/Ubuntu/Zorin
sudo apt install build-essential pkg-config libgtk-3-dev \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev

cd desktop
./scripts/wails.sh build -trimpath -ldflags "-s -w"
./build/bin/assets-toolbox

# Development
./scripts/wails.sh dev
```

`wails.json` already applies the required `webkit2_41` tag and runs the frontend build. Do not use `wails build -s` when rebuilding normally: in Wails v2, `-s` means **skip frontend**, not strip.

Useful checks:

```bash
# From the repository root
pnpm --filter @tigawanna/svg-compose test
pnpm --filter @tigawanna/svg-compose typecheck
(cd desktop && go test ./...)
pnpm run desktop:contract

# Headless Go API, useful for curl/debugging
(cd desktop && go run ./cmd/contract-server \
  -addr 127.0.0.1:4331 \
  -database /tmp/assets-toolbox-workspace.sqlite)
```

### This Linux machine: no-sudo WebKit staging

Zorin 18 had the WebKitGTK 4.1 runtime installed but not its development `.pc` files, and passwordless sudo was unavailable. The packages were staged without root:

```bash
mkdir -p /tmp/opencode/wails-debs /tmp/opencode/wails-sysroot
cd /tmp/opencode/wails-debs
apt-get download libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
  libwebkit2gtk-4.1-0 libjavascriptcoregtk-4.1-0
for package in *.deb; do dpkg-deb -x "$package" /tmp/opencode/wails-sysroot; done

sysroot=/tmp/opencode/wails-sysroot
sed -i "s|^prefix=/usr$|prefix=$sysroot/usr|" \
  "$sysroot"/usr/lib/x86_64-linux-gnu/pkgconfig/*4.1.pc
sed -i "s|^libdir=/usr/lib/x86_64-linux-gnu$|libdir=$sysroot/usr/lib/x86_64-linux-gnu|" \
  "$sysroot"/usr/lib/x86_64-linux-gnu/pkgconfig/*4.1.pc

export PKG_CONFIG_PATH="$sysroot/usr/lib/x86_64-linux-gnu/pkgconfig"
export LD_LIBRARY_PATH="$sysroot/usr/lib/x86_64-linux-gnu"
```

`wails doctor` still reports `libwebkit` missing because it checks dpkg rather than `pkg-config`; the staged headers and libraries are sufficient for `wails build`. A normal apt install avoids this workaround. Use `./scripts/wails.sh dev` or `./scripts/wails.sh build ...` to automatically export the staged paths.

## Architecture

Keep HTTP as the contract; do not rewrite the UI to call Wails bindings for persistence.

- **Browser/Node mode:** Vite middleware or `server/index.mjs` serves `dist/` and `/api/workspace`.
- **Desktop mode:** Wails serves the same embedded `dist/`; middleware intercepts `/api/*` and dispatches to the Go handler.
- The frontend remains root-hosted. Vite `base` stays `/`; `/assets/...` and `/api/workspace` work without frontend URL changes.
- Wails discovers the directory containing `index.html` and roots the embedded FS there. A future multi-tool shell should use explicit `fs.Sub` roots.
- SQLite opens lazily, uses WAL, and serializes access through one connection.

Important files:

| File                                      | Responsibility                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `desktop/main.go`                         | Wails window, embedded assets, API middleware, close-flush handshake |
| `desktop/internal/svgcompose/handler.go`  | `/api/workspace` HTTP behavior                                       |
| `desktop/internal/svgcompose/storage.go`  | Schema, validation, JS-compatible normalization, SQLite              |
| `desktop/cmd/contract-server/main.go`     | Headless Go server for contract tests                                |
| `desktop/scripts/test-contract.mjs`       | Shared Node/Go black-box suite                                       |
| `packages/svg-compose/src/lib/desktop.ts` | Feature-detected Wails event bridge                                  |
| `packages/svg-compose/src/App.tsx`        | Awaits pending save when the shell requests a flush                  |

## Storage location

Desktop default:

```text
os.UserConfigDir()/assets-toolbox/svg-compose/workspace.sqlite
```

On Linux this normally resolves under `$XDG_CONFIG_HOME` or `~/.config`.

`SVG_COMPOSE_DATA` remains a **directory** override, including when set to an empty string:

```bash
SVG_COMPOSE_DATA=/tmp/my-workspace ./desktop/build/bin/assets-toolbox
```

The desktop database is intentionally separate from Node's package/CWD `.svg-compose/workspace.sqlite`. No migration exists yet.

## Exact workspace contract

Route: exactly `/api/workspace`; query strings are ignored. Every API response has:

```text
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

| Method         | Result                                                       |
| -------------- | ------------------------------------------------------------ |
| `GET`          | `200 {"document":null}` or the saved draft                   |
| `PUT` / `POST` | Validate and upsert the draft, return `200 {"document":...}` |
| Anything else  | `405 {"error":"Method not allowed"}`                         |

Errors:

- Invalid JSON: `400 {"error":"Invalid JSON"}`
- Missing/non-string `svg`: **500** `{"error":"svg must be a string"}` (matches Node, not a more conventional 400)
- SVG over 8 MiB: `500 {"error":"Document is too large to save (8 MB limit)"}` when storage is called directly
- Raw request body over 8 MiB: Go returns a deterministic `413 {"error":"Request body exceeds 8 MB"}`; Node destroys the stream and clients may see a reset. This is the one intentional desktop-only HTTP difference.

Success shape and field order:

```json
{
  "document": {
    "id": "draft",
    "name": "Untitled",
    "svg": "<rect/>",
    "viewport": { "zoom": 1, "tx": 0, "ty": 0 },
    "updatedAt": "2026-11-25T12:34:56.789Z"
  }
}
```

Normalization details that matter:

- Client `id` and `updatedAt` are ignored.
- Names use ECMAScript whitespace trimming; blank names become `Untitled`.
- Viewport fields use JavaScript `Number()` semantics, including strings, booleans, null, arrays, radix prefixes and all-or-nothing fallback.
- Node runs `JSON.stringify(viewport)` before coercion. A numeric overflow such as `1e400` becomes `null` and then `0`; the string `"1e400"` becomes Infinity and resets the whole viewport.
- Negative zero is stored as zero.
- Timestamps are UTC with exactly millisecond precision.
- Responses disable Go HTML escaping so SVG `<`, `>` and `&` match `JSON.stringify`.
- The server stores SVG markup as-is; it does not parse or sanitize it.

Schema:

```sql
CREATE TABLE IF NOT EXISTS workspace (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  svg text NOT NULL,
  viewport text NOT NULL DEFAULT '{}',
  updated_at text NOT NULL
);
```

Only the row with `id = 'draft'` is used.

## Close-time persistence finding and fix

Real Linux/Wails test result:

1. Start with empty SQLite and isolated WebKit storage.
2. Draw a rectangle.
3. Click the window close button before the 900 ms autosave debounce.
4. The existing Blob-backed `navigator.sendBeacon("/api/workspace", ...)` **did not reach Go** before shutdown. SQLite remained empty.

This matches the known risk around Blob bodies in Wails' WebKitGTK bridge. The pilot now uses an explicit handshake:

1. `OnBeforeClose` prevents the first close and starts an asynchronous flush.
2. Go emits `workspace:flush`.
3. The React app awaits `persistNow()` and emits `workspace:flushed`.
4. Go calls `runtime.Quit()` after the acknowledgement, or after a 3-second safety timeout.

The close callback must not block the GTK main loop; doing so prevents the event and HTTP request from progressing. Browser mode still uses the existing localStorage mirror and best-effort beacon.

Validated: draw + close inside the debounce window writes the rectangle to SQLite and exits cleanly.

Remaining risk: Wails' SIGINT/SIGTERM path was observed to reach shutdown without a reliable frontend acknowledgement and can wait for the timeout. Normal window close is validated; OS-signal shutdown needs separate handling if required.

## Validation record

Executed on 2026-11-25:

| Check                                            | Result                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `pnpm --filter @tigawanna/svg-compose test`      | 87 tests passed                                          |
| `vp run test`                                    | 159 tests passed across all 5 packages                   |
| `pnpm --filter @tigawanna/svg-compose typecheck` | Passed                                                   |
| `vp check --no-fmt`                              | No lint or type errors in 170 files                      |
| Targeted `vp check`                              | All changed JS/TS/JSON/Markdown files passed             |
| `cd desktop && go test ./...`                    | 14 Go test functions passed                              |
| `cd desktop && go vet ./...`                     | Passed                                                   |
| `pnpm run desktop:contract`                      | Node and Go suites passed, including restart persistence |
| `wails build -trimpath -ldflags "-s -w"`         | Passed with Wails v2.17.1 / Go 1.27.1                    |
| Real UI draw through X11 input                   | Rectangle created; Go `PUT` observed; SQLite row written |
| Close and reopen                                 | Rectangle restored; inspector showed `Saved locally`     |
| Close before debounce with handshake             | Rectangle written to SQLite; clean exit                  |
| Default Wayland launch                           | Window reached DOM ready successfully                    |

Measurements:

- Binary: **13,686,760 bytes** (about **13.1 MiB**), stripped.
- Startup to `OnDomReady`: **316–372 ms** across three runs; an earlier first run was 526 ms.
- Target was under about 15 MB: met.

Tooling note: X11 `xwd`/ffmpeg capture showed the GTK frame but not WebKit's rendered surface on this machine. DOM inspection through temporary Wails runtime logging confirmed the full React UI and restored document. Use compositor capture or DOM/accessibility inspection for future visual checks.

Full `vp check` is currently blocked only by pre-existing formatting in `VERIFICATION.md`; `vp check --no-fmt` and the targeted changed-file check pass. Direct `vp test` from the repository root also uses the wrong Vitest config; use the Turbo-backed `vp run test` (or `pnpm test`).

## Phase status

- [x] **Phase 0:** toolchain, embedding spike, window launch.
- [x] **Phase 1:** Go API/storage port, WAL, data path, middleware routing.
- [ ] **Phase 2:** library/component entry, `apiBase`, CSS scoping.
- [x] **Phase 3:** shared contract suite and headless Go server.
- [~] **Phase 4:** size/startup measured; launcher and native dialogs remain.

The contract suite is an explicit root script rather than a Turbo task because `desktop/` is intentionally not a pnpm workspace package and the suite requires Go. Add a dedicated CI job instead of making every JS-only test run require Go.

## Next actions

1. Add CI coverage for `go test ./...`, `desktop:contract`, and the Linux Wails build.
2. Test normal close/reopen and the flush handshake on Windows and macOS.
3. Decide whether OS-signal shutdown needs a durable flush path.
4. Add native import/export dialogs behind `window.go` feature detection, keeping browser download/upload fallbacks.
5. Add a minimal launcher only after the single-tool window is stable.
6. Start Phase 2: export `<SvgCompose apiBase storageKey />`, add a library build, and scope the global stylesheet. A root class alone is insufficient because the CSS styles `:root`, `*`, `html`, `body`, `#root` and `button`.
7. Add contract coverage for U+2028/U+2029 if byte-exact JSON parity becomes important; Go's encoder still escapes those two separators while modern JavaScript emits them literally.

## Go/no-go criteria

- [x] Desktop build passes the shared contract suite.
- [x] Save, reload, close-and-reopen and close-before-debounce keep the document.
- [x] Node/browser flow still builds and its tests pass.
- [x] Binary size and startup are acceptable.
- [ ] Windows/macOS smoke tests.
- [ ] Native dialog and launcher UX decisions.

## Corrections to the original assumptions

- `svg-compose` is documented as private/local-only and has no `bin`; call the current mode local pnpm/Node, not `npx`.
- Wails v2.17.1 requires Go 1.26+.
- `frontend:dir` does not build the SPA; the explicit copy script is required.
- Invalid snapshots return 500, not 400.
- Oversized Node requests do not have a reliable JSON response.
- Viewport coercion includes a `JSON.stringify` step; numeric overflow becomes zero.
- Root-class CSS scoping is not enough for an embeddable component.
- localStorage is a real fallback but shares the WebView origin across desktop data directories; isolate `XDG_DATA_HOME` during persistence tests.

## Expansion order after the pilot

1. **social-inspect:** make TanStack Start emit a static SPA, port scoring with golden fixtures, and proxy `/api/asset` from Go.
2. **brand-assets / expo-assets:** decide between native rendering libraries and a Node/Bun single-binary sidecar.
3. **screenshot-studio:** SPA-ify the app and port the event-log reader last.

## Out of scope for the pilot

Auto-update, code signing, installers, multi-window, and publishing desktop packages.

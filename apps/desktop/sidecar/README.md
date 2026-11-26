# Asset sidecar

One-shot Node worker used by the desktop app to generate either an Expo
icon/adaptive/splash set (`tool: "expo"`) or a brand set of favicons, OG image,
and web manifest (`tool: "brand"`). Generation is delegated to the canonical
built APIs `@tigawanna/expo-assets` (`generateExpoAssets`) and
`@tigawanna/brand-assets` (`generateBrandAssets`); this worker only validates
the request, stages inputs, and maps results back to project-relative paths.

```sh
node src/worker.mjs        # reads one JSON request from stdin (CWD = project root)
node scripts/test-worker.mjs
```

The package depends on both generators with `workspace:*`, so they must be
linked by the workspace install before running.

## Request

```json
{
  "tool": "expo",
  "jobId": "job-1",
  "root": "/absolute/project/root",
  "inputs": {
    "icon": "inputs/icon.svg",
    "darkIcon": "inputs/dark.svg",
    "tintedIcon": "inputs/tinted.svg"
  },
  "options": {
    "brandColor": "#123456",
    "splashBackground": "#ffffff",
    "imageWidth": 200,
    "foregroundSize": 660,
    "splashLogoSize": 620,
    "noMonochrome": false,
    "writeConfig": true
  },
  "outDir": "out"
}
```

For `tool: "brand"`, use `inputs: { "icon": "inputs/logo.svg" }` and options
`plate` (3/6-digit hex), `copySvg` (boolean), `og` and `manifest`. Set
`og.enabled: true` to render `og.png`; `og` accepts a nonblank `title` plus
optional `description`, `siteLabel`, `width` and `height` (integers 64..4096).
Set `manifest.enabled: true` to write `site.webmanifest`; `manifest` accepts
optional `name`, `shortName`, `themeColor`, `backgroundColor`, `startUrl` and
`display`. Unknown keys are rejected. An empty font list is tried first for OG
rendering; if it fails, the worker retries without explicit fonts and logs a
warning to stderr (`ASSET_SIDECAR_FORCE_FONT_FAILURE=1` forces this path in
tests).

Paths are relative to `root`; the worker also ensures its CWD is `root` so the
generated config keeps `./out/...` paths. Options are optional but strictly
typed: colors must be 3- or 6-digit hex, sizes are positive integers (`<= 4096`),
booleans must be booleans, and unknown keys are rejected. Input paths must be
relative with no traversal segments, and each source must be a regular,
non-symlink file of at most 8 MiB. Requests are capped at 1 MiB.

## Response

Exactly one JSON line is written to stdout; diagnostics go to stderr.

```json
{
  "ok": true,
  "tool": "expo",
  "artifacts": [
    { "name": "icon.png", "path": "out/icon.png", "bytes": 123, "width": 1024, "height": 1024 }
  ],
  "config": { "expo": {} },
  "configPath": "out/expo-assets.config.json",
  "agentPrompt": "..."
}
```

`tool` is `"expo"` or `"brand"`; for brand requests `config` is the parsed
`site.webmanifest` JSON and `configPath` points at it. `configPath` is `null`
when no config/manifest is written (including when `writeConfig` is false for
Expo). All paths (including those in `agentPrompt`) are relative to `root`.

Errors use the same single-line shape:

```json
{ "ok": false, "error": "message", "code": "VALIDATION" }
```

Codes: `PROTOCOL` (stdin/JSON/shape, 10 s timeout), `VALIDATION` (options, paths,
symlinks, oversized files), `INPUT` (missing/unreadable files), `GENERATION`
(canonical API failure, 60 s timeout).

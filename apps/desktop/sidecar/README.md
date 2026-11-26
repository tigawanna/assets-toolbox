# Expo asset sidecar

One-shot Node worker used by the desktop app to generate an Expo icon/adaptive/splash set.
Generation is delegated to the canonical built API `@tigawanna/expo-assets`
(`generateExpoAssets`); this worker only validates the request, stages inputs, and
maps results back to project-relative paths.

```sh
node src/worker.mjs        # reads one JSON request from stdin (CWD = project root)
node scripts/test-worker.mjs
```

The package depends on `@tigawanna/expo-assets` with `workspace:*`, so it must be
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

`configPath` is `null` when `writeConfig` is false. All paths (including those in
`agentPrompt`) are relative to `root`.

Errors use the same single-line shape:

```json
{ "ok": false, "error": "message", "code": "VALIDATION" }
```

Codes: `PROTOCOL` (stdin/JSON/shape, 10 s timeout), `VALIDATION` (options, paths,
symlinks, oversized files), `INPUT` (missing/unreadable files), `GENERATION`
(canonical API failure, 60 s timeout).

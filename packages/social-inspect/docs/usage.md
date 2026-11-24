# @tigawanna/social-inspect — usage guide

A local Open Graph / social preview inspector. It fetches pages from a tiny local server, so there are no CORS limits and nothing is uploaded to a third party. This page expands the [README](../README.md) with the full CLI, API, and troubleshooting notes.

## Requirements

- **Node.js 22.12+**
- An internet connection for remote URLs (local dev URLs work offline).
- A browser on the same machine — the CLI binds to `127.0.0.1` by default.

## 1. Run it

```bash
# one-off, no install
npx @tigawanna/social-inspect

# inspect a URL on startup
npx @tigawanna/social-inspect https://example.com

# preview your own dev server
npx @tigawanna/social-inspect http://localhost:3000 --port 4310
```

The CLI starts a Vite/TanStack Start app rooted at the packaged `app/` folder and opens `http://127.0.0.1:4310` unless `--no-open` is set. Press `Ctrl+C` to stop.

### CLI options

| Flag              | Default     | Notes                                                       |
| ----------------- | ----------- | ----------------------------------------------------------- |
| `-u, --url <url>` | —           | URL to inspect on startup. A bare positional URL works too. |
| `-p, --port <n>`  | `4310`      | Preferred port; Vite picks another if it is busy.           |
| `--host <host>`   | `127.0.0.1` | Bind address. Keep it on loopback.                          |
| `--no-open`       | off         | Do not open a browser window.                               |
| `-h, --help`      | —           | Print help.                                                 |

### What the UI shows

| Panel           | Contents                                                                           |
| --------------- | ---------------------------------------------------------------------------------- |
| Social previews | Google, X/Twitter, Facebook, Discord, LinkedIn, WhatsApp, Slack, Telegram          |
| Assets          | OG image with real dimensions, every favicon/touch icon, dimensions and file sizes |
| Meta tags       | Normalized table plus one-click **Copy all** of the raw tags                       |
| Checks          | Weighted score out of 100 with actionable issues and copyable fixes                |

Remote URLs are guarded against private-network addresses (SSRF protection). Localhost and private addresses passed as the target are always allowed so you can preview your own dev server.

## 2. How it works

The npm tarball contains a small compiled CLI (`dist/cli.mjs`) plus the bundled app (`app/`). On startup the CLI runs Vite in dev mode with that app as its root. The app exposes two server routes:

| Route                  | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `POST /api/inspect`    | Fetch target HTML, parse with `cheerio`, and score it.                    |
| `GET /api/asset?url=…` | Stream a remote image through the local server so previews can render it. |

Parsing, scoring, and inspection live in `src/` and are shared between the UI and the programmatic API — the app is a view over the same functions.

## 3. Programmatic API

```ts
import {
  inspectUrl,
  normalizeTarget,
  resolveAsset,
  analyze,
  parsePage,
  buildAgentBrief,
} from "@tigawanna/social-inspect";

const report = await inspectUrl("https://example.com", {
  timeout: 10_000,
  // userAgent: "my-bot/1.0",
  // allowPrivate: true, // bypass the SSRF guard — use with care
});

console.log(report.analysis.score); // 0-100
console.log(report.og.image); // resolved OG image URL
console.log(report.favicons); // favicon candidates

// Lower-level helpers
const target = normalizeTarget("example.com"); // { input, url, isLocal }
const absolute = resolveAsset(target.url, "/og.png");
const brief = buildAgentBrief({ url: target.url, issues: report.analysis.issues });
```

Exported types: `InspectOptions`, `InspectReport`, `Analysis`, `PageMetadata`, `Issue`, `MetaTag`, `FaviconResult`, `ImageInfo`, `UrlTarget`, `AgentBriefInput`.

`inspectUrl` returns the parsed metadata plus `analysis` (score + issues) and optional `ogImageInfo` (dimensions). `analyze` and `parsePage` are available if you already have HTML and want to skip the network step.

## 4. Troubleshooting

- **Port already in use** — pass `--port 4311`; Vite also falls back automatically. The printed URL is the one to open.
- **Remote URL is blocked / "private address" error** — expected for non-public addresses. Use a local URL directly, or set `allowPrivate: true` in the programmatic API only when you trust the target.
- **Previews show broken images** — some sites block the server's User-Agent; pass a browser-like `userAgent` through `inspectUrl`, or check the **Assets** panel for the raw URL.
- **Local dev server not reachable** — the inspector fetches from inside the running process; use `127.0.0.1`/`localhost` and make sure your dev server is listening on all interfaces if it runs in a container.
- **App does not start** — the tarball includes `app/`; if you are running from a source checkout, use `pnpm dev` in this package instead of the published CLI.

Release notes: [CHANGELOG.md](../CHANGELOG.md).

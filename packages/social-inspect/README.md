# @tigawanna/social-inspect

A **local-first** Open Graph / social preview inspector, inspired by [opengraph.to](https://www.opengraph.to/u/cravfted.vercel.app). It's a small [TanStack Start](https://tanstack.com/start) app that boots on demand via `npx` — nothing is deployed.

```bash
npx @tigawanna/social-inspect
# or inspect a URL immediately
npx @tigawanna/social-inspect https://cravfted.vercel.app
# or a local dev server
npx @tigawanna/social-inspect http://localhost:3000
```

It opens `http://127.0.0.1:4310` (configurable), fetches the target page **server-side** (no CORS limits, nothing uploaded anywhere), and shows:

- **Social previews** — Google, X/Twitter, Facebook, Discord, LinkedIn, WhatsApp, Slack, Telegram
- **Assets** — OG image with dimensions and every favicon/touch icon
- **Meta tags** — normalized table + one-click "Copy all" of the raw tags
- **Checks** — a weighted score out of 100 with actionable issues

## CLI options

```
  -u, --url <url>    URL to inspect on startup (local or remote)
  -p, --port <n>     Preferred port (default 4310)
      --host <host>  Host to bind (default 127.0.0.1)
      --no-open      Don't open a browser window
  -h, --help         Show help
```

Remote URLs are guarded against private-network addresses by default; local URLs (`localhost`, `127.0.0.1`, etc.) are always allowed so you can preview your own dev server.

## Programmatic API

```ts
import { inspectUrl, normalizeTarget } from "@tigawanna/social-inspect";

const report = await inspectUrl("https://cravfted.vercel.app");
console.log(report.analysis.score, report.og.image, report.favicons);
```

## How it works

The npm package ships a tiny CLI plus a bundled TanStack Start app (`app/`). The CLI starts Vite in dev mode pointing at that app; the app exposes two server routes:

- `POST /api/inspect` — fetches the target HTML, parses it with `cheerio`, and scores it
- `GET /api/asset?url=…` — streams remote images through the local server so the previews can render them

The parsing/scoring/inspection logic lives in `src/` and is shared between the UI and the programmatic API.

## Development

```bash
pnpm install
pnpm dev          # starts the app directly on :4310
pnpm build        # tsdown build of the library + CLI
pnpm test
pnpm typecheck
pnpm check-exports
```

Built with `tsdown` + `attw`, `oxlint`/`oxfmt`, and `vitest`, matching the rest of your npm packages.

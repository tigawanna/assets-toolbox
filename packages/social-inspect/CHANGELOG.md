# Changelog

All notable changes to `@tigawanna/social-inspect` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.1.0] - 2026-11-24

### Added

- First public release.
- Local-first TanStack Start inspector, started with `npx @tigawanna/social-inspect`; nothing is deployed and fetched pages never leave the local server.
- Previews for Google, X/Twitter, Facebook, Discord, LinkedIn, WhatsApp, Slack, and Telegram, plus favicons, OG image, meta-tag table, and a weighted score out of 100 with fix suggestions.
- `social-inspect` CLI flags for startup URL, port, host, and `--no-open`.
- Programmatic API (`inspectUrl`, `normalizeTarget`, `analyze`, `parsePage`, `buildAgentBrief`).
- Private-network guard for remote URLs; local dev URLs are always allowed.

See [docs/usage.md](./docs/usage.md) for the full usage guide.

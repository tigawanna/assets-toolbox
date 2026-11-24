# Changelog

All notable changes to `@tigawanna/screenshot-studio` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.1.0] - 2026-11-24

### Added

- First public release.
- Local TanStack Start canvas for Google Play and App Store listing screenshots, started with `npx @tigawanna/screenshot-studio`.
- Boards as SQLite files, scene strips (five-up phone rows) with per-store cloning, device/text layers, fills, and PNG export of every strip.
- `screenshot-studio` CLI with `--port`, `--host`, and `--no-open`; `SCREENSHOT_STUDIO_DATA` overrides the data folder.
- **Experimental** Streamable HTTP MCP endpoint at `/mcp` for listing boards and mutating strips from an agent. It is not production ready — see [docs/mcp.md](./docs/mcp.md) for status and setup.

### Notes

- Requires Node.js 22.12+ for `node:sqlite` (still an experimental Node feature).

# Changelog

All notable changes to `@tigawanna/brand-assets` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.1.0] - 2026-11-24

### Added

- First public release.
- `brand-assets` CLI with `all`, `icons`, and `og` commands: favicon.ico, transparent PNG icons, plated Apple/manifest icons, and a 1200×630 OG image from one SVG.
- Pluggable OG React components loaded at runtime with `jiti`; built-in template via `takumi-js`, with optional Google Fonts.
- Optional `site.webmanifest` output.
- Programmatic API (`generateBrandAssets`, `generateIconSet`, `renderOgImage`, `generateManifest`) with typed options.
- `attw` export validation, `vitest` tests, and ESM-only `dist` build.

See [docs/usage.md](./docs/usage.md) for the full usage guide.

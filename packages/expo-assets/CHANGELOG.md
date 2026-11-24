# Changelog

All notable changes to `@tigawanna/expo-assets` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.1.0] - 2026-11-24

### Added

- First public release.
- `expo-assets` CLI: app icon, adaptive foreground/background, Android 13+ monochrome icon, splash icon, web favicon, Android notification icon, and optional dark/tinted iOS icons from one SVG or transparent PNG.
- `expo-assets.config.json` app.json fragment with an `expo-splash-screen` plugin entry, designed for humans and coding agents.
- Programmatic API (`generateExpoAssets`, `EXPO_ASSET_DEFAULTS`) with typed options.
- `attw` export validation, `vitest` tests, and ESM-only `dist` build.

See [docs/usage.md](./docs/usage.md) for the full usage guide.

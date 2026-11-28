#!/usr/bin/env bash
# Run Wails dev through the shared launcher, which stages the WebKitGTK sysroot
# when /tmp has been cleared. Override WAILS_SYSROOT if libraries live elsewhere.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
exec node scripts/desktop.mjs dev "$@"

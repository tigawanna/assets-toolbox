#!/usr/bin/env bash
# Run Wails dev with the no-sudo WebKitGTK sysroot used on this machine.
# Override WAILS_SYSROOT if the libraries live somewhere else.
set -euo pipefail

sysroot="${WAILS_SYSROOT:-/tmp/opencode/wails-sysroot}"
if [[ -d "$sysroot/usr/lib/x86_64-linux-gnu" ]]; then
  export PKG_CONFIG_PATH="$sysroot/usr/lib/x86_64-linux-gnu/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
  export LD_LIBRARY_PATH="$sysroot/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

cd "$(dirname "$0")"
exec wails dev "$@"

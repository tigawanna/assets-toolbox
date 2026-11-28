import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PACKAGES = [
  "libwebkit2gtk-4.1-dev",
  "libjavascriptcoregtk-4.1-dev",
  "libwebkit2gtk-4.1-0",
  "libjavascriptcoregtk-4.1-0",
];

/**
 * Wails needs WebKitGTK 4.1 development files. On this machine they are not
 * installed system-wide and sudo is unavailable, so they are unpacked from
 * apt packages into a writable sysroot. /tmp gets cleared between sessions,
 * which is why this is rebuilt on demand rather than done once by hand.
 */
export function ensureWailsSysroot() {
  if (process.platform !== "linux") return {};

  const sysroot = process.env.WAILS_SYSROOT || path.join(os.tmpdir(), "opencode/wails-sysroot");
  const libdir = path.join(sysroot, "usr/lib/x86_64-linux-gnu");
  const pcDir = path.join(libdir, "pkgconfig");
  const required = ["webkit2gtk-4.1.pc", "javascriptcoregtk-4.1.pc"];

  if (required.every((file) => fs.existsSync(path.join(pcDir, file)))) {
    return withExistingPaths(libdir, pcDir);
  }

  console.log(`[wails-sysroot] Staging WebKitGTK 4.1 development files in ${sysroot}…`);
  const debDir = process.env.WAILS_DEBS || path.join(os.tmpdir(), "opencode/wails-debs");
  fs.mkdirSync(debDir, { recursive: true });
  fs.mkdirSync(sysroot, { recursive: true });

  const download = spawnSync("apt-get", ["download", ...PACKAGES], {
    cwd: debDir,
    stdio: "inherit",
  });
  if (download.status !== 0) {
    throw new Error(
      download.error?.message ??
        "Could not download WebKitGTK 4.1 packages. Install libwebkit2gtk-4.1-dev or check network access.",
    );
  }

  for (const file of fs.readdirSync(debDir).filter((name) => name.endsWith(".deb"))) {
    const extract = spawnSync("dpkg-deb", ["-x", path.join(debDir, file), sysroot], {
      stdio: "inherit",
    });
    if (extract.status !== 0) {
      throw new Error(extract.error?.message ?? `Could not unpack ${file}.`);
    }
  }

  if (!fs.existsSync(pcDir)) {
    throw new Error(`WebKit pkg-config files were not found in ${pcDir}.`);
  }
  for (const file of fs.readdirSync(pcDir).filter((name) => name.endsWith(".pc"))) {
    const file_path = path.join(pcDir, file);
    const contents = fs
      .readFileSync(file_path, "utf8")
      .replace(/^prefix=\/usr$/m, `prefix=${sysroot}/usr`)
      .replace(/^libdir=\/usr\/lib\/x86_64-linux-gnu$/m, `libdir=${libdir}`);
    fs.writeFileSync(file_path, contents);
  }

  return withExistingPaths(libdir, pcDir);
}

function withExistingPaths(libdir, pcDir) {
  const pkgConfig = [pcDir, process.env.PKG_CONFIG_PATH].filter(Boolean).join(path.delimiter);
  const library = [libdir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter);
  return {
    PKG_CONFIG_PATH: pkgConfig,
    LD_LIBRARY_PATH: library,
    CGO_LDFLAGS: `${process.env.CGO_LDFLAGS ?? ""} -Wl,-rpath,${libdir}`.trim(),
  };
}

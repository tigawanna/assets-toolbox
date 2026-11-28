import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ensureWailsSysroot } from "./wails-sysroot.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopDirectory = path.join(repositoryRoot, "apps", "desktop");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/desktop.mjs <wails command> [arguments]");
  process.exit(1);
}

function isPortInUse(address) {
  const separator = address.lastIndexOf(":");
  const host = address.slice(0, separator) || "127.0.0.1";
  const port = Number(address.slice(separator + 1));
  if (!Number.isInteger(port)) return Promise.resolve(false);

  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

const env = { ...process.env, ...ensureWailsSysroot() };

if (env.SKIP_ASSET_PACKAGE_BUILD !== "1") {
  const rootBin = path.join(repositoryRoot, "node_modules", ".bin");
  const packageBuild = spawnSync(
    "pnpm",
    ["--filter", "@tigawanna/expo-assets", "--filter", "@tigawanna/brand-assets", "build"],
    {
      cwd: repositoryRoot,
      env: { ...env, PATH: `${rootBin}${path.delimiter}${env.PATH ?? ""}` },
      stdio: "inherit",
    },
  );
  if (packageBuild.error || packageBuild.status !== 0) {
    console.error(packageBuild.error?.message ?? "Could not build the asset generator packages.");
    process.exit(packageBuild.status ?? 1);
  }
}

if (command === "dev") {
  const allowedHosts = new Set(
    (env.WAILS_DEV_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  allowedHosts.add("wails.localhost");
  env.WAILS_DEV_ALLOWED_HOSTS = [...allowedHosts].join(",");
}

const apiAddress = env.SOCIAL_INSPECT_API_ADDR ?? "127.0.0.1:4332";
const shouldStartApi = command === "dev" && env.SOCIAL_INSPECT_DEV_API !== "0";
const apiAlreadyRunning = shouldStartApi && (await isPortInUse(apiAddress));
if (apiAlreadyRunning) {
  console.log(`Reusing the Social Inspect API already listening on ${apiAddress}.`);
}

const apiServer =
  shouldStartApi && !apiAlreadyRunning
    ? spawn("go", ["run", "./cmd/social-inspect-api", "-addr", apiAddress], {
        cwd: desktopDirectory,
        env,
        stdio: "inherit",
      })
    : null;

apiServer?.on("error", (error) => {
  console.error(`Could not start the Social Inspect API: ${error.message}`);
});

const child = spawn("wails", [command, ...args], {
  cwd: desktopDirectory,
  env,
  stdio: "inherit",
});

const children = [child, ...(apiServer ? [apiServer] : [])];
const signalNumbers = { SIGINT: 2, SIGTERM: 15 };
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const runningProcess of children) runningProcess.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(`Could not start Wails: ${error.message}`);
  apiServer?.kill("SIGTERM");
  process.exit(1);
});

child.on("exit", (code, signal) => {
  apiServer?.kill("SIGTERM");
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  if (signal) {
    process.exit(128 + (signalNumbers[signal] ?? 1));
  }
  process.exit(code ?? 1);
});

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopDirectory = path.join(repositoryRoot, "apps", "desktop");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/desktop.mjs <wails command> [arguments]");
  process.exit(1);
}

const env = { ...process.env };
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

const child = spawn("wails", [command, ...args], {
  cwd: desktopDirectory,
  env,
  stdio: "inherit",
});

const signalNumbers = { SIGINT: 2, SIGTERM: 15 };
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`Could not start Wails: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  if (signal) {
    process.exit(128 + (signalNumbers[signal] ?? 1));
  }
  process.exit(code ?? 1);
});

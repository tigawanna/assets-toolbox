import { spawn, spawnSync } from "node:child_process";
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

if (env.SKIP_ASSET_PACKAGE_BUILD !== "1") {
  const packageBuild = spawnSync(
    "pnpm",
    ["--filter", "@tigawanna/expo-assets", "--filter", "@tigawanna/brand-assets", "build"],
    {
      cwd: repositoryRoot,
      env,
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

const apiServer =
  command === "dev" && env.SOCIAL_INSPECT_DEV_API !== "0"
    ? spawn(
        "go",
        [
          "run",
          "./cmd/social-inspect-api",
          "-addr",
          env.SOCIAL_INSPECT_API_ADDR ?? "127.0.0.1:4332",
        ],
        { cwd: desktopDirectory, env, stdio: "inherit" },
      )
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

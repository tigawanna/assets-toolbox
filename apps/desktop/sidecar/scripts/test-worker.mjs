#!/usr/bin/env node
/** Smoke test for the Expo sidecar: spawn it like the desktop app would. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const worker = resolve(here, "../src/worker.mjs");
const fixture = resolve(here, "../../../../packages/expo-assets/test/fixtures/logo.svg");
const root = mkdtempSync(join(tmpdir(), "expo-sidecar-test-"));

function run(request) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [worker], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 90_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveRun({ code, signal, stdout, stderr });
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}

function oneLine(result) {
  const lines = result.stdout.trimEnd().split("\n").filter(Boolean);
  assert.equal(
    lines.length,
    1,
    `expected one JSON line, got ${lines.length}; stderr: ${result.stderr}`,
  );
  return JSON.parse(lines[0]);
}

try {
  mkdirSync(join(root, "inputs"), { recursive: true });
  copyFileSync(fixture, join(root, "inputs/icon.svg"));

  const base = {
    tool: "expo",
    jobId: "smoke",
    root,
    inputs: { icon: "inputs/icon.svg" },
    options: {
      brandColor: "#123456",
      splashBackground: "#abcdef",
      imageWidth: 180,
      foregroundSize: 600,
      splashLogoSize: 520,
    },
    outDir: "out",
  };

  const success = await run(base);
  assert.equal(success.code, 0, `worker failed: ${success.stderr}`);
  const response = oneLine(success);
  assert.equal(response.ok, true, response.error);
  assert.equal(response.tool, "expo");

  const names = response.artifacts.map((asset) => asset.name).sort();
  assert.deepEqual(names, [
    "adaptive-icon.png",
    "android-icon-background.png",
    "android-icon-monochrome.png",
    "favicon.png",
    "icon.png",
    "notification-icon.png",
    "splash-icon.png",
  ]);

  const byName = Object.fromEntries(response.artifacts.map((asset) => [asset.name, asset]));
  const dimensions = {
    "icon.png": "1024x1024",
    "adaptive-icon.png": "1024x1024",
    "android-icon-background.png": "1024x1024",
    "android-icon-monochrome.png": "1024x1024",
    "splash-icon.png": "1024x1024",
    "favicon.png": "48x48",
    "notification-icon.png": "96x96",
  };
  for (const [name, size] of Object.entries(dimensions)) {
    assert.equal(`${byName[name].width}x${byName[name].height}`, size, `${name} dimensions`);
  }
  for (const asset of response.artifacts) {
    assert.ok(!asset.path.startsWith("/"), `${asset.name} path must be project-relative`);
    const file = join(root, asset.path);
    assert.ok(existsSync(file), `${asset.name} missing on disk`);
    assert.equal(statSync(file).size, asset.bytes, `${asset.name} byte count`);
  }

  assert.equal(response.configPath, "out/expo-assets.config.json");
  assert.equal(response.config.expo.icon, "./out/icon.png");
  assert.equal(response.config.expo.web.favicon, "./out/favicon.png");
  assert.deepEqual(response.config.expo.plugins[0][1], {
    image: "./out/splash-icon.png",
    backgroundColor: "#abcdef",
    imageWidth: 180,
  });
  assert.ok(existsSync(join(root, response.configPath)), "config file missing on disk");
  assert.ok(response.agentPrompt.includes("app.json"));
  assert.ok(!response.agentPrompt.includes(root), "agent prompt leaks absolute root");

  for (const badCase of [
    { label: "invalid color", request: { ...base, options: { brandColor: "not-a-color" } } },
    { label: "path traversal", request: { ...base, inputs: { icon: "../outside.svg" } } },
  ]) {
    const result = await run(badCase.request);
    assert.notEqual(result.code, 0, `${badCase.label} should fail`);
    const failure = oneLine(result);
    assert.equal(failure.ok, false, `${badCase.label} must report failure`);
    assert.equal(failure.code, "VALIDATION", `${badCase.label} code`);
  }

  console.log("expo sidecar worker: ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}

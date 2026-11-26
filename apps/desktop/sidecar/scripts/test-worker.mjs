#!/usr/bin/env node
/** Smoke test for the asset sidecar: spawn it like the desktop app would. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const worker = resolve(here, "../src/worker.mjs");
const fixture = resolve(here, "../../../../packages/expo-assets/test/fixtures/logo.svg");
const brandFixture = resolve(here, "../../../../packages/brand-assets/test/fixtures/icon.svg");
const root = mkdtempSync(join(tmpdir(), "expo-sidecar-test-"));
const brandRoot = mkdtempSync(join(tmpdir(), "brand-sidecar-test-"));

function run(request, { cwd = root, env = {} } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [worker], {
      cwd,
      env: { ...process.env, ...env },
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

  // Brand assets: same protocol, canonical generator, icons + OG + manifest.
  mkdirSync(join(brandRoot, "inputs"), { recursive: true });
  copyFileSync(brandFixture, join(brandRoot, "inputs/icon.svg"));

  const brand = {
    tool: "brand",
    jobId: "brand-smoke",
    root: brandRoot,
    inputs: { icon: "inputs/icon.svg" },
    options: {
      plate: "#101820",
      copySvg: true,
      og: {
        title: "My site",
        description: "Brand assets",
        siteLabel: "STUDIO",
        width: 800,
        height: 400,
        enabled: true,
      },
      manifest: {
        name: "My site",
        shortName: "Site",
        display: "standalone",
        enabled: true,
      },
    },
    outDir: "public",
  };

  const brandRun = await run(brand, { cwd: brandRoot });
  assert.equal(brandRun.code, 0, `brand worker failed: ${brandRun.stderr}`);
  const brandResponse = oneLine(brandRun);
  assert.equal(brandResponse.ok, true, brandResponse.error);
  assert.equal(brandResponse.tool, "brand");

  const brandNames = brandResponse.artifacts.map((asset) => asset.name);
  for (const name of [
    "favicon.ico",
    "favicon-32x32.png",
    "og.png",
    "site.webmanifest",
    "favicon.svg",
  ]) {
    assert.ok(brandNames.includes(name), `${name} missing from ${brandNames.join(", ")}`);
  }
  const brandByName = Object.fromEntries(
    brandResponse.artifacts.map((asset) => [asset.name, asset]),
  );
  assert.equal(
    `${brandByName["favicon-32x32.png"].width}x${brandByName["favicon-32x32.png"].height}`,
    "32x32",
  );
  assert.equal(`${brandByName["og.png"].width}x${brandByName["og.png"].height}`, "800x400");
  assert.ok(brandByName["favicon.ico"].width > 0, "ICO width should come from the file header");
  assert.equal(brandByName["site.webmanifest"].width, 0, "unknown dimensions are zero");
  for (const asset of brandResponse.artifacts) {
    assert.ok(!asset.path.startsWith("/"), `${asset.name} path must be project-relative`);
    const file = join(brandRoot, asset.path);
    assert.ok(existsSync(file), `${asset.name} missing on disk`);
    assert.equal(statSync(file).size, asset.bytes, `${asset.name} byte count`);
  }
  assert.equal(brandResponse.configPath, "public/site.webmanifest");
  assert.equal(brandResponse.config.name, "My site");
  assert.equal(brandResponse.config.short_name, "Site");
  assert.ok(existsSync(join(brandRoot, brandResponse.configPath)), "manifest missing on disk");
  assert.ok(brandResponse.agentPrompt.includes("favicon.ico"), "prompt lacks favicon link");
  assert.ok(brandResponse.agentPrompt.includes("site.webmanifest"), "prompt lacks manifest link");
  assert.ok(!brandResponse.agentPrompt.includes(brandRoot), "prompt leaks absolute root");

  // Empty font lists are sent first; force a font failure to exercise the retry.
  const fallbackRun = await run(brand, {
    cwd: brandRoot,
    env: { ASSET_SIDECAR_FORCE_FONT_FAILURE: "1" },
  });
  assert.equal(fallbackRun.code, 0, `font fallback failed: ${fallbackRun.stderr}`);
  assert.match(fallbackRun.stderr, /fonts: \[\] could not be rendered/);
  const fallbackResponse = oneLine(fallbackRun);
  assert.equal(fallbackResponse.ok, true, fallbackResponse.error);
  assert.ok(
    fallbackResponse.artifacts.some((asset) => asset.name === "og.png"),
    "fallback must still produce og.png",
  );

  // Disabled features produce no OG image/manifest, and unknown keys are rejected.
  const disabledRun = await run(
    {
      ...brand,
      outDir: "disabled",
      options: { og: { title: "My site", enabled: false }, manifest: { enabled: false } },
    },
    { cwd: brandRoot },
  );
  assert.equal(disabledRun.code, 0, `disabled brand run failed: ${disabledRun.stderr}`);
  const disabled = oneLine(disabledRun);
  assert.equal(disabled.ok, true, disabled.error);
  assert.ok(!disabled.artifacts.some((asset) => asset.name === "og.png"));
  assert.ok(!disabled.artifacts.some((asset) => asset.name === "site.webmanifest"));
  assert.equal(disabled.config, null);
  assert.equal(disabled.configPath, null);

  for (const badCase of [
    { label: "brand invalid plate", request: { ...brand, options: { plate: "not-a-color" } } },
    { label: "brand unknown option", request: { ...brand, options: { brandColor: "#123456" } } },
    { label: "brand missing title", request: { ...brand, options: { og: { enabled: true } } } },
    {
      label: "brand bad dimension",
      request: { ...brand, options: { og: { title: "x", width: 12 } } },
    },
    {
      label: "brand unknown og key",
      request: { ...brand, options: { og: { title: "x", fonts: [] } } },
    },
    { label: "brand path traversal", request: { ...brand, inputs: { icon: "../outside.svg" } } },
  ]) {
    const result = await run(badCase.request, { cwd: brandRoot });
    assert.notEqual(result.code, 0, `${badCase.label} should fail`);
    const failure = oneLine(result);
    assert.equal(failure.ok, false, `${badCase.label} must report failure`);
    assert.equal(failure.code, "VALIDATION", `${badCase.label} code`);
  }

  console.log("asset sidecar worker: ok");
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(brandRoot, { recursive: true, force: true });
}
